# Route Group `(admin)`

Area trainer/admin, seluruhnya di bawah path `/admin`. `layout.tsx` wajib memanggil
`requireRole('admin')` di server; peserta yang mencoba masuk mendapat `403 FORBIDDEN`
(TDD §5.3).

Angka KPI & pipeline dibungkus `unstable_cache` TTL 30 detik dengan tag per event,
sehingga beberapa admin yang membuka dashboard bersamaan tidak menghasilkan query
berulang (TDD §1.2, §7.3).

## Isi pada epic berikutnya

| File                                                                                | Epic          |
| ----------------------------------------------------------------------------------- | ------------- |
| `admin/layout.tsx` + `AdminSideNav`                                                 | 2 / 6         |
| `admin/page.tsx` — Dashboard & Monitoring                                           | 6 (Story 6.3) |
| `admin/events/page.tsx` — Event Management                                          | 3 (Story 3.1) |
| `admin/events/new/page.tsx`, `admin/events/[eventId]/edit/page.tsx` — Event Builder | 3 (Story 3.3) |
| `admin/events/[eventId]/{preview,participants,responses}/page.tsx`                  | 7 (Story 7.1) |
| `admin/participants/page.tsx`, `admin/participants/[userId]/page.tsx`               | 7 (Story 7.2) |
| `admin/users/page.tsx` — User Access                                                | 7 (Story 7.3) |
