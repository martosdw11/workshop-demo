import { revalidateTag, unstable_cache } from 'next/cache';

import { env } from '../env';

/**
 * Cache bawaan Next.js — TDD §7.3.
 * Tidak ada Redis: satu-satunya lapis cache adalah `unstable_cache` per instance.
 * Setiap entri diberi tag `event:{id}` supaya aksi admin (publish, edit kurikulum)
 * bisa memanggil `revalidateTag` dan langsung menyegarkan angka tanpa menunggu TTL.
 */

export const CACHE_TAGS = {
  /** Daftar event published untuk katalog peserta (§1.2). */
  eventList: 'events:list',
  /** Semua agregat dashboard admin (§7.3). */
  dashboard: 'admin:dashboard',
} as const;

export function eventTag(eventId: number): string {
  return `event:${eventId}`;
}

/** TTL katalog event: 30 detik (§3.3 "cache 30 detik"). */
export const CATALOG_TTL_SECONDS = 30;

/** TTL agregat dashboard admin, dapat dikalibrasi lewat env (§7.3, §10). */
export const dashboardTtlSeconds = () => env.DASHBOARD_CACHE_TTL_SECONDS;

/**
 * Pembungkus tipis `unstable_cache` supaya call-site tidak perlu mengulang
 * bentuk opsi yang sama. `keyParts` WAJIB memuat seluruh argumen yang mengubah
 * hasil — bila tidak, dua pemanggilan berbeda akan berbagi entri cache.
 */
export function cachedQuery<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): (...args: Args) => Promise<R> {
  return unstable_cache(fn, keyParts, {
    revalidate: options.revalidate,
    tags: options.tags,
  });
}

/**
 * Dipanggil setiap kali sesuatu pada sebuah event berubah (publish, edit info,
 * simpan/reorder kurikulum). Sengaja menyegarkan tag event + katalog + dashboard
 * sekaligus: ketiganya membaca angka turunan dari event yang sama.
 */
/**
 * `revalidateTag` hanya sah dipanggil di dalam Route Handler / Server Action.
 * Service yang sama juga dipanggil dari script seed dan dari test integrasi, di
 * mana konteks itu tidak ada — kegagalannya ditelan supaya invalidasi cache tidak
 * pernah menggagalkan transaksi bisnis yang sudah commit.
 */
function safeRevalidate(tag: string): void {
  try {
    revalidateTag(tag);
  } catch {
    /* di luar konteks request — diabaikan dengan sengaja */
  }
}

export function revalidateEvent(eventId: number): void {
  safeRevalidate(eventTag(eventId));
  safeRevalidate(CACHE_TAGS.eventList);
  safeRevalidate(CACHE_TAGS.dashboard);
}

export function revalidateEventList(): void {
  safeRevalidate(CACHE_TAGS.eventList);
  safeRevalidate(CACHE_TAGS.dashboard);
}
