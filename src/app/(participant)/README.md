# Route Group `(participant)`

Area peserta. `layout.tsx` wajib memanggil `requireRole('participant')` di **server**
— middleware hanya mengecek keberadaan cookie dan itu optimasi, bukan pengaman
(TDD §5.2).

## Isi pada epic berikutnya

| File                                               | Epic          | Strategi render (TDD §1.2)                                                    |
| -------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `layout.tsx`                                       | 2             | guard role + `TopNavBar` (badge Total Points)                                 |
| `dashboard/page.tsx`                               | 5 (Story 5.5) | Dynamic RSC — personal, tidak bisa di-cache lintas user                       |
| `catalog/page.tsx`                                 | 4 (Story 4.1) | Dynamic RSC + `unstable_cache` 30 detik; badge keikutsertaan di-join per user |
| `events/[eventId]/page.tsx`                        | 5             | redirect ke `current_material_id`                                             |
| `events/[eventId]/materials/[materialId]/page.tsx` | 5             | Dynamic RSC untuk konten; panel respons via TanStack Query                    |
| `events/[eventId]/result/page.tsx`                 | 5 (Story 5.4) | View Results — read-only setelah Finish                                       |
