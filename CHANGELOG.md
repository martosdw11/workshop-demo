# Changelog

Semua perubahan yang dirilis ke production dicatat di file ini, per versi.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/)
dan penomoran mengikuti [Semantic Versioning](https://semver.org/lang/id/)
(`MAJOR.MINOR.PATCH`).

**Alur rilis:** setiap push ke `main` men-deploy production lewat Vercel Git
Integration. Sebelum push rilis: (1) naikkan `version` di `package.json`,
(2) tambahkan entri versi tersebut di file ini. Setelah CI hijau, job `release`
di GitHub Actions otomatis membuat git tag `v<versi>` + GitHub Release dengan
catatan diambil dari entri file ini, sehingga setiap deploy production selalu
punya versi dan riwayat perubahan yang terekam. Versi yang sedang berjalan bisa
dicek di `GET /api/v1/health` (field `version`).

## [Belum dirilis]

### Changed

- **Composer respons (peserta):** input jawaban/komentar/issue di Learning
  Player kini rich editor (TipTap) — bold, italic, daftar, tautan, kode, blok
  kode, dan gambar via URL (https, kebijakan `src` sama dengan materi). Client
  mengirim JSON dokumen; server melakukan PRUNE → RENDER → SANITIZE (pola §8.4
  yang sama dengan materi, whitelist lebih sempit: tanpa heading). Plain text
  hasil ekstraksi tetap tersimpan di `responses.content` (snippet admin, CHECK
  panjang, scoring; respons hanya-gambar disimpan sebagai placeholder
  `[alt|gambar]`); HTML tersanitasi tersimpan di kolom baru
  `responses.content_html` (migrasi 0002). Respons lama era plain-text tetap
  tampil apa adanya.
- **Edit & hapus respons:** penulis dapat meng-edit dan menghapus respons
  miliknya sendiri — semua tipe (Jawaban, Komentar, Issue) — langsung dari
  timeline (`PATCH`/`DELETE /api/v1/responses/:id`; penanda "(diedit)" via
  kolom baru `responses.edited_at`, migrasi 0003). Aksi hanya muncul pada pesan
  yang dibuat user login sendiri — pesan peserta lain (issue lintas peserta)
  tetap read-only; terkunci setelah finish (§4.5). Menghapus Jawaban tidak
  menarik kembali poin yang sudah diberikan — hanya memengaruhi kelayakan
  complete berikutnya. Admin mendapat all-access moderasi: tombol Hapus pada
  layar Responses dapat menghapus respons milik siapa pun
  (`DELETE /api/v1/admin/responses/:id`).
- **Thread komentar issue:** setiap kartu issue kini punya thread komentar
  sendiri (tabel baru `issue_comments`, migrasi 0004) sehingga diskusi fokus
  pada satu postingan. Seluruh peserta event — bukan hanya penulis issue — dan
  admin (dengan badge Admin, tanpa perlu enrollment) dapat membantu di
  dalamnya, dari Learning Player maupun layar admin Responses. Komentar memakai
  rich editor yang sama; edit hanya milik sendiri, hapus milik sendiri atau
  admin; ikut terhapus bersama issue-nya. Endpoint:
  `GET/POST /api/v1/responses/:id/comments`,
  `PATCH/DELETE /api/v1/issue-comments/:id`.
- **Visibilitas timeline respons (revisi A-B08):** timeline Jawaban & Komentar
  di Learning Player kini hanya menampilkan respons milik peserta itu sendiri;
  tab Issue tetap memperlihatkan issue seluruh peserta (kendala dialami
  bersama, mencegah laporan duplikat). Admin tetap melihat seluruh respons
  lewat layar Responses dan detail peserta, kini dirender rich.

## [0.2.0] — 2026-08-14

### Changed

- **Form event (admin):** event berstatus Published kini tetap dapat diperbarui
  (judul, deskripsi, cover, kuota) selama jadwal tidak diubah — `startAt` dan
  `endAt` sama-sama dikunci setelah publish (`EVENT_PUBLISHED_IMMUTABLE_FIELD`).
  Field jadwal di form builder ter-disable dengan penjelasan; kuota tetap tidak
  boleh diturunkan di bawah jumlah peserta terdaftar.
- **Unpublish (Published → Draft):** kini diperbolehkan walau event sudah punya
  peserta. Enrollment yang ada tidak disentuh — peserta lama tetap bisa
  melanjutkan, event hanya berhenti menerima peserta baru. Guard
  `CANNOT_UNPUBLISH_WITH_ENROLLMENTS` dihapus dari alur publish.
- **Katalog peserta:** daftar event kini berisi event aktif (published dan belum
  berakhir) ditambah semua event yang sudah diikuti peserta — termasuk event
  yang sudah selesai atau ditarik kembali ke Draft. Event draft tetap tak
  terlihat (404) bagi peserta yang belum bergabung. Cache katalog menjadi
  per-user karena daftarnya kini personal.

### Added

- `CHANGELOG.md` + konvensi versi per deploy production.
- Job `release` di GitHub Actions: auto-tag `v<versi>` + GitHub Release setiap
  versi baru mendarat di `main`.
- Field `version` pada respons `GET /api/v1/health` untuk memverifikasi versi
  yang sedang ter-deploy.

## [0.1.0] — 2026-08-13

Baseline production pertama (retrospektif; dirilis bertahap 12–13 Agustus 2026).

### Added

- Aplikasi Learning Study AI: autentikasi + RBAC (admin/peserta), event builder
  dua langkah (info + kurikulum dnd-kit), katalog & enrollment peserta dengan
  kuota anti-race, learning player berurutan dengan poin & penyelesaian,
  dashboard admin (KPI, pipeline, respons/issue) dan dashboard peserta.
- CI GitHub Actions (lint, typecheck, unit + integration test dengan service
  Postgres 16); CD via Vercel Git Integration (project `workshop-demo`).
- Database production Supabase (transaction pooler, `prepare: false` otomatis);
  checklist di `doc/supabase-deploy.md`.
- Mode insert-URL untuk cover & gambar konten menggantikan upload file sementara
  (commit `098dbdd`).
- Rate limit register konfigurabel (default 300/jam/IP) dan kolokasi fungsi
  Vercel ke `sin1`.
