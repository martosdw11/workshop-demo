-- 0003_response_edited_at
--
-- Fitur edit respons issue: penulis boleh memperbaiki issue-nya sendiri.
-- `edited_at` terisi saat edit pertama; NULL = belum pernah diedit. FE
-- menampilkan penanda "(diedit)" bila terisi. Aditif dan nullable — baris
-- lama tidak tersentuh.

ALTER TABLE "responses" ADD COLUMN "edited_at" timestamp with time zone;
