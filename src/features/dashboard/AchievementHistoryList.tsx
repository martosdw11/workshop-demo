import { EmptyState } from '@/components/shared/EmptyState';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { formatDate, formatPointsDelta } from '@/lib/format';

/**
 * AchievementHistoryList + AchievementItem — TDD §6.4, PRD §3.A.2.
 *
 * TEMUAN KONTRAK (dilaporkan, tidak ditambal): §6.4 menyebut daftar ini
 * "server render awal + TanStack Query untuk load-more", tetapi `GET /me/dashboard`
 * (§3.3) mengembalikan `achievements[]` TANPA cursor dan service-nya membatasi
 * 20 baris terbaru. Karena epic ini dilarang mengubah kontrak API, daftar
 * dirender penuh di server tanpa tombol "View All History" — tombol yang
 * mengarah ke endpoint yang tidak ada akan lebih buruk daripada tidak ada tombol.
 */
export type Achievement = {
  enrollmentId: number;
  eventId: number;
  eventTitle: string;
  completedAt: string | null;
  pointsEarned: number;
  pointsAvailable: number;
  progressPercent: number;
};

export function AchievementItem({ item }: { item: Achievement }) {
  return (
    <li className="rounded-lg border border-transparent p-3 transition-colors hover:border-outline-variant hover:bg-surface-container-low">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <MaterialIcon name="check_circle" filled className="mt-1 text-[20px] text-primary" />
          <div className="min-w-0">
            <h4 className="truncate text-label-md text-on-surface">{item.eventTitle}</h4>
            <span className="text-label-sm text-on-surface-variant">
              {item.completedAt ? `Selesai ${formatDate(item.completedAt)}` : 'Selesai'}
            </span>
          </div>
        </div>

        {/* Poin memakai token `tertiary` (semantik §6.1: Poin = tertiary-container). */}
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-tertiary-fixed px-2 py-1 text-label-sm text-on-tertiary-fixed">
          {formatPointsDelta(item.pointsEarned)}
          <MaterialIcon name="stars" filled className="text-[14px]" />
        </span>
      </div>
      <div className="ml-8">
        <ProgressBar
          value={item.progressPercent}
          label={`Progres ${item.eventTitle}`}
          className="h-1"
        />
      </div>
    </li>
  );
}

export function AchievementHistoryList({ items }: { items: Achievement[] }) {
  return (
    <section
      aria-labelledby="achievement-title"
      className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest"
    >
      <div className="border-b border-outline-variant p-6">
        <h3 id="achievement-title" className="text-title-md text-on-surface">
          Achievement History
        </h3>
        <p className="text-body-sm text-on-surface-variant">Event yang selesai & poin diperoleh</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="workspace_premium"
          title="Belum ada pencapaian"
          description="Selesaikan sebuah event untuk mengunci poin dan mencatatnya di sini."
          className="m-4 border-0 bg-transparent"
        />
      ) : (
        <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto p-4">
          {items.map((item) => (
            <AchievementItem key={item.enrollmentId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
