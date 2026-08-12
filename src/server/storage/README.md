# `server/storage` — Adapter Media

Satu antarmuka — `put(key, bytes, contentType)`, `delete(key)`, `publicUrl(key)` —
dengan dua implementasi yang dipilih lewat env `STORAGE_DRIVER` (asumsi A-04 TDD).
Kode aplikasi tidak boleh tahu-menahu soal driver.

| Driver  | Penyimpanan                     | URL publik                                                                        | Kapan dipakai                                                                           |
| ------- | ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `blob`  | Vercel Blob                     | URL dari penyedia (sudah ber-CDN)                                                 | Deploy ke Vercel — **filesystem di sana ephemeral**, driver `local` tidak boleh dipakai |
| `local` | Volume disk `LOCAL_STORAGE_DIR` | `/api/v1/media/{key}` dengan `Cache-Control: public, max-age=31536000, immutable` | Satu container Docker (volume di-mount) & development lokal                             |

## Aturan upload (TDD §8.2–§8.3) — EPIC 3 Story 3.4

- Hanya **admin** yang bisa upload.
- MIME divalidasi dari **magic bytes**, bukan `Content-Type` kiriman browser.
- Key dibuat server: `{kind}/{yyyy}/{mm}/{uuid}.{ext}` — **nama file asli tidak pernah
  dipakai**, mencegah path traversal dan tabrakan nama.
- Batas ukuran: cover 3 MB, gambar materi 2 MB. Batas body request ditegakkan di
  handler agar upload besar ditolak lebih awal, bukan setelah seluruh file diterima
  di memori.
- Format: `image/jpeg`, `image/png`, `image/webp`.

File yatim (di-upload lalu event batal disimpan) **dibiarkan** pada MVP — biayanya
beberapa megabyte per tahun, tidak sepadan dengan menambah job pembersih.
