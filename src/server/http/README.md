# `server/http` — Batas HTTP

| File            | Epic | Keterangan                                                                                                                                                                                              |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handler.ts`    | 2    | `withHandler()` — membungkus setiap Route Handler: memetakan exception domain → HTTP status, mencatat error tak terduga lengkap dengan `requestId`, mengembalikan `500 INTERNAL_ERROR` generik ke klien |
| `errors.ts`     | 2    | Kelas error domain + katalog kode (TDD §9.4)                                                                                                                                                            |
| `validate.ts`   | 2    | Helper Zod di batas handler; `422` mengisi `details.fields` berisi peta `{field: pesan}`                                                                                                                |
| `pagination.ts` | 4    | Cursor pagination (`?cursor=&limit=`) — bukan `OFFSET`                                                                                                                                                  |

## Amplop response (TDD §9.1)

```jsonc
// sukses
{ "data": { }, "meta": { "nextCursor": "..." } }

// error — SELALU bentuk yang sama
{ "error": { "code": "MACHINE_CODE", "message": "Pesan bahasa Indonesia", "details": { } } }
```

`code` adalah kontrak mesin (UPPER_SNAKE, **tidak pernah berubah setelah rilis**),
`message` teks siap tampil, `details` hanya data tambahan yang aman ditampilkan —
**tidak boleh** memuat stack trace, SQL, atau data pengguna lain.
