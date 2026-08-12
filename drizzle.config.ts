import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit berjalan di luar runtime Next.js, jadi .env dimuat manual.
loadDotenv({ path: '.env', quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL belum diset. Salin .env.example menjadi .env terlebih dahulu.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dbCredentials: { url: databaseUrl },
  // Penamaan migrasi: NNNN_snake_case_deskripsi.sql, tidak pernah diedit setelah merge (TDD §2.11)
  migrations: { prefix: 'index' },
  strict: true,
  verbose: true,
});
