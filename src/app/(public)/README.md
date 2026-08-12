# Route Group `(public)`

Halaman yang **tidak** memerlukan sesi. Strategi render: **static, tanpa akses DB**
(TDD §1.2) — halaman ini paling sering dihantam saat pembukaan event (150 login
dalam 2 menit), jadi idealnya nol query.

## Isi pada epic berikutnya (EPIC 2 — Story 2.3)

| File                | Keterangan                                                    |
| ------------------- | ------------------------------------------------------------- |
| `layout.tsx`        | `AuthSplitLayout` — panel brand indigo di kiri, form di kanan |
| `login/page.tsx`    | Email + Password, Remember me, Forgot password                |
| `register/page.tsx` | Nama, Email, No. HP, Password                                 |

Acuan desain: `doc/stitch_learning_study_ai_platform/login_learning_study_ai/`.

Tombol Google/SSO dirender `disabled` + tooltip "Coming soon" — **tidak ada** route,
handler, maupun env var terkait di MVP (TDD §5.3).
