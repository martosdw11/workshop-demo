# Route Handlers `/api/v1/*` — "backend"-nya aplikasi

Kontrak lengkap ada di TDD §3. Base path `/api/v1`, seluruh request/response JSON
(kecuali `POST /admin/uploads` yang `multipart/form-data`).

## Aturan yang tidak boleh dilanggar

- **Route Handler harus tipis:** validasi (Zod) → panggil service → serialisasi.
  Tidak ada logika bisnis di sini; satu-satunya lapisan yang menulis ke DB adalah
  `server/services/**` (TDD §1.3).
- **Auth lewat cookie sesi `HttpOnly`** — tidak ada token di body/query. Setiap
  handler non-publik wajib memanggil `requireUser()` / `requireRole()`.
- **Amplop response seragam** (TDD §9.1):
  - sukses: `{ "data": {...}, "meta": { "nextCursor": "..." } }`
  - error: `{ "error": { "code": "UPPER_SNAKE", "message": "…", "details": {...} } }`
- **Pagination memakai cursor**, bukan `OFFSET` — pada `responses` yang tumbuh terus,
  `OFFSET` besar memaksa scan.
- **Server Actions TIDAK dipakai untuk mutasi** (asumsi A-03 TDD): REST Route Handler
  adalah satu-satunya kontrak mutasi, agar TanStack Query punya endpoint HTTP stabil
  untuk polling & optimistic update dan kontrak tidak terpecah dua.

## Endpoint per epic

| Grup                                                    | Epic                  |
| ------------------------------------------------------- | --------------------- |
| `auth/{register,login,logout,me}`                       | 2                     |
| `events`, `events/[eventId]`, `events/[eventId]/enroll` | 4                     |
| `materials/[materialId]/{route,responses,complete}`     | 5                     |
| `enrollments/[enrollmentId]/{route,finish}`             | 5                     |
| `me/dashboard`                                          | 5                     |
| `admin/**`                                              | 3, 6, 7               |
| `media/[...key]` (saat `STORAGE_DRIVER=local`)          | 3 (Story 3.4)         |
| `health`                                                | ✅ sudah ada (EPIC 1) |
