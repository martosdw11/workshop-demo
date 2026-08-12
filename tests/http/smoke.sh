#!/usr/bin/env bash
#
# Smoke test alur inti lewat curl — TDD §11.4.
#
# Menjalankan alur lengkap end-to-end terhadap server yang sedang hidup:
#   register → login → (admin) create event + materi + publish →
#   (peserta) katalog → enroll → submit respons → complete → finish → view result
#
# Pemakaian:
#   npm run dev                      # terminal lain
#   bash tests/http/smoke.sh         # default http://localhost:3000
#   BASE=https://staging.example.com bash tests/http/smoke.sh
#
# Keluar dengan status bukan-nol bila ada ketidaksesuaian, sehingga bisa dipakai
# sebagai langkah CI setelah deploy.
#
# PENTING — batas registrasi 3/jam/IP (TDD §9.3) berlaku juga untuk skrip ini,
# dan rate limit dievaluasi SEBELUM validasi sehingga percobaan berpayload salah
# pun memakai kuota. Skrip melakukan tepat 3 percobaan register, jadi satu kali
# jalan per jam per IP aman. Untuk menjalankannya berulang saat development:
#   psql "$DATABASE_URL" -c "DELETE FROM rate_limits"
#
# CATATAN GAYA: setiap payload JSON ditaruh di variabel tersendiri, TIDAK
# disisipkan sebagai argumen ber-escape di dalam `$( )`. Bentuk bersarang itu
# mudah pecah menjadi banyak argumen dan menghasilkan kegagalan yang terlihat
# seperti bug server padahal berasal dari skripnya sendiri.

set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
API="$BASE/api/v1"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@learningstudy.ai}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Admin12345}"

STAMP="$(date +%s)"
PARTICIPANT_EMAIL="smoke${STAMP}@example.com"
PARTICIPANT_PHONE="08123${STAMP: -6}"
PARTICIPANT_PASSWORD="rahasia123"

ADMIN_JAR="$(mktemp)"
USER_JAR="$(mktemp)"
BODY="$(mktemp)"
export BODY
trap 'rm -f "$ADMIN_JAR" "$USER_JAR" "$BODY"' EXIT

PASS=0
FAIL=0
STATUS=''

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
okmark() { printf '  \033[32m✔\033[0m %-56s %s\n' "$1" "${2:-}"; PASS=$((PASS + 1)); }
nomark() { printf '  \033[31m✖\033[0m %-56s %s\n' "$1" "${2:-}"; FAIL=$((FAIL + 1)); }

# call <jar> <method> <path> [json] → mengisi $BODY dan menyetel $STATUS
call() {
  local jar="$1" method="$2" path="$3" data="${4:-}"
  if [ -n "$data" ]; then
    STATUS="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" "$API$path" -H 'Content-Type: application/json' -d "$data")"
  else
    STATUS="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" "$API$path")"
  fi
}

# jget <jalur.bertitik> — membaca nilai dari $BODY tanpa dependensi jq.
jget() {
  python3 - "$1" <<'PY'
import json, os, sys
try:
    with open(os.environ['BODY']) as handle:
        node = json.load(handle)
    for key in sys.argv[1].split('.'):
        node = node[int(key)] if key.isdigit() else node[key]
    print(node)
except Exception:
    print('')
PY
}

errcode() { jget 'error.code'; }

expect() {
  if [ "$2" = "$STATUS" ]; then
    okmark "$1" "$STATUS"
  else
    nomark "$1" "harap $2, dapat $STATUS"
    printf '      %s\n' "$(head -c 240 "$BODY")"
  fi
}

expect_code() {
  local got
  got="$(errcode)"
  if [ "$2" = "$STATUS" ] && [ "$3" = "$got" ]; then
    okmark "$1" "$STATUS $got"
  else
    nomark "$1" "harap $2/$3, dapat $STATUS/$got"
  fi
}

expect_value() {
  if [ "$2" = "$3" ]; then okmark "$1" "$3"; else nomark "$1" "harap $2, dapat $3"; fi
}

###############################################################################
bold "0. Health (TDD §11.1)"
call "$ADMIN_JAR" GET /health
expect "GET /health" 200

###############################################################################
bold "1. Auth (TDD §3.2)"

PAYLOAD='{"name":"A","email":"bukan-email","phone":"08","password":"lemah"}'
call "$USER_JAR" POST /auth/register "$PAYLOAD"
expect_code "register payload salah" 422 VALIDATION_ERROR

if [ "$(errcode)" = "RATE_LIMITED" ]; then
  printf '\n\033[31mKuota registrasi 3/jam/IP sudah habis.\033[0m Kosongkan lalu ulangi:\n'
  printf '  psql "$DATABASE_URL" -c "DELETE FROM rate_limits"\n\n'
  exit 2
fi

PAYLOAD=$(printf '{"name":"Smoke Test","email":"%s","phone":"%s","password":"%s","role":"admin"}' \
  "$PARTICIPANT_EMAIL" "$PARTICIPANT_PHONE" "$PARTICIPANT_PASSWORD")
call "$USER_JAR" POST /auth/register "$PAYLOAD"
expect "register peserta" 201
expect_value "field role dari body diabaikan (§5.3)" "participant" "$(jget 'data.user.role')"
expect_value "phone dinormalkan ke E.164 (A-12)" "+628123${STAMP: -6}" "$(jget 'data.user.phone')"

PAYLOAD=$(printf '{"name":"Kembar","email":"%s","phone":"081299%s","password":"%s"}' \
  "$PARTICIPANT_EMAIL" "${STAMP: -5}" "$PARTICIPANT_PASSWORD")
call "$USER_JAR" POST /auth/register "$PAYLOAD"
expect_code "register email duplikat (dari UNIQUE)" 409 EMAIL_TAKEN

PAYLOAD=$(printf '{"email":"%s","password":"salahsekali9"}' "$PARTICIPANT_EMAIL")
call "$USER_JAR" POST /auth/login "$PAYLOAD"
expect_code "login password salah" 401 INVALID_CREDENTIALS

PAYLOAD=$(printf '{"email":"%s","password":"%s","rememberMe":true}' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
call "$ADMIN_JAR" POST /auth/login "$PAYLOAD"
expect "login admin (Remember me)" 200

call "$ADMIN_JAR" GET /auth/me
expect "GET /auth/me" 200
ADMIN_ID="$(jget 'data.id')"

###############################################################################
bold "2. Admin — Event Builder & kurikulum (TDD §3.4)"

PAYLOAD='{"title":"Smoke Event","description":"uji backend","startAt":"2026-08-13T01:00:00.000Z","endAt":"2026-12-13T10:00:00.000Z","quota":150}'
call "$ADMIN_JAR" POST /admin/events "$PAYLOAD"
expect "create event" 201
EVENT_ID="$(jget 'data.event.id')"
expect_value "event lahir sebagai draft" "draft" "$(jget 'data.event.status')"

call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/publish" '{"status":"published"}'
expect_code "publish tanpa materi" 422 EVENT_HAS_NO_MATERIAL

PAYLOAD='{"parentId":null,"title":"Modul 1","points":20,"contentJson":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Isi modul"}]}]}}'
call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" "$PAYLOAD"
expect "tambah Modul 1" 201
M1="$(jget 'data.material.id')"

PAYLOAD=$(printf '{"parentId":%s,"title":"Lesson 1.1","points":50,"contentJson":null}' "$M1")
call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" "$PAYLOAD"
expect "tambah Lesson 1.1 (sub-materi)" 201
L11="$(jget 'data.material.id')"

PAYLOAD=$(printf '{"parentId":%s,"title":"Sub dari sub","points":10}' "$L11")
call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" "$PAYLOAD"
expect_code "sub-materi bertingkat (batas 2 level)" 422 MAX_DEPTH_EXCEEDED

call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" '{"parentId":null,"title":"Minus","points":-5}'
expect_code "poin negatif" 422 VALIDATION_ERROR

call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" '{"parentId":null,"title":"Modul 2","points":30,"contentJson":null}'
expect "tambah Modul 2" 201
M2="$(jget 'data.material.id')"

# Sanitasi server-side (§8.4): href javascript:, hotlink gambar, dan node di luar
# whitelist harus hilang dari `content_html`.
PAYLOAD='{"parentId":null,"title":"Uji sanitasi","points":0,"contentJson":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}],"text":"klik"}]},{"type":"image","attrs":{"src":"https://pelacak.example.com/beacon.png"}},{"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"terlarang"}]}]}]}}'
call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/materials" "$PAYLOAD"
XSS_ID="$(jget 'data.material.id')"
HTML="$(jget 'data.material.contentHtml')"
case "$HTML" in
  *javascript:* | *pelacak.example.com* | *blockquote*) nomark "sanitasi XSS server-side (§8.4)" "$HTML" ;;
  *) okmark "sanitasi XSS server-side (§8.4)" "bersih" ;;
esac

call "$ADMIN_JAR" DELETE "/admin/materials/$XSS_ID"
expect "hapus materi tanpa progres" 204

call "$ADMIN_JAR" GET "/admin/events/$EVENT_ID/materials"
SEQ="$(python3 - <<'PY'
import json, os
d = json.load(open(os.environ['BODY']))['data']
def flat(n):
    return [n['sequenceIndex']] + [s for c in n['children'] for s in flat(c)]
print(','.join(str(s) for n in d['tree'] for s in flat(n)), d['materialCount'], d['totalPoints'])
PY
)"
expect_value "sequence_index / material_count / total_points" "1,2,3 3 100" "$SEQ"

PAYLOAD=$(printf '{"items":[{"id":%s,"parentId":null,"orderIndex":0}]}' "$M1")
call "$ADMIN_JAR" PATCH "/admin/events/$EVENT_ID/materials/reorder" "$PAYLOAD"
expect_code "reorder dengan daftar basi" 409 STALE_TREE

PAYLOAD=$(printf '{"items":[{"id":%s,"parentId":null,"orderIndex":0},{"id":%s,"parentId":%s,"orderIndex":0},{"id":%s,"parentId":null,"orderIndex":1}]}' "$M2" "$L11" "$M2" "$M1")
call "$ADMIN_JAR" PATCH "/admin/events/$EVENT_ID/materials/reorder" "$PAYLOAD"
expect "reorder seluruh tree" 200

PAYLOAD=$(printf '{"items":[{"id":%s,"parentId":null,"orderIndex":0},{"id":%s,"parentId":%s,"orderIndex":0},{"id":%s,"parentId":null,"orderIndex":1}]}' "$M1" "$L11" "$M1" "$M2")
call "$ADMIN_JAR" PATCH "/admin/events/$EVENT_ID/materials/reorder" "$PAYLOAD"
expect "kembalikan urutan semula" 200

call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/publish" '{"status":"published"}'
expect "publish" 200

call "$ADMIN_JAR" PATCH "/admin/events/$EVENT_ID" '{"startAt":"2026-08-20T01:00:00.000Z"}'
expect_code "ubah startAt setelah publish (A-B05)" 403 EVENT_PUBLISHED_IMMUTABLE_FIELD

call "$ADMIN_JAR" PATCH "/admin/events/$EVENT_ID" '{"title":"Smoke Event (revisi)"}'
expect "ubah judul setelah publish" 200

###############################################################################
bold "3. Peserta — Katalog & Join (TDD §4.2)"

PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$PARTICIPANT_EMAIL" "$PARTICIPANT_PASSWORD")
call "$USER_JAR" POST /auth/login "$PAYLOAD"
expect "login peserta" 200

call "$USER_JAR" GET "/events?status=all&limit=12"
expect "katalog (cache 30 detik)" 200

call "$USER_JAR" GET "/events?status=upcoming&q=Smoke&limit=12"
expect "katalog dengan filter & pencarian" 200

call "$USER_JAR" GET "/events/$EVENT_ID"
expect "detail event (+myEnrollment)" 200

call "$USER_JAR" POST "/events/$EVENT_ID/enroll"
expect "enroll" 201
ENROLLMENT_ID="$(jget 'data.enrollment.id')"

call "$USER_JAR" POST "/events/$EVENT_ID/enroll"
expect_code "enroll kedua (idempotensi §4.4)" 409 ALREADY_ENROLLED
RESUME="$(jget 'error.details.resumeUrl')"
if [ -n "$RESUME" ]; then
  okmark "409 menyertakan details.resumeUrl (§3.5)" "$RESUME"
else
  nomark "409 menyertakan details.resumeUrl (§3.5)" "kosong"
fi

###############################################################################
bold "4. Learning Player & Scoring Engine (TDD §4.3)"

call "$USER_JAR" GET "/enrollments/$ENROLLMENT_ID"
expect "learning path" 200

call "$USER_JAR" GET "/materials/$M1"
expect "materi pertama terbuka" 200

call "$USER_JAR" GET "/materials/$M2"
expect_code "materi belum tercapai" 403 MATERIAL_LOCKED

call "$USER_JAR" POST "/materials/$M1/responses" '{"type":"comment","content":"Komentar saja."}'
expect "kirim comment" 201

call "$USER_JAR" POST "/materials/$M1/responses" '{"type":"issue","content":"Ada kendala di bagian ini."}'
expect "kirim issue" 201
expect_value "issueStatus otomatis open" "open" "$(jget 'data.response.issueStatus')"

call "$USER_JAR" POST "/materials/$M1/responses" '{"type":"answer","content":"   "}'
expect_code "konten hanya spasi" 422 VALIDATION_ERROR

call "$USER_JAR" POST "/materials/$M1/complete"
expect_value "complete tanpa answer → reason" "NO_ANSWER_RESPONSE" "$(jget 'data.reason')"
expect_value "complete tanpa answer → poin" "0" "$(jget 'data.pointsEarned')"

call "$USER_JAR" POST "/materials/$L11/responses" '{"type":"answer","content":"Perbedaannya pada ketersediaan label data."}'
expect "kirim answer" 201
expect_value "materialWillEarnPoints (§3.5)" "True" "$(jget 'data.materialWillEarnPoints')"

call "$USER_JAR" GET "/materials/$L11/responses?type=answer&limit=20"
expect "timeline respons (cursor 20)" 200

call "$USER_JAR" POST "/materials/$L11/complete"
expect_value "complete dengan answer → reason" "ANSWER_PRESENT" "$(jget 'data.reason')"
expect_value "complete dengan answer → poin penuh" "50" "$(jget 'data.pointsEarned')"

call "$USER_JAR" POST "/materials/$L11/complete"
expect_value "complete ulang → reason" "ALREADY_COMPLETED" "$(jget 'data.reason')"
expect_value "complete ulang → poin tidak dobel" "50" "$(jget 'data.enrollment.totalPoints')"

call "$USER_JAR" POST "/enrollments/$ENROLLMENT_ID/finish"
expect_code "finish sebelum materi terakhir" 403 NOT_AT_LAST_MATERIAL

call "$USER_JAR" POST "/materials/$M2/complete"
expect "complete materi terakhir" 200
expect_value "isLast pada materi terakhir" "True" "$(jget 'data.isLast')"

call "$USER_JAR" POST "/enrollments/$ENROLLMENT_ID/finish"
expect "finish" 200
COMPLETED_AT="$(jget 'data.enrollment.completedAt')"

call "$USER_JAR" POST "/enrollments/$ENROLLMENT_ID/finish"
expect_value "finish idempoten (completedAt tetap)" "$COMPLETED_AT" "$(jget 'data.enrollment.completedAt')"

call "$USER_JAR" POST "/materials/$L11/responses" '{"type":"comment","content":"Masih boleh?"}'
expect_code "respons setelah finish (read-only §4.5)" 403 ENROLLMENT_COMPLETED

call "$USER_JAR" GET "/materials/$L11/responses"
expect "timeline tetap terbaca setelah finish" 200

call "$USER_JAR" GET "/materials/$L11"
expect_value "materi menjadi read-only" "True" "$(jget 'data.isReadOnly')"

call "$USER_JAR" GET /me/dashboard
expect "dashboard peserta (4 KPI)" 200
expect_value "KPI completedEvents" "1" "$(jget 'data.kpi.completedEvents')"

###############################################################################
bold "5. Admin — Monitoring (TDD §7)"

call "$ADMIN_JAR" GET "/admin/dashboard/kpi?period=30d"
expect "KPI dashboard" 200

call "$ADMIN_JAR" GET "/admin/dashboard/pipeline?period=30d"
expect "event pipeline (Completed/In Progress/Stalled)" 200

call "$ADMIN_JAR" GET "/admin/events/$EVENT_ID/pipeline/materials"
expect "drill-down per materi" 200

call "$ADMIN_JAR" GET "/admin/activity?limit=20"
expect "recent activity feed" 200

call "$ADMIN_JAR" GET "/admin/events/$EVENT_ID/participants?limit=25"
expect "matriks peserta × materi" 200

call "$ADMIN_JAR" GET "/admin/events/$EVENT_ID/responses?type=issue&issueStatus=open&limit=25"
expect "respons event (filter issue open)" 200
RESPONSE_ID="$(jget 'data.items.0.id')"

call "$ADMIN_JAR" PATCH "/admin/responses/$RESPONSE_ID/issue-status" '{"issueStatus":"resolved"}'
expect "tandai issue resolved" 200

call "$ADMIN_JAR" GET "/admin/events/$EVENT_ID/responses?type=comment&limit=1"
COMMENT_ID="$(jget 'data.items.0.id')"
call "$ADMIN_JAR" PATCH "/admin/responses/$COMMENT_ID/issue-status" '{"issueStatus":"resolved"}'
expect_code "issue-status pada respons non-issue" 422 NOT_AN_ISSUE

###############################################################################
bold "6. Admin — Peserta & User Access (TDD §3.4, §5.3)"

# Dicari dengan EMAIL uniknya, bukan namanya: nama "Smoke Test" bisa dipakai
# beberapa kali oleh run sebelumnya, dan daftar diurutkan id menaik sehingga
# pencarian per-nama akan menunjuk peserta dari run yang lama.
call "$ADMIN_JAR" GET "/admin/participants?q=$PARTICIPANT_EMAIL&limit=10"
expect "participant list (cari per email)" 200
TARGET_ID="$(jget 'data.items.0.user.id')"

call "$ADMIN_JAR" GET "/admin/participants/$TARGET_ID"
expect "detail peserta" 200

call "$ADMIN_JAR" GET "/admin/participants/$TARGET_ID/events/$EVENT_ID"
expect "drill-down peserta × event" 200

call "$ADMIN_JAR" PATCH "/admin/users/$ADMIN_ID/role" '{"role":"participant"}'
expect_code "admin mengubah peran dirinya sendiri" 403 CANNOT_DEMOTE_SELF

call "$ADMIN_JAR" PATCH "/admin/users/$TARGET_ID/role" '{"role":"admin"}'
expect "naikkan peserta menjadi admin" 200

call "$ADMIN_JAR" PATCH "/admin/users/$TARGET_ID/role" '{"role":"participant"}'
expect "turunkan kembali menjadi peserta" 200

call "$ADMIN_JAR" PATCH "/admin/users/$TARGET_ID/status" '{"status":"inactive"}'
expect "nonaktifkan akun (sesi ikut dicabut §5.3)" 200

call "$USER_JAR" GET /auth/me
expect_code "cookie lama setelah akun dinonaktifkan" 401 UNAUTHENTICATED

call "$ADMIN_JAR" PATCH "/admin/users/$TARGET_ID/status" '{"status":"active"}'
expect "aktifkan kembali" 200

call "$ADMIN_JAR" POST "/admin/users/$TARGET_ID/reset-password"
expect "reset password (tampil sekali, A-09)" 200
TEMP_PASSWORD="$(jget 'data.temporaryPassword')"

PAYLOAD=$(printf '{"email":"%s","password":"%s"}' "$PARTICIPANT_EMAIL" "$TEMP_PASSWORD")
call "$USER_JAR" POST /auth/login "$PAYLOAD"
expect "login dengan password sementara" 200

###############################################################################
bold "7. Guard penghapusan & RBAC (TDD §4.6, §5.3)"

call "$ADMIN_JAR" DELETE "/admin/materials/$L11"
expect_code "hapus materi yang sudah dikerjakan" 409 MATERIAL_HAS_PROGRESS

call "$ADMIN_JAR" POST "/admin/events/$EVENT_ID/publish" '{"status":"draft"}'
expect_code "unpublish event berpeserta" 409 CANNOT_UNPUBLISH_WITH_ENROLLMENTS

call "$ADMIN_JAR" DELETE "/admin/events/$EVENT_ID"
expect_code "hapus event berpeserta" 409 EVENT_HAS_ENROLLMENTS

call "$USER_JAR" GET /admin/events
expect_code "peserta mengakses /admin" 403 FORBIDDEN

call "$USER_JAR" POST /auth/logout
expect "logout" 204

call "$USER_JAR" GET /auth/me
expect_code "akses setelah logout" 401 UNAUTHENTICATED

###############################################################################
bold "Ringkasan"
printf '  lulus: %s   gagal: %s\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
