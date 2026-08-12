import { StatusPill } from '@/components/shared/StatusPill';
import type { EventCardData } from './types';

/**
 * EventStatusBadge — TDD §6.5.
 *
 * Label domain diambil PERSIS dari PRD §3.A.3 lewat `StatusPill`:
 * `Belum diikuti` / `Sedang diikuti` / `Selesai`.
 */
const VARIANT_BY_STATUS = {
  not_joined: 'not-joined',
  in_progress: 'in-progress',
  completed: 'completed',
} as const;

export function EventStatusBadge({ status }: { status: EventCardData['myStatus'] }) {
  return (
    <StatusPill
      variant={VARIANT_BY_STATUS[status]}
      className="shadow-level2 backdrop-blur-sm"
    />
  );
}
