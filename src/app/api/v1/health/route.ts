import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/server/db/client';

/**
 * Health check — TDD §11.1.
 *
 * Mengecek database (`SELECT 1`) dan mengembalikan 200 atau 503.
 * Dipakai sebagai langkah terakhir pipeline rilis: build → db:migrate → deploy →
 * cek endpoint ini. DIKECUALIKAN dari auth dan logging.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        data: {
          status: 'ok',
          database: 'up',
          latencyMs: Date.now() - startedAt,
          checkedAt: new Date().toISOString(),
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[health] database unreachable', error);

    // Detail error TIDAK dikirim ke klien (§9.1) — cukup di log server.
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Layanan sedang tidak tersedia.',
          details: { database: 'down' },
        },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
