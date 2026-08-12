# `server/services` — Business Logic

**Satu-satunya lapisan yang boleh menulis ke database.** Route Handler dan Server
Component sama-sama memanggil ke sini; tidak ada logika bisnis yang hidup di komponen
maupun di handler (TDD §1.1).

| File                    | Epic | Tanggung jawab                                                                |
| ----------------------- | ---- | ----------------------------------------------------------------------------- |
| `auth.service.ts`       | 2    | register, login, logout, validasi sesi                                        |
| `user.service.ts`       | 7    | Participant List, User Access (role & status)                                 |
| `event.service.ts`      | 3    | CRUD event, publish/unpublish                                                 |
| `material.service.ts`   | 3    | CRUD materi, rekalkulasi `sequence_index` / `material_count` / `total_points` |
| `enrollment.service.ts` | 4, 5 | `enroll` / `complete` / `finish`                                              |
| `scoring.service.ts`    | 5    | Perhitungan poin all-or-nothing (TDD §4)                                      |
| `response.service.ts`   | 5    | Submit & timeline respons                                                     |
| `stats.service.ts`      | 6    | Query agregat monitoring + cache 30 detik                                     |

## Aturan

- Setiap operasi yang menyentuh kuota atau poin berjalan dalam **transaksi** dengan
  `SELECT ... FOR UPDATE` (TDD §4.2, §4.3).
- **Urutan lock dibakukan:** `events` → `enrollments` → `material_progress` → `users`.
- Cek kepemilikan resource (`enrollment.user_id === session.userId`) dilakukan di sini
  — melindungi dari IDOR: peserta A tidak bisa membuka enrollment peserta B walau tahu
  ID-nya (TDD §5.2).
- Endpoint `enroll`, `complete`, `finish` **idempoten secara struktural** lewat
  constraint unik + `ON CONFLICT DO NOTHING`, bukan lewat UI (TDD §4.4).
