#!/bin/bash
# Company accounts (commercial offices) — end-to-end smoke test.
#
#   API=http://127.0.0.1:5099/v1 bash backend/smoke-company.sh
#
# Walks admin -> company -> owner/HR -> employees -> gate pass -> visitors ->
# cross-company isolation -> leaver. It asserts exact counts, so run it against
# a SCRATCH database, not a real one. ADMIN_EMAIL / ADMIN_PASSWORD default to
# the bootstrap super admin of a local dev API.
set -u
API=${API:-http://127.0.0.1:5099/v1}
ADMIN_EMAIL=${ADMIN_EMAIL:-smoke@test.local}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Smoke@1234}
FAILED=
j() { python3 -c "import sys,json;d=json.load(sys.stdin);
import functools
p='$1'.split('.')
v=d
for k in p:
  if k=='': continue
  v = v[int(k)] if k.isdigit() else v.get(k)
  if v is None: break
print(v if not isinstance(v,(dict,list)) else json.dumps(v))"; }
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()  { printf '  ✅ %s\n' "$1"; }
bad() { printf '  ❌ %s\n' "$1"; FAILED=1; }

# ---- admin login
TOKEN=$(curl -s -X POST $API/admin/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | j token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "None" ] && ok "admin logged in" || { bad "admin login failed"; exit 1; }
A=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

say "0. A builder (tenant) to own everything"
ORG=$(curl -s -X POST $API/admin/organizations "${A[@]}" -d '{"name":"Smoke Builder"}')
OID=$(echo "$ORG" | j id); [ -z "$OID" ] || [ "$OID" = "None" ] && OID=$(echo "$ORG" | j _id)
[ -n "$OID" ] && [ "$OID" != "None" ] && ok "builder created ($OID)" || bad "org: $ORG"
A+=(-H "X-Organization-Id: $OID")

say "1. A commercial building"
BLD=$(curl -s -X POST $API/buildings "${A[@]}" -d "{
  \"name\":\"Smoke Business Park\",\"address\":\"1 Test Road\",\"propertyType\":\"it_park\",
  \"organizationId\":\"$OID\",\"totalFloors\":2,\"flatsPerFloor\":2}")
BID=$(echo "$BLD" | j _id); [ -z "$BID" ] && BID=$(echo "$BLD" | j id)
SITE=$(echo "$BLD" | j siteType)
[ "$SITE" = "commercial" ] && ok "building is commercial ($BID)" || bad "siteType=$SITE"

say "2. Admin creates the company"
CO=$(curl -s -X POST $API/admin/companies "${A[@]}" -d "{
  \"name\":\"Acme Pvt Ltd\",\"buildingId\":\"$BID\",\"floor\":\"4\",\"units\":[\"401\",\"402\"]}")
CID=$(echo "$CO" | j id)
[ -n "$CID" ] && [ "$CID" != "None" ] && ok "company created ($CID)" || bad "company: $CO"

DUP=$(curl -s -X POST $API/admin/companies "${A[@]}" -d "{\"name\":\"acme pvt ltd\",\"buildingId\":\"$BID\"}" | j message)
case "$DUP" in *already*) ok "duplicate name refused";; *) bad "duplicate allowed: $DUP";; esac

say "3. Admin creates the boss and HR accounts"
BOSS=$(curl -s -X POST $API/admin/companies/$CID/members "${A[@]}" -d '{
  "fullName":"Ravi Boss","email":"boss@acme.test","password":"Boss@1234","companyRole":"boss"}')
BOSS_ID=$(echo "$BOSS" | j id)
[ -n "$BOSS_ID" ] && [ "$BOSS_ID" != "None" ] && ok "boss created" || bad "boss: $BOSS"
HR=$(curl -s -X POST $API/admin/companies/$CID/members "${A[@]}" -d '{
  "fullName":"Priya HR","email":"hr@acme.test","password":"Hr@12345","companyRole":"hr"}')
HR_ID=$(echo "$HR" | j id)
[ -n "$HR_ID" ] && [ "$HR_ID" != "None" ] && ok "HR created" || bad "hr: $HR"

say "4. HR logs into the user app"
HRLOGIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hr@acme.test","password":"Hr@12345"}')
HRT=$(echo "$HRLOGIN" | j accessToken)
[ -n "$HRT" ] && [ "$HRT" != "None" ] && ok "HR signed in" || bad "hr login: $HRLOGIN"
H=(-H "Authorization: Bearer $HRT" -H 'Content-Type: application/json')
ME=$(curl -s $API/company/me "${H[@]}")
[ "$(echo "$ME" | j company.name)" = "Acme Pvt Ltd" ] && ok "GET /company/me → Acme Pvt Ltd" || bad "me: $ME"
[ "$(echo "$ME" | j permissions.manageTeam)" = "True" ] && ok "HR may manage the team" || bad "manageTeam false"
[ "$(echo "$ME" | j permissions.manageManagers)" = "False" ] && ok "HR may NOT appoint owners/HR" || bad "manageManagers true for HR"

say "5. HR adds employees"
for n in 1 2 3; do
  E=$(curl -s -X POST $API/company/employees "${H[@]}" -d "{
    \"fullName\":\"Employee $n\",\"email\":\"emp$n@acme.test\",\"password\":\"Emp@1234\",
    \"designation\":\"Engineer\",\"employeeCode\":\"AC-00$n\"}")
  EID=$(echo "$E" | j id)
  [ "$n" = "1" ] && EMP1=$EID
  [ -n "$EID" ] && [ "$EID" != "None" ] && ok "employee $n created (pass $(echo "$E" | j pass.passCode))" || bad "employee $n: $E"
done
COUNT=$(curl -s "$API/company/employees" "${H[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$COUNT" = "5" ] && ok "team lists 5 accounts (boss + HR + 3)" || bad "team count=$COUNT"

say "6. HR cannot appoint another HR (owner-only)"
ESC=$(curl -s -X POST $API/company/employees "${H[@]}" -d '{
  "fullName":"Sneaky HR","email":"sneaky@acme.test","companyRole":"hr"}' | j message)
case "$ESC" in *owner*) ok "refused: $ESC";; *) bad "HR escalated: $ESC";; esac

say "7. Employee signs in, sees only themselves"
ET=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"emp1@acme.test","password":"Emp@1234"}' | j accessToken)
[ -n "$ET" ] && [ "$ET" != "None" ] && ok "employee signed in" || bad "employee login failed"
E=(-H "Authorization: Bearer $ET" -H 'Content-Type: application/json')
TEAM=$(curl -s -o /dev/null -w '%{http_code}' $API/company/employees "${E[@]}")
[ "$TEAM" = "403" ] && ok "employee blocked from the team list (403)" || bad "employee saw team: $TEAM"
PASS=$(curl -s $API/company/pass "${E[@]}")
PCODE=$(echo "$PASS" | j passCode); QR=$(echo "$PASS" | j qrPayload)
[ -n "$PCODE" ] && [ "$PCODE" != "None" ] && ok "employee pass: $PCODE" || bad "pass: $PASS"
[ "$(echo "$PASS" | j status)" = "Outside" ] && ok "starts Outside" || bad "status wrong"

say "8. Guard scans the employee in and out"
SCAN=$(curl -s -X POST $API/admin/visitors/verify-qr "${A[@]}" -d "{\"qrData\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$QR")}")
[ "$(echo "$SCAN" | j kind)" = "employee" ] && ok "QR resolves as an employee card" || bad "scan: $SCAN"
[ "$(echo "$SCAN" | j employee.companyName)" = "Acme Pvt Ltd" ] && ok "card shows the company" || bad "no company on card"
[ "$(echo "$SCAN" | j canCheckIn)" = "True" ] && ok "canCheckIn true" || bad "canCheckIn false"
IN=$(curl -s -X POST $API/admin/employees/$EMP1/entry "${A[@]}" -d '{"gate":"Lobby"}')
[ "$(echo "$IN" | j status)" = "Inside" ] && ok "checked in" || bad "entry: $IN"
AGAIN=$(curl -s -X POST $API/admin/employees/$EMP1/entry "${A[@]}" -d '{}' | j message)
case "$AGAIN" in *already\ inside*) ok "second entry refused: $AGAIN";; *) bad "double entry: $AGAIN";; esac
INSIDE=$(curl -s "$API/admin/employees/inside?buildingId=$BID" "${A[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$INSIDE" = "1" ] && ok "roll-call shows 1 employee inside" || bad "inside=$INSIDE"
CODE_LOOKUP=$(curl -s $API/admin/visitors/lookup/$PCODE "${A[@]}" | j kind)
[ "$CODE_LOOKUP" = "employee" ] && ok "typed short code resolves too" || bad "code lookup: $CODE_LOOKUP"
OUT=$(curl -s -X POST $API/admin/employees/$EMP1/exit "${A[@]}" -d '{"gate":"Lobby"}')
[ "$(echo "$OUT" | j status)" = "Outside" ] && ok "checked out" || bad "exit: $OUT"

say "9. Employee invites their own visitor"
INV=$(curl -s -X POST $API/company/visitors "${E[@]}" -d '{
  "name":"Ramesh Guest","type":"Meeting","phoneNumber":"9800000001","purpose":"Demo"}')
VSTATUS=$(echo "$INV" | j status); VCODE=$(echo "$INV" | j passCode)
[ "$VSTATUS" = "Approved" ] && ok "invite is pre-approved (pass $VCODE)" || bad "invite status=$VSTATUS: $INV"
[ "$(echo "$INV" | j hostPersonName)" = "Employee 1" ] && ok "host is the employee" || bad "host wrong"
[ "$(echo "$INV" | j hostCompany)" = "Acme Pvt Ltd" ] && ok "company carried onto the visit" || bad "company missing"
MINE=$(curl -s $API/company/visitors "${E[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$MINE" = "1" ] && ok "employee sees their 1 visitor" || bad "mine=$MINE"
ALL=$(curl -s "$API/company/visitors?scope=company" "${H[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$ALL" = "1" ] && ok "HR sees the company's visitors" || bad "company scope=$ALL"

say "10. Cross-company isolation"
CO2=$(curl -s -X POST $API/admin/companies "${A[@]}" -d "{\"name\":\"Rival Ltd\",\"buildingId\":\"$BID\",\"floor\":\"5\"}" | j id)
R=$(curl -s -X POST $API/admin/companies/$CO2/members "${A[@]}" -d '{
  "fullName":"Rival HR","email":"hr@rival.test","password":"Riv@1234","companyRole":"hr"}' | j id)
RT=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hr@rival.test","password":"Riv@1234"}' | j accessToken)
RH=(-H "Authorization: Bearer $RT" -H 'Content-Type: application/json')
RTEAM=$(curl -s $API/company/employees "${RH[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$RTEAM" = "1" ] && ok "rival HR sees only their own 1 account" || bad "rival saw $RTEAM accounts"
PEEK=$(curl -s -o /dev/null -w '%{http_code}' $API/company/employees/$EMP1 "${RH[@]}")
[ "$PEEK" = "404" ] && ok "rival gets 404 on Acme's employee (no 403 leak)" || bad "cross-company read: $PEEK"
RVIS=$(curl -s "$API/company/visitors?scope=company" "${RH[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$RVIS" = "0" ] && ok "rival sees none of Acme's visitors" || bad "rival saw $RVIS visitors"

say "11. Deactivating a leaver kills the pass"
curl -s -X POST $API/admin/employees/$EMP1/entry "${A[@]}" -d '{}' > /dev/null
DEL=$(curl -s -X DELETE $API/company/employees/$EMP1 "${H[@]}" | j message)
ok "deactivated: $DEL"
RESCAN=$(curl -s -X POST $API/admin/visitors/verify-qr "${A[@]}" -d "{\"qrData\":$(python3 -c "import json,sys;print(json.dumps(sys.argv[1]))" "$QR")}")
[ "$(echo "$RESCAN" | j isValid)" = "False" ] && ok "pass refused: $(echo "$RESCAN" | j reason)" || bad "revoked pass still valid"
REENTRY=$(curl -s -X POST $API/admin/employees/$EMP1/entry "${A[@]}" -d '{}' | j message)
case "$REENTRY" in *deactivated*) ok "entry refused: $REENTRY";; *) bad "leaver entered: $REENTRY";; esac
STILL=$(curl -s "$API/admin/employees/inside?buildingId=$BID" "${A[@]}" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
[ "$STILL" = "0" ] && ok "attendance closed — not left 'inside' forever" || bad "still inside=$STILL"
RELOGIN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"emp1@acme.test","password":"Emp@1234"}' | j message)
case "$RELOGIN" in *deactivated*) ok "leaver cannot sign in: $RELOGIN";; *) bad "leaver logged in: $RELOGIN";; esac

say "12. Residential sites are untouched"
RES=$(curl -s -X POST $API/buildings "${A[@]}" -d "{\"name\":\"Smoke Heights\",\"address\":\"2 Test Road\",\"propertyType\":\"apartment\",\"organizationId\":\"$OID\",\"totalFloors\":1,\"flatsPerFloor\":2}" | j _id)
NOCO=$(curl -s -X POST $API/admin/companies "${A[@]}" -d "{\"name\":\"Nope Ltd\",\"buildingId\":\"$RES\"}" | j message)
case "$NOCO" in *residential*) ok "company refused on a residential site";; *) bad "allowed: $NOCO";; esac

printf '\n'
if [ -n "$FAILED" ]; then
  printf '\033[31mSOME CHECKS FAILED\033[0m\n'; exit 1
fi
printf '\033[32mALL CHECKS PASSED\033[0m\n'
