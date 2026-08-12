# Tests

Uji beban skala besar (k6) **sengaja dihapus** dari rencana — pada 100–150 peserta,
angka SLO PRD §7.2 tercapai tanpa tuning khusus. Yang tetap wajib adalah uji yang
membuktikan **kebenaran di bawah konkurensi**, karena kelas bug ini tidak hilang walau
pesertanya sedikit (TDD §11.4).

| Folder         | Isi                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `unit/`        | Scoring engine (ada `answer` → poin penuh · hanya `comment`/`issue` → 0 · panggil 2× → poin tidak dobel), normalisasi phone, sanitasi HTML |
| `integration/` | Uji konkurensi + query assert integritas data                                                                                              |

## Uji konkurensi wajib (gate rilis, EPIC 8 Story 8.4)

| Uji                  | Bentuk                                                                      | Kriteria lulus                                                 |
| -------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Join paralel         | 50 request `enroll` bersamaan dari **satu** user ke satu event              | Tepat **1** enrollment; sisanya `409 ALREADY_ENROLLED`         |
| Kuota balapan        | 20 request `enroll` bersamaan pada event bersisa kuota 5                    | Tepat 5 berhasil, 15 `409 QUOTA_FULL`                          |
| Complete ganda       | 10 request `complete` bersamaan pada materi yang sama                       | Poin bertambah **sekali**, sisanya `reason: ALREADY_COMPLETED` |
| Smoke data realistis | `npm run db:seed:bulk` lalu buka dashboard admin, drill-down, matriks nilai | Semua halaman < 2 detik; tidak ada query > 200 ms              |

## Query assert integritas (TDD §11.4)

Keempat query berikut **harus mengembalikan 0 baris**; rilis diblokir bila tidak:

1. Tidak ada peserta yang join dua kali.
2. `enrollments.total_points` = jumlah `material_progress.points_earned`.
3. Tidak ada poin diberikan tanpa respons bertipe `answer`.
4. Tidak ada respons yang dibuat setelah enrollment `completed`.

Test runner belum dipilih — ditetapkan pada EPIC 2 bersama test pertama.
