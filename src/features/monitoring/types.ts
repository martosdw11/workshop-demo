/** Bentuk data monitoring admin sesuai kontrak §3.4 (dideklarasikan ulang, §1.3). */

export type DashboardKpiData = {
  totalEvents: number;
  activeToday: number;
  upcomingWeek: number;
  totalParticipants: number;
};

export type PipelineItemData = {
  eventId: number;
  title: string;
  total: number;
  completed: number;
  inProgress: number;
  stalled: number;
};

export type MaterialDrilldownItemData = {
  materialId: number;
  title: string;
  depth: number;
  participantCount: number;
  completedCount: number;
  openIssueCount: number;
};

export type ActivityItemData = {
  id: number;
  type: 'answer' | 'comment' | 'issue';
  content: string;
  createdAt: string;
  materialId: number;
  materialTitle: string;
  eventId: number;
  issueStatus: 'open' | 'resolved' | null;
  user: { id: number; name: string; initials: string };
  href: string;
};

/**
 * Interval polling monitoring — TDD §7.3.
 *
 * 30 detik menyamai TTL `unstable_cache` di server, sehingga keterlambatan
 * worst-case = 30 detik cache + 30 detik polling = ≤ 60 detik (SLO §7.2 PRD).
 * Polling HANYA dipakai di area admin; halaman peserta tidak pernah refetch
 * berkala.
 */
export const MONITORING_POLL_MS = 30_000;
