import { clearRateLimits, closeDb } from './db';

/**
 * `npm run db:clear-rate-limits` — pengganti one-liner psql yang selama ini
 * didokumentasikan smoke.sh (`DELETE FROM rate_limits`), tanpa butuh psql.
 */
clearRateLimits()
  .then(async () => {
    console.log('✔ rate_limits dikosongkan.');
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('✖ Gagal mengosongkan rate_limits:', error);
    await closeDb().catch(() => {});
    process.exit(1);
  });
