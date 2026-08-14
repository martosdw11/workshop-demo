-- 0002_response_content_html
--
-- Rich editor untuk respons peserta (jawaban/komentar/issue). `content` tetap
-- plain text (snippet admin, CHECK panjang, scoring); HTML tersanitasi hasil
-- `renderResponseContent` (§8.4) disimpan terpisah di `content_html`.
-- Nullable: respons lama era plain-text tidak dimigrasi — FE jatuh kembali
-- ke `content`.
--
-- CATATAN: drizzle-kit menyertakan ulang perubahan `sessions` karena migrasi
-- 0001 ditulis manual tanpa snapshot; bagian itu dihapus dari file ini.
-- File 0000/0001 tidak disentuh (TDD §2.11: migrasi lama tidak pernah diedit).

ALTER TABLE responses ADD COLUMN IF NOT EXISTS content_html text;
