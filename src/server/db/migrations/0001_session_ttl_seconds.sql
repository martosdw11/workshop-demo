-- 0001_session_ttl_seconds
--
-- ALASAN (asumsi eksplisit A-B03):
-- TDD §5.1 mewajibkan sliding session — "diperpanjang bila sisa umur < 50%" —
-- dengan DUA umur berbeda: 8 jam (normal) dan 30 hari ("Remember me").
-- Untuk memutuskan "sisa < 50% dari berapa?" dan "diperpanjang sebanyak apa?",
-- sesi harus mengingat umurnya sendiri. Menurunkannya dari `expires_at - created_at`
-- tidak bisa diandalkan: setelah beberapa kali perpanjangan, sesi normal yang
-- dipakai berhari-hari punya selisih yang menyerupai sesi "Remember me".
--
-- Kolom ini aditif, punya DEFAULT, dan tidak mengubah satu pun constraint yang
-- sudah ada. File 0000 tidak disentuh (TDD §2.11: migrasi lama tidak pernah diedit).

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ttl_seconds integer NOT NULL DEFAULT 28800;--> statement-breakpoint

ALTER TABLE sessions
  ADD CONSTRAINT sessions_ttl_seconds_positive CHECK (ttl_seconds > 0);
