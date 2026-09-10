/**
 * Multi-builder (organization) backfill.
 *
 *   node scripts/migrate-multi-tenant.js            # dry run
 *   node scripts/migrate-multi-tenant.js --apply    # write
 *
 * Idempotent. Steps:
 *   1. ensure a "Default Builder" organization
 *   2. ensure a super_admin account from ADMIN_EMAIL / ADMIN_PASSWORD
 *   3. buildings: organizationId, propertyType/unitModel/unitLabel from the legacy `type`,
 *      drop the global unique `name_1` index (uniqueness is per organization now)
 *   4. users: organizationId + buildingId resolved from the `building` name
 *   5. guards + every other tenant collection: organizationId = default org where missing
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: __dirname + '/../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartgate';
const APPLY = process.argv.includes('--apply');

const TYPE_INFO = {
  apartment: { label: 'Apartment', siteType: 'residential', unitModel: 'floors', unitLabel: 'Flat' },
  tower: { label: 'Tower', siteType: 'residential', unitModel: 'floors', unitLabel: 'Flat' },
  villa: { label: 'Villa', siteType: 'residential', unitModel: 'standalone', unitLabel: 'Villa' },
  row_house: { label: 'Row House', siteType: 'residential', unitModel: 'standalone', unitLabel: 'House' },
  independent_house: { label: 'Independent House', siteType: 'residential', unitModel: 'standalone', unitLabel: 'House' },
  gated_community: { label: 'Gated Community', siteType: 'residential', unitModel: 'standalone', unitLabel: 'Unit' },
  plot: { label: 'Plotted Layout', siteType: 'residential', unitModel: 'standalone', unitLabel: 'Plot' },
  office: { label: 'Office Building', siteType: 'commercial', unitModel: 'floors', unitLabel: 'Office' },
  it_park: { label: 'IT Park', siteType: 'commercial', unitModel: 'floors', unitLabel: 'Office' },
  coworking: { label: 'Co-working', siteType: 'commercial', unitModel: 'floors', unitLabel: 'Suite' },
  mall: { label: 'Mall', siteType: 'commercial', unitModel: 'floors', unitLabel: 'Shop' },
  retail: { label: 'Retail', siteType: 'commercial', unitModel: 'floors', unitLabel: 'Shop' },
  warehouse: { label: 'Warehouse', siteType: 'commercial', unitModel: 'standalone', unitLabel: 'Bay' },
};

function propertyTypeFromLabel(label) {
  const l = (label || '').toLowerCase().trim();
  if (!l) return 'apartment';
  for (const [k, v] of Object.entries(TYPE_INFO)) if (k === l || v.label.toLowerCase() === l) return k;
  if (/tower/.test(l)) return 'tower';
  if (/villa/.test(l)) return 'villa';
  if (/row/.test(l)) return 'row_house';
  if (/individual|independent|bungalow|house/.test(l)) return 'independent_house';
  if (/gated|township|community/.test(l)) return 'gated_community';
  if (/plot|layout/.test(l)) return 'plot';
  if (/mall/.test(l)) return 'mall';
  if (/retail|shop/.test(l)) return 'retail';
  if (/warehouse|godown|logistic/.test(l)) return 'warehouse';
  if (/it park|tech/.test(l)) return 'it_park';
  if (/cowork/.test(l)) return 'coworking';
  if (/commercial|office|business|corporate/.test(l)) return 'office';
  return 'apartment';
}

const TENANT_COLLECTIONS = [
  'guards', 'visitors', 'staffs', 'notices', 'parcels', 'complaints', 'events',
  'emergencycontacts', 'amenities', 'amenitybookings', 'contacts', 'vehicles',
  'parkingslots', 'parkingapplications', 'maintenances', 'documentfiles', 'documents',
  'pets', 'accessrequests', 'notifications', 'reminders', 'staffactivities', 'vehicleentries',
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`Connected to ${MONGODB_URI} — ${APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)'}`);

  // 1. default organization
  const orgs = db.collection('organizations');
  let org = await orgs.findOne({}, { sort: { createdAt: 1 } });
  if (!org) {
    console.log('organizations: none found → will create "Default Builder"');
    if (APPLY) {
      const now = new Date();
      const res = await orgs.insertOne({ name: 'Default Builder', slug: 'default', isActive: true, createdAt: now, updatedAt: now });
      org = await orgs.findOne({ _id: res.insertedId });
    }
  } else {
    console.log(`organizations: using "${org.name}" (${org._id}) as the default`);
  }
  const orgId = org ? org._id : null;

  // 2. super admin
  const admins = db.collection('adminusers');
  const adminCount = await admins.countDocuments();
  if (adminCount === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@smartgate.com').toLowerCase();
    console.log(`adminusers: empty → will create super_admin ${email}`);
    if (APPLY) {
      const password = process.env.ADMIN_PASSWORD_HASHED || (await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10));
      const now = new Date();
      await admins.insertOne({ email, password, name: 'Platform Admin', role: 'super_admin', buildingIds: [], isActive: true, createdBy: 'migration', createdAt: now, updatedAt: now });
    }
  } else {
    console.log(`adminusers: ${adminCount} account(s) present`);
  }

  // 3. buildings
  const buildings = db.collection('buildings');
  const bCursor = buildings.find({});
  let bUpdated = 0;
  const byName = new Map();
  for await (const b of bCursor) {
    const set = {};
    if (!b.organizationId && orgId) set.organizationId = orgId;
    const pt = b.propertyType || propertyTypeFromLabel(b.type);
    const info = TYPE_INFO[pt];
    if (!b.propertyType) set.propertyType = pt;
    if (!b.unitModel) set.unitModel = info.unitModel;
    if (!b.unitLabel) set.unitLabel = info.unitLabel;
    if (!b.siteType) set.siteType = info.siteType;
    if (!b.normalizedName && b.name) set.normalizedName = String(b.name).toLowerCase();
    byName.set(String(b.name || '').toLowerCase(), { _id: b._id, organizationId: b.organizationId || orgId });
    if (Object.keys(set).length) {
      bUpdated++;
      if (APPLY) await buildings.updateOne({ _id: b._id }, { $set: set });
    }
  }
  console.log(`buildings: ${bUpdated} to update`);
  try {
    const idx = await buildings.indexes();
    if (idx.some((i) => i.name === 'name_1')) {
      console.log('buildings: dropping global unique index name_1 (names are unique per organization now)');
      if (APPLY) await buildings.dropIndex('name_1');
    }
  } catch (e) {
    console.log('buildings: index check skipped:', e.message);
  }

  // 4. users
  const users = db.collection('users');
  let uUpdated = 0;
  for await (const u of users.find({})) {
    const set = {};
    const site = u.building ? byName.get(String(u.building).toLowerCase()) : null;
    if (!u.buildingId && site) set.buildingId = site._id;
    if (!u.organizationId) set.organizationId = site ? site.organizationId : orgId;
    if (Object.keys(set).length && (set.organizationId || set.buildingId)) {
      uUpdated++;
      if (APPLY) await users.updateOne({ _id: u._id }, { $set: set });
    }
  }
  console.log(`users: ${uUpdated} to update`);

  // 5. everything else
  for (const name of TENANT_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) continue;
    const col = db.collection(name);
    const missing = await col.countDocuments({ organizationId: { $exists: false } });
    if (missing === 0) continue;
    console.log(`${name}: ${missing} document(s) without organizationId → default org`);
    if (APPLY && orgId) {
      // visitors/parking slots: prefer the building's organization when known
      if (name === 'visitors') {
        for await (const v of col.find({ organizationId: { $exists: false } })) {
          const site = v.buildingName ? byName.get(String(v.buildingName).toLowerCase()) : null;
          await col.updateOne({ _id: v._id }, { $set: { organizationId: site ? site.organizationId : orgId } });
        }
      } else {
        await col.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: orgId } });
      }
    }
  }

  console.log(APPLY ? 'Done.' : 'Dry run complete — nothing written.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
