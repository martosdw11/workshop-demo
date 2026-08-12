/**
 * Setup test: memuat `.env` sebelum modul apa pun mengevaluasi `src/server/env.ts`,
 * yang gagal cepat bila variable wajib kosong (TDD §10).
 */
import 'dotenv/config';
