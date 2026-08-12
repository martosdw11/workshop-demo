# `server/auth` — Session & Otorisasi

Sesi **opaque buatan sendiri**: cookie `HttpOnly` + baris di tabel `sessions`
PostgreSQL (asumsi A-02 TDD). Bukan JWT — alasannya revoke harus berlaku **seketika**
saat akun dinonaktifkan lewat User Access.

| File          | Status    | Keterangan                                                                                                        |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `password.ts` | ✅ EPIC 1 | Argon2id (memoryCost 19 MiB, timeCost 2, parallelism 1). Dipakai seed & register                                  |
| `session.ts`  | ⬜ EPIC 2 | create (simpan `token_hash` SHA-256), validate, refresh sliding, revoke, revoke-all-by-user, cleanup oportunistik |
| `rbac.ts`     | ⬜ EPIC 2 | Matriks peran participant/admin (TDD §5.3)                                                                        |
| `guard.ts`    | ⬜ EPIC 2 | `requireUser()` / `requireRole()` + guard kepemilikan resource                                                    |

## Pembagian tanggung jawab (TDD §5.2)

| Lapisan                           | Tugas                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `middleware.ts`                   | Cek **keberadaan** cookie saja, redirect cepat ke `/login`. Tidak menyentuh database. **Ini optimasi, bukan pengaman**                                                  |
| `requireUser()` / `requireRole()` | **Pengaman sesungguhnya.** Query tabel `sessions`, cek `status` akun, cek role. Wajib dipanggil di setiap Route Handler non-publik dan di `layout.tsx` tiap route group |
| Service layer                     | Cek kepemilikan resource (anti-IDOR)                                                                                                                                    |

Registrasi mandiri **selalu** membuat `role = 'participant'`; field `role` di body
request diabaikan total (privilege escalation guard).
