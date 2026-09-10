/**
 * Backfills the dual-mode (residential / commercial) fields.
 *
 *   node scripts/migrate-site-modes.js            # dry run, prints what would change
 *   node scripts/migrate-site-modes.js --apply    # writes
 *
 * Idempotent: safe to run repeatedly. Existing documents keep their behaviour
 * (everything already in the database is treated as residential unless the
 * building's `type` label says otherwise).
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/smartgate';
const APPLY = process.argv.includes('--apply');

const COMMERCIAL_RE = /commercial|office|business|corporate|retail|mall/i;

function defaultSettings(siteType) {
  return siteType === 'commercial'
    ? {
        guardCanApprove: true,
        requireHostApproval: false,
        requireVisitorPhoto: true,
        requireIdProof: true,
        collectVehicleNumber: true,
        allowGateQrSelfRegister: true,
        passValidityHours: 12,
        autoCheckoutHours: 12,
      }
    : {
        guardCanApprove: false,
        requireHostApproval: true,
        requireVisitorPhoto: false,
        requireIdProof: false,
        collectVehicleNumber: true,
        allowGateQrSelfRegister: true,
        passValidityHours: 24,
        autoCheckoutHours: null,
      };
}

const PASS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const passCode = () =>
  Array.from(crypto.randomBytes(6), (b) => PASS_ALPHABET[b % 32]).join('');
const passToken = () => crypto.randomBytes(18).toString('base64url');
const gateToken = () => crypto.randomBytes(16).toString('hex');

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(
    `Connected to ${MONGODB_URI} — ${APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)'}`,
  );

  // ---------------- buildings ----------------
  const buildings = db.collection('buildings');
  const buildingCursor = buildings.find({
    $or: [
      { siteType: { $exists: false } },
      { settings: { $exists: false } },
      { gateQrToken: { $exists: false } },
      { gateQrToken: null },
    ],
  });

  let bCount = 0;
  const bySite = { residential: 0, commercial: 0 };
  for await (const b of buildingCursor) {
    const siteType =
      b.siteType || (COMMERCIAL_RE.test(b.type || '') ? 'commercial' : 'residential');
    const set = {};
    if (!b.siteType) set.siteType = siteType;
    if (!b.settings) set.settings = defaultSettings(siteType);
    if (!b.gateQrToken) set.gateQrToken = gateToken();
    if (!Object.keys(set).length) continue;

    bCount++;
    bySite[siteType]++;
    if (APPLY) {
      await buildings.updateOne({ _id: b._id }, { $set: set });
    } else {
      console.log(
        `  building "${b.name}" (${b.type || 'no type'}) -> ${siteType}${
          set.gateQrToken ? ' + gate QR token' : ''
        }`,
      );
    }
  }
  console.log(
    `Buildings needing backfill: ${bCount} (residential ${bySite.residential}, commercial ${bySite.commercial})`,
  );

  // ---------------- visitors ----------------
  const visitors = db.collection('visitors');
  const buildingsByName = new Map();
  for await (const b of buildings.find({}, { projection: { name: 1, siteType: 1, type: 1 } })) {
    buildingsByName.set((b.name || '').toLowerCase(), b);
  }
  const users = db.collection('users');
  const userBuilding = new Map();
  for await (const u of users.find({}, { projection: { building: 1 } })) {
    if (u.building) userBuilding.set(String(u._id), u.building);
  }

  const vCursor = visitors.find({
    $or: [
      { approvalMode: { $exists: false } },
      { source: { $exists: false } },
      { passToken: { $exists: false } },
      { passToken: null },
    ],
  });

  let vCount = 0;
  for await (const v of vCursor) {
    const set = {};
    if (!v.approvalMode) set.approvalMode = 'resident';
    if (!v.source) set.source = 'resident';
    if (!v.passToken) set.passToken = passToken();
    if (!v.passCode) set.passCode = passCode();

    // link the visit to its building via the host resident's profile
    if (!v.buildingId && v.userId) {
      const bName = userBuilding.get(String(v.userId));
      const b = bName && buildingsByName.get(bName.toLowerCase());
      if (b) {
        set.buildingId = b._id;
        set.buildingName = b.name;
        set.siteType = b.siteType || (COMMERCIAL_RE.test(b.type || '') ? 'commercial' : 'residential');
      } else if (bName) {
        set.buildingName = bName;
      }
    }
    if (!v.siteType && !set.siteType) set.siteType = 'residential';

    // pre-dual-mode passes were minted under the flat 24h rule
    if (!v.expiresAt && v.createdAt) {
      set.expiresAt = new Date(new Date(v.createdAt).getTime() + 24 * 3600_000);
    }

    vCount++;
    if (APPLY) {
      await visitors.updateOne({ _id: v._id }, { $set: set });
    }
  }
  console.log(`Visitors needing backfill: ${vCount}`);

  if (APPLY) {
    await visitors.createIndex({ passToken: 1 }, { unique: true, sparse: true });
    await visitors.createIndex({ passCode: 1 });
    await visitors.createIndex({ buildingId: 1, status: 1, createdAt: -1 });
    await visitors.createIndex({ status: 1, approvalMode: 1 });
    await buildings.createIndex({ gateQrToken: 1 }, { unique: true, sparse: true });
    console.log('Indexes ensured.');
  }

  await mongoose.disconnect();
  console.log(APPLY ? 'Migration complete.' : 'Dry run complete — nothing written.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
