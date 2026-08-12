# `src/components` — Komponen Lintas Domain

| Folder    | Epic | Isi                                                                                                                                                                     |
| --------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/`     | 2    | Primitif hasil generate **shadcn/ui**: `button, input, textarea, select, dialog, sheet, tabs, table, badge, progress, dropdown-menu, avatar, tooltip, skeleton, sonner` |
| `shared/` | 2+   | `TopNavBar`, `AdminSideNav`, `DataTable`, `Pagination`, `ProgressBar`, `StatusPill`, `EmptyState`, `ErrorState`, `MaterialIcon`                                         |

## Override wajib pada primitif shadcn/ui (TDD §6.1)

- `rounded-lg` = **12px** (`rounded-md` di token kita — lihat `tailwind.config.ts`)
- Tinggi tombol minimum **44px** (touch target, PRD §7.6)
- Focus ring **2px `primary` dengan offset** — tidak boleh ada `outline: none` tanpa
  pengganti (PRD §7.7)

## Gaya komponen yang sudah dikunci (DESIGN.md)

- **Cards:** surface putih + border 1px; progress bar terintegrasi setinggi 6px
  dengan track membulat.
- **Badges:** pill dengan background low-opacity dan teks berkontras tinggi.
- **Data Tables:** gaya _borderless-row_ — hanya pembatas horizontal, tanpa garis
  vertikal; header memakai `label-sm` uppercase.
- **Inputs:** radius 12px, label eksternal top-aligned; state error memakai warna
  Issue pada border dan helper text.
