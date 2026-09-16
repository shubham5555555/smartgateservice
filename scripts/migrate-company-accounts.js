/**
 * Prepares the database for company accounts (commercial offices).
 *
 *   node scripts/migrate-company-accounts.js            # dry run, prints what would change
 *   node scripts/migrate-company-accounts.js --apply    # writes
 *
 * Idempotent: safe to run repeatedly. Nothing is deleted and no existing
 * behaviour changes — every current user stays a resident.
 *
 * What it does:
 *  1. Stamps `accountType: 'resident'` on every user that has none, so the
 *     apps can branch on it from the first request.
 *  2. Creates a `Company` per distinct `hostCompany` string seen on a
 *     commercial building's visits (at least MIN_VISITS times), carrying the
 *     floor / unit from the most recent such visit — so day one of the feature
 *     already has the real office list instead of an empty page.
 *  3. Links historical visits to those companies (`companyId`).
 *
 * Names seen only once are listed but not created: they are usually typos or
 * one-off deliveries, and a wrong company is worse than a missing one.
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/smartgate';
const APPLY = process.argv.includes('--apply');
const MIN_VISITS = parseInt(process.env.MIN_VISITS || '2', 10);

function normalize(name) {
  return String(name || '').trim().toLowerCase();
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${MONGODB_URI}\n`);

  const users = db.collection('users');
  const buildings = db.collection('buildings');
  const visitors = db.collection('visitors');
  const companies = db.collection('companies');

  // ---- 1. Every existing account is a resident ---------------------------
  const needType = await users.countDocuments({
    accountType: { $exists: false },
  });
  console.log(`1. Users without accountType: ${needType}`);
  if (APPLY && needType > 0) {
    const r = await users.updateMany(
      { accountType: { $exists: false } },
      { $set: { accountType: 'resident' } },
    );
    console.log(`   stamped ${r.modifiedCount} user(s) as resident`);
  }

  // ---- 2. Companies from the free-text host names ------------------------
  const commercial = await buildings
    .find({ siteType: 'commercial' })
    .project({ _id: 1, name: 1, organizationId: 1 })
    .toArray();
  console.log(`\n2. Commercial buildings: ${commercial.length}`);

  let created = 0;
  let skipped = 0;
  for (const building of commercial) {
    const rows = await visitors
      .aggregate([
        {
          $match: {
            buildingId: building._id,
            hostCompany: { $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$hostCompany' } } },
            name: { $last: '$hostCompany' },
            floor: { $last: '$hostFloor' },
            unit: { $last: '$hostUnit' },
            visits: { $sum: 1 },
          },
        },
        { $sort: { visits: -1 } },
      ])
      .toArray();

    for (const row of rows) {
      const normalized = normalize(row._id);
      if (!normalized) continue;

      const exists = await companies.findOne({
        buildingId: building._id,
        normalizedName: normalized,
      });
      if (exists) continue;

      if (row.visits < MIN_VISITS) {
        skipped++;
        console.log(
          `   · skipped "${row.name}" in ${building.name} (${row.visits} visit) — confirm by hand if it is a real tenant`,
        );
        continue;
      }

      console.log(
        `   + ${building.name}: "${row.name}" (${row.visits} visits${row.floor ? `, floor ${row.floor}` : ''})`,
      );
      created++;
      if (APPLY) {
        const now = new Date();
        await companies.insertOne({
          name: String(row.name).trim(),
          normalizedName: normalized,
          buildingId: building._id,
          buildingName: building.name,
          organizationId: building.organizationId,
          floor: row.floor || undefined,
          units: row.unit ? [String(row.unit)] : [],
          settings: {
            allowEmployeeInvites: true,
            invitesNeedDesk: false,
            employeeLimit: null,
          },
          isActive: true,
          createdBy: 'migrate-company-accounts',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
  console.log(
    `   companies ${APPLY ? 'created' : 'to create'}: ${created}; left for review: ${skipped}`,
  );

  // ---- 3. Link historical visits ----------------------------------------
  let linked = 0;
  const allCompanies = await companies.find({}).toArray();
  for (const company of allCompanies) {
    const filter = {
      buildingId: company.buildingId,
      companyId: { $exists: false },
      hostCompany: { $regex: `^${escapeRegex(company.name)}$`, $options: 'i' },
    };
    const count = await visitors.countDocuments(filter);
    if (!count) continue;
    linked += count;
    if (APPLY) {
      await visitors.updateMany(filter, { $set: { companyId: company._id } });
    }
  }
  console.log(
    `\n3. Historical visits ${APPLY ? 'linked' : 'to link'} to a company: ${linked}`,
  );

  console.log(
    `\n${APPLY ? 'Done.' : 'Dry run complete — re-run with --apply to write.'}\n`,
  );
  await mongoose.disconnect();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
