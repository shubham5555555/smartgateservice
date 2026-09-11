#!/usr/bin/env node
/**
 * Seed a complete, self-contained TEST dataset through the public API so it
 * works against any environment that runs the current backend (local,
 * staging, live). Everything it creates is prefixed with "Test" / *.test
 * addresses so it is easy to recognise and delete.
 *
 * Usage (from backend/):
 *   API_BASE=https://api-smartgate.brahmaastra.ai/v1 \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   DASHBOARD_URL=https://dashboard.example.com \
 *   MONGODB_URI=mongodb+srv://...            # optional: enables resident-app logins
 *   node scripts/seed-test-data.js
 *
 * Re-running is safe: builders, admin users, buildings, guards, residents and
 * watchlist entries are looked up before being created; visits and parcels
 * are always added fresh (they are the things you test with).
 *
 * Writes TEST_CREDENTIALS.md next to this script's parent (backend/) unless
 * OUT is set.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = (process.env.API_BASE || 'http://localhost:5050/v1').replace(/\/$/, '');
const DASH = (process.env.DASHBOARD_URL || 'http://localhost:3001').replace(/\/$/, '');
const SUPER_EMAIL = process.env.ADMIN_EMAIL;
const SUPER_PASS = process.env.ADMIN_PASSWORD;
const OUT = process.env.OUT || path.join(__dirname, '..', 'TEST_CREDENTIALS.md');
const PASSWORD = process.env.TEST_PASSWORD || 'Test@1234';
const GUARD_PASSWORD = process.env.TEST_GUARD_PASSWORD || 'Guard@1234';

if (!SUPER_EMAIL || !SUPER_PASS) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD (super admin) are required');
  process.exit(1);
}

// ── tiny HTTP helper ────────────────────────────────────────────────────────
async function call(method, p, body, token, extraHeaders = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}
const need = (r, what) => {
  if (!r.ok) throw new Error(`${what} failed (${r.status}): ${JSON.stringify(r.data)}`);
  return r.data;
};
const list = (d, key) => (Array.isArray(d) ? d : d?.[key] || d?.data || d?.items || []);
const id = (d) => d?._id || d?.id || d?.building?._id || d?.visitor?._id || d?.data?._id;

// ── fixtures ────────────────────────────────────────────────────────────────
const ORG_NAME = 'Akshar Test Builder';
const ADMINS = [
  { email: 'builder.admin@test.akshar', name: 'Test Builder Admin', role: 'builder_admin' },
  { email: 'manager@test.akshar', name: 'Test Building Manager', role: 'building_manager' },
];
const RES_BUILDING = { name: 'Akshar Heights (Test)', address: '12 Lake View Road, Ahmedabad', propertyType: 'apartment', totalFloors: 3, flatsPerFloor: 4 };
const COM_BUILDING = { name: 'Akshar Business Park (Test)', address: '7 SG Highway, Ahmedabad', propertyType: 'it_park', totalFloors: 3, flatsPerFloor: 4 };
const GUARDS = [
  { guardId: 'TG001', name: 'Test Guard Residential', phoneNumber: '+919000000001', shift: 'Morning', gateNumber: 'Main Gate', site: 'res' },
  { guardId: 'TG002', name: 'Test Guard Commercial', phoneNumber: '+919000000002', shift: 'Morning', gateNumber: 'Lobby Desk', site: 'com' },
];
const RESIDENTS = [
  { fullName: 'Test Resident Owner', email: 'resident1@test.akshar', phoneNumber: '+919000000101', flatNo: '101', residentType: 'Owner' },
  { fullName: 'Test Resident Tenant', email: 'resident2@test.akshar', phoneNumber: '+919000000102', flatNo: '102', residentType: 'Rented' },
  { fullName: 'Test Resident Family', email: 'resident3@test.akshar', phoneNumber: '+919000000201', flatNo: '201', residentType: 'Owner' },
];
const WATCHLIST = [
  { kind: 'block', name: 'Blocked Person (Test)', phoneNumber: '+919000000999', reason: 'Test: trespass incident, do not admit' },
  { kind: 'warn', idProofLast4: '7777', reason: 'Test: verify identity carefully' },
];

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const log = (m) => console.log(`• ${m}`);
  const summary = { visits: [], parcels: [] };

  // 0. Health / version check: the endpoints used here only exist on the
  //    multi-tenant + commercial build.
  const probe = await call('GET', '/buildings/property-types');
  if (probe.status === 404 || probe.status === 0) {
    throw new Error(`${API} does not expose /buildings/property-types — this backend is not running the current build. Deploy it first.`);
  }
  need(probe, 'reach API');

  // 1. Super admin login
  const sup = need(await call('POST', '/admin/auth/login', { email: SUPER_EMAIL, password: SUPER_PASS }), 'super admin login');
  const ST = sup.token;
  log(`logged in as super admin (${SUPER_EMAIL}, role ${sup.user?.role || sup.role || 'admin'})`);

  // 2. Builder (organization)
  let org = list(need(await call('GET', '/admin/organizations', null, ST), 'organizations'), 'organizations').find((o) => o.name === ORG_NAME);
  if (!org) org = need(await call('POST', '/admin/organizations', { name: ORG_NAME, contactEmail: 'ops@test.akshar' }, ST), 'create organization');
  const ORG = id(org);
  const OH = { 'X-Organization-Id': ORG };
  log(`builder "${ORG_NAME}" → ${ORG}`);

  // 3. Buildings (scoped to the builder)
  const existing = list(need(await call('GET', '/buildings', null, ST, OH), 'buildings'), 'buildings');
  const ensureBuilding = async (fx) => {
    const found = existing.find((b) => b.name === fx.name);
    if (found) return found;
    return need(await call('POST', '/buildings', { ...fx, organizationId: ORG }, ST, OH), `create building ${fx.name}`);
  };
  const res = await ensureBuilding(RES_BUILDING);
  const com = await ensureBuilding(COM_BUILDING);
  const RES_ID = id(res), COM_ID = id(com);
  log(`residential "${RES_BUILDING.name}" → ${RES_ID}`);
  log(`commercial "${COM_BUILDING.name}" → ${COM_ID}`);

  // Commercial rules that make testing easy but exercise every feature.
  need(await call('PUT', `/buildings/${COM_ID}/settings`, {
    siteType: 'commercial',
    settings: {
      requireVisitorPhoto: false,          // set true once S3 is configured
      requireIdProof: true,
      collectVehicleNumber: true,
      selfRegistrationEnabled: true,
      passValidityHours: 12,
      autoCheckoutHours: 12,
      allowedVisitTypes: [],               // all 14 types
      operatingHours: { open: '08:00', close: '20:00', days: [0, 1, 2, 3, 4, 5, 6] },
      afterHoursPolicy: 'guard_approval',
      maxInside: 100,
      requireConsent: true,
      termsText: 'Test site terms: no photography beyond the lobby, escort required on office floors.',
      maxPassDays: 30,
      notifyOverstay: true,
    },
  }, ST, OH), 'commercial settings');
  need(await call('PUT', `/buildings/${RES_ID}/settings`, {
    siteType: 'residential',
    settings: { requireVisitorPhoto: false, selfRegistrationEnabled: true },
  }, ST, OH), 'residential settings');

  // Gate QR tokens (public visitor form)
  const resQr = need(await call('GET', `/buildings/${RES_ID}/gate-qr`, null, ST, OH), 'residential gate qr');
  const comQr = need(await call('GET', `/buildings/${COM_ID}/gate-qr`, null, ST, OH), 'commercial gate qr');
  const RES_TOK = resQr.token || resQr.gateQrToken, COM_TOK = comQr.token || comQr.gateQrToken;

  // 4. Admin users
  const admins = list(need(await call('GET', '/admin/admin-users', null, ST, OH), 'admin users'), 'users');
  for (const a of ADMINS) {
    if (admins.find((x) => x.email === a.email)) { log(`admin user ${a.email} exists`); continue; }
    const body = { ...a, password: PASSWORD, organizationId: ORG };
    if (a.role === 'building_manager') body.buildingIds = [COM_ID];
    need(await call('POST', '/admin/admin-users', body, ST, OH), `create admin ${a.email}`);
    log(`admin user ${a.email} (${a.role})`);
  }
  const BT = need(await call('POST', '/admin/auth/login', { email: ADMINS[0].email, password: PASSWORD }), 'builder admin login').token;

  // 5. Guards
  const guards = list(need(await call('GET', '/admin/guards', null, BT), 'guards'), 'guards');
  for (const g of GUARDS) {
    if (guards.find((x) => x.phoneNumber === g.phoneNumber || x.guardId === g.guardId)) { log(`guard ${g.guardId} exists`); continue; }
    const { site, ...rest } = g;
    need(await call('POST', '/admin/guards', { ...rest, password: GUARD_PASSWORD, buildingIds: [site === 'res' ? RES_ID : COM_ID] }, BT), `create guard ${g.guardId}`);
    log(`guard ${g.guardId} ${g.phoneNumber}`);
  }
  const GT = need(await call('POST', '/admin/guard/auth/login', { phoneNumber: GUARDS[1].phoneNumber, password: GUARD_PASSWORD }), 'guard login').token;

  // 6. Residents (residential building)
  const residentIds = [];
  const residents = list(need(await call('GET', `/admin/residents?search=test.akshar`, null, BT), 'residents'), 'residents');
  for (const r of RESIDENTS) {
    let doc = residents.find((x) => x.email === r.email);
    if (!doc) {
      doc = need(await call('POST', '/admin/residents', { ...r, building: RES_BUILDING.name, buildingId: RES_ID }, BT), `create resident ${r.email}`);
      log(`resident ${r.email} flat ${r.flatNo}`);
    } else log(`resident ${r.email} exists`);
    residentIds.push({ ...r, id: id(doc) || doc?.user?._id });
  }

  // 6b. Resident-app logins: admin-created residents have no password and no
  //     verified email, and the admin API cannot set those. Do it directly
  //     in Mongo when a URI is provided.
  let residentLogin = false;
  if (process.env.MONGODB_URI) {
    const mongoose = require('mongoose');
    const bcrypt = require('bcrypt');
    await mongoose.connect(process.env.MONGODB_URI);
    const hash = await bcrypt.hash(PASSWORD, 10);
    const r = await mongoose.connection.db.collection('users').updateMany(
      { email: { $in: RESIDENTS.map((x) => x.email) } },
      { $set: { password: hash, isEmailVerified: true, isApprovedByAdmin: true } },
    );
    await mongoose.disconnect();
    residentLogin = r.matchedCount > 0;
    log(`resident-app login enabled for ${r.matchedCount} residents`);
  } else {
    log('MONGODB_URI not set: resident-app logins NOT enabled (residents can still be hosts)');
  }

  // 7. Watchlist
  const wl = list(need(await call('GET', '/admin/watchlist', null, BT), 'watchlist'), 'entries');
  for (const w of WATCHLIST) {
    if (wl.find((x) => (w.phoneNumber && x.phoneNumber === w.phoneNumber.slice(-10)) || (w.idProofLast4 && x.idProofLast4 === w.idProofLast4))) continue;
    need(await call('POST', '/admin/watchlist', w, BT), 'watchlist entry');
  }
  log('watchlist: 1 block (phone +919000000999), 1 warn (ID ending 7777)');

  // 8. Visits — commercial via the public gate form (guard approves)
  const pub = async (body, label) => {
    const r = await call('POST', `/public/sites/${COM_TOK}/visits`, body);
    if (!r.ok) { log(`  (skip) ${label}: ${r.data?.message}`); return null; }
    summary.visits.push({ label, ...r.data });
    return r.data;
  };
  const meeting = await pub({ name: 'Test Visitor Meeting', phoneNumber: '+919000000301', type: 'Meeting', purpose: 'Product demo', hostCompany: 'Acme Test Pvt Ltd', hostPersonName: 'Priya Test', hostFloor: '2', hostUnit: '203', hostPhone: '+919000000401', idProofType: 'PAN', idProofLast4: '1234', consentAccepted: true }, 'Meeting (pending guard approval, gate form)');
  await pub({ name: 'Test Interview Candidate', phoneNumber: '+919000000302', type: 'Interview', hostCompany: 'Acme Test Pvt Ltd', hostPersonName: 'HR Desk', idProofType: 'Aadhaar', idProofLast4: '5678', consentAccepted: true }, 'Interview (pending)');
  const from = new Date(); const until = new Date(Date.now() + 4 * 86400000);
  await pub({ name: 'Test Contractor Lead', phoneNumber: '+919000000303', type: 'Contractor', purpose: 'HVAC maintenance', hostCompany: 'Acme Test Pvt Ltd', reference: 'WO-TEST-001', idProofType: 'Aadhaar', idProofLast4: '2222', validFrom: from.toISOString().slice(0, 10), validUntil: until.toISOString().slice(0, 10), companions: [{ name: 'Crew Member One' }, { name: 'Crew Member Two' }], consentAccepted: true, vehicleNumber: 'GJ01AB1234' }, 'Contractor 5-day pass with crew (pending)');
  await pub({ name: 'Test VIP Guest', phoneNumber: '+919000000304', type: 'VIP', hostCompany: 'Acme Test Pvt Ltd', hostPersonName: 'CEO Office', idProofType: 'Passport', idProofLast4: '9999', consentAccepted: true }, 'VIP (pending)');

  // Guard desk check-ins (already inside)
  const desk = async (body, label) => {
    const r = await call('POST', '/admin/visitors/checkin', body, GT);
    if (!r.ok) { log(`  (skip) ${label}: ${r.data?.message}`); return null; }
    summary.visits.push({ label, ...(r.data.visitor || r.data) });
    return r.data;
  };
  await desk({ name: 'Test Vendor Inside', type: 'Vendor', buildingId: COM_ID, phoneNumber: '+919000000305', purpose: 'Water dispenser service', hostCompany: 'Acme Test Pvt Ltd', idProofType: 'PAN', idProofLast4: '4321', checkInNow: true, consentAccepted: true, gate: 'Lobby Desk' }, 'Vendor (INSIDE now, desk check-in)');
  const courier = await desk({ name: 'Test Courier', type: 'Delivery', buildingId: COM_ID, phoneNumber: '+919000000306', hostCompany: 'Acme Test Pvt Ltd', reference: 'AWB-TEST-777', checkInNow: true, consentAccepted: true, parcel: { trackingNumber: 'AWB-TEST-777', recipientName: 'Priya Test', recipientCompany: 'Acme Test Pvt Ltd', recipientFloor: '2', recipientUnit: '203', storageLocation: 'Shelf A1', parcelType: 'Package' } }, 'Courier (INSIDE, parcel logged at desk)');
  if (courier?.parcel) summary.parcels.push({ label: 'Commercial parcel from courier check-in', ...courier.parcel });

  // Approve the meeting visitor so a live pass exists
  if (meeting?.passCode) {
    // The public form only returns the pass; resolve the visit id the way a guard would.
    const lookup = await call('POST', '/admin/visitors/verify-qr', { qrData: meeting.passCode }, GT);
    const v = lookup.data?.visitor || lookup.data || {};
    const vid = v._id || v.id || v.visitorId;
    const a = await call('POST', `/admin/visitors/${vid}/approve`, null, GT);
    if (a.ok) {
      log('meeting visitor approved by guard (pass active, not yet inside)');
      const row = summary.visits.find((v) => v.label.startsWith('Meeting'));
      if (row) { row.status = 'Approved'; row.label = 'Meeting (APPROVED by guard, pass active, not yet inside)'; }
    } else log(`  (skip) approve meeting: ${a.data?.message}`);
  }

  // Residential visitor expected by resident 101
  if (residentIds[0]?.id) {
    const rv = await call('POST', '/admin/visitors', { name: 'Test Guest For 101', type: 'Guest', buildingId: RES_ID, userId: residentIds[0].id, phoneNumber: '+919000000307', purpose: 'Family visit' }, BT);
    if (rv.ok) summary.visits.push({ label: 'Residential guest for flat 101 (awaiting resident approval in the resident app)', ...(rv.data.visitor || rv.data) });
    else log(`  (skip) residential guest: ${rv.data?.message}`);
  }

  // 9. Parcels — residential
  const p = await call('POST', '/admin/parcels', { trackingNumber: 'TEST-RES-001', recipientName: RESIDENTS[0].fullName, recipientPhone: RESIDENTS[0].phoneNumber, flatNumber: `${RES_BUILDING.name}-101`, buildingId: RES_ID, parcelType: 'Package', deliveryCompany: 'Test Courier Co', loggedBy: 'Seed' }, BT);
  if (p.ok) summary.parcels.push({ label: 'Residential parcel for flat 101 (pending)', ...(p.data.parcel || p.data) });
  else log(`  (skip) residential parcel: ${p.data?.message}`);

  // 10. Notice
  await call('POST', '/admin/notices', { title: 'Test notice: water supply', content: 'Water supply will be off 2–4 pm on Sunday for tank cleaning.', category: 'Maintenance', priority: 'Medium', expiryDate: new Date(Date.now() + 30 * 86400000).toISOString() }, BT);

  // ── credentials sheet ─────────────────────────────────────────────────────
  const passLink = (v) => (v.passToken ? `${DASH}/visit/pass/${v.passToken}` : '');
  const md = `# Test credentials & data

Generated ${new Date().toISOString()} against \`${API}\`.
All records are prefixed **Test** / use \`*.test.akshar\` addresses. Passwords are for testing only.

## Admin dashboard — ${DASH}/login

| Role | Email | Password | Scope |
|---|---|---|---|
| Super admin | ${SUPER_EMAIL} | (from backend .env) | all builders; use the builder switcher in the header |
| Builder admin | ${ADMINS[0].email} | ${PASSWORD} | builder "${ORG_NAME}" (both test buildings) |
| Building manager | ${ADMINS[1].email} | ${PASSWORD} | only "${COM_BUILDING.name}" |

## Guard app

| Guard | Phone (login) | Password | Site | Gate |
|---|---|---|---|---|
| ${GUARDS[0].name} | ${GUARDS[0].phoneNumber} | ${GUARD_PASSWORD} | ${RES_BUILDING.name} | ${GUARDS[0].gateNumber} |
| ${GUARDS[1].name} | ${GUARDS[1].phoneNumber} | ${GUARD_PASSWORD} | ${COM_BUILDING.name} | ${GUARDS[1].gateNumber} |

## Resident app (${RES_BUILDING.name})

| Resident | Email (login) | Password | Flat | Type |
|---|---|---|---|---|
${RESIDENTS.map((r) => `| ${r.fullName} | ${r.email} | ${residentLogin ? PASSWORD : '— (run with MONGODB_URI to enable)'} | ${r.flatNo} | ${r.residentType} |`).join('\n')}

${residentLogin ? '' : '> Resident-app login was not enabled because MONGODB_URI was not provided. Residents still work as hosts for visitor approval.\n'}
## Sites

| Site | Type | ID | Gate QR link (visitor self-registration) |
|---|---|---|---|
| ${RES_BUILDING.name} | residential (apartment, 3 floors × 4) | ${RES_ID} | ${DASH}/visit/${RES_TOK} |
| ${COM_BUILDING.name} | commercial (IT park, 3 floors × 4, guard approves) | ${COM_ID} | ${DASH}/visit/${COM_TOK} |

Kiosk mode for the lobby tablet: append \`?kiosk=1\` to the commercial link.

Commercial rules applied: all 14 visit types, operating hours 08:00–20:00 every day (after-hours flagged for the guard), capacity 100, terms/NDA consent required, multi-day passes up to 30 days, overstay alerts on, ID required, photo **not** required (turn on in Site Mode once S3 is configured).

## Watchlist (commercial)

| Kind | Match | Expected behaviour |
|---|---|---|
| Block | phone +919000000999 | gate form refused; desk check-in and entry refused |
| Warn | ID ending 7777 | desk shows warning; guard must confirm "Admit anyway" |

## Visits created

| Scenario | Visitor | Status | Pass code | Pass link |
|---|---|---|---|---|
${summary.visits.map((v) => `| ${v.label} | ${v.name || ''} | ${v.status || ''} | ${v.passCode || ''} | ${passLink(v)} |`).join('\n')}

## Parcels created

| Scenario | Tracking | Recipient | Status |
|---|---|---|---|
${summary.parcels.map((p) => `| ${p.label} | ${p.trackingNumber || ''} | ${p.recipientName || ''} | ${p.status || ''} |`).join('\n')}

## Suggested test walk-through

1. **Dashboard** → log in as builder admin → Buildings → "${COM_BUILDING.name}" → Site mode: change rules, save. Gate QR → print/copy the visitor link.
2. **Visitor** → open the commercial gate link on a phone → pick a type (try Contractor for multi-day + crew, Food delivery for the minimal form) → accept terms → get the pass code.
3. **Guard app** → log in as ${GUARDS[1].phoneNumber} → Approvals: approve or reject the pending visits → Scan the pass QR / enter the 6-char code → Entry → Exit. Try the watchlist phone at the desk (blocked) and ID 7777 (warning + override).
4. **Inside Now** page and **Visitors** page (badges: VIP, watchlist, after-hours, validity window; CSV export; invite link).
5. **Parcels** → collect the commercial parcel (collector phone + ID digits) and the flat-101 parcel.
6. **Resident app** → log in as resident1@test.akshar → approve the pending guest for flat 101 and read the notice; create your own visitor and approve/reject one that the guard registers for flat 101.
7. **Admin Users / Builders** (super admin only) → switch builder in the header; the manager account must see only the commercial site.

## Cleanup

Delete anything named "Test …" / "*.test.akshar" from the dashboard, or drop the documents by those names in Mongo. Re-running the seed re-uses existing accounts and adds fresh visits/parcels.
`;
  fs.writeFileSync(OUT, md);
  console.log(`\n✔ Seed complete. Credentials written to ${OUT}`);
})().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});
