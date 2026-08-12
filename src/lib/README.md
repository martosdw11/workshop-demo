# `src/lib` — Utilitas Bersama (aman untuk client)

Berbeda dengan `server/**`, isi folder ini boleh di-import dari komponen client.
Karena itu **dilarang** memuat rahasia, koneksi database, atau logika yang harus
dipercaya server.

| File                | Epic | Keterangan                                                                                                         |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `api-client.ts`     | 2    | Satu-satunya jalan komponen client mengakses data; membaca amplop `{data}` / `{error}` (TDD §9.1)                  |
| `query-keys.ts`     | 4    | Konvensi key TanStack Query                                                                                        |
| `error-messages.ts` | 8    | Peta `code` → pesan Bahasa Indonesia, agar satu kode selalu menghasilkan teks yang sama di seluruh UI (TDD §9.4)   |
| `format.ts`         | 4    | Format tanggal, waktu relatif, angka poin                                                                          |
| `phone.ts`          | 2    | Normalisasi nomor HP ke E.164 (`08…` → `+628…`), 9–15 digit (asumsi A-12)                                          |
| `sanitize-html.ts`  | 3    | **Dipanggil dari service layer**, bukan dari komponen client (TDD §8.4)                                            |
| `constants.ts`      | 6    | mis. `STALLED_THRESHOLD_DAYS`                                                                                      |
| `validation/`       | 2    | Skema Zod yang **dipakai ulang** oleh form client dan Route Handler, sehingga aturan validasi hanya ditulis sekali |

## Catatan penting

`sanitize-html.ts` tinggal di sini agar tipenya bisa dibagi, tetapi **sanitasi wajib
dieksekusi di server** saat menyimpan materi. Memindahkannya ke komponen client hanya
karena keduanya satu codebase adalah pelanggaran (TDD §8.4).
