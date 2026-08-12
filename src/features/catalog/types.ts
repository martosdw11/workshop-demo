/**
 * Bentuk kartu event seperti yang dikirim `GET /events` (§3.3).
 *
 * Sengaja DIDEKLARASIKAN ULANG di sisi client, bukan meng-import tipe dari
 * `server/services/catalog.service.ts`: batas layer §1.3 melarang `features/**`
 * menyentuh `server/**` sama sekali — termasuk lewat `import type`, yang mudah
 * berubah menjadi import runtime saat file di-refactor.
 */
export type EventCardData = {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  startAt: string;
  endAt: string;
  quota: number | null;
  status: 'draft' | 'published' | 'finished';
  enrolledCount: number;
  materialCount: number;
  totalPoints: number;
  myStatus: 'not_joined' | 'in_progress' | 'completed';
  myEnrollmentId: number | null;
  progressPercent: number | null;
  resumeUrl: string | null;
  resultUrl: string | null;
};

export type CatalogPage = {
  items: EventCardData[];
  nextCursor: string | null;
};
