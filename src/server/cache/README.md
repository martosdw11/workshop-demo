# `server/cache` — Cache & Rate Limit

Tidak ada Redis (PRD §7.1). Cache memakai cache bawaan Next.js, rate limit memakai
tabel PostgreSQL.

| File           | Epic | Keterangan                                                                                                                                                                                    |
| -------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags.ts`      | 6    | Helper `unstable_cache` + konvensi cache tag `event:{eventId}` sehingga aksi admin (publish, edit kurikulum) bisa memanggil `revalidateTag` dan langsung menyegarkan angka tanpa menunggu TTL |
| `ratelimit.ts` | 2    | **Fixed window** di tabel `rate_limits`: satu `INSERT ... ON CONFLICT DO UPDATE` yang mengembalikan `count` terbaru                                                                           |

## TTL cache (TDD §7.3)

| Fungsi                                 | TTL      | Polling klien |
| -------------------------------------- | -------- | ------------- |
| `getDashboardKpi(period)`              | 30 detik | 30 detik      |
| `getPipelineSummary(period, eventId?)` | 30 detik | 30 detik      |
| `getMaterialDrilldown(eventId)`        | 30 detik | on-demand     |
| `getRecentActivity(eventId?)`          | 30 detik | 30 detik      |

Keterlambatan worst-case = TTL 30 detik + interval polling 30 detik = **≤ 60 detik**,
sesuai SLO PRD §7.2.

## Batas rate limit (TDD §9.3)

| Scope                 | Batas              | Identifier   |
| --------------------- | ------------------ | ------------ |
| `POST /responses`     | 10 / menit         | `userId`     |
| `POST /auth/login`    | 5 / 15 menit gagal | `email` + IP |
| `POST /auth/register` | 3 / jam            | IP           |
| `POST /enroll`        | 20 / menit         | `userId`     |
| Global tulis          | 60 / menit         | `userId`     |

Rate limit **tidak** diterapkan pada endpoint baca peserta agar pengalaman belajar
tidak terganggu.
