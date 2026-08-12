import Link from 'next/link';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { cn } from '@/lib/utils';
import type { PathNodeData } from './types';

/**
 * LessonNavItem — TDD §6.6, tiga state:
 *   `completed` → ikon `check_circle`
 *   `active`    → ikon `play_circle` + **border kiri 4px `primary`**
 *   `locked`    → ikon `lock`
 *
 * Materi terkunci dirender sebagai `<span>`, BUKAN `<a>` yang di-disable:
 * tautan yang tetap ada di DOM masih bisa dibuka lewat keyboard/URL. Server
 * tetap menjadi penjaga sesungguhnya (`403 MATERIAL_LOCKED`) — ini hanya
 * mencegah pengguna diarahkan ke jalan buntu.
 */
export function LessonNavItem({
  node,
  eventId,
  isCurrent,
}: {
  node: PathNodeData;
  eventId: number;
  isCurrent: boolean;
}) {
  const icon =
    node.state === 'completed' ? 'check_circle' : node.state === 'locked' ? 'lock' : 'play_circle';

  const content = (
    <>
      <MaterialIcon
        name={icon}
        filled={node.state !== 'locked'}
        className={cn(
          'text-[20px]',
          node.state === 'completed' && 'text-primary',
          node.state === 'active' && (isCurrent ? 'text-primary' : 'text-on-surface-variant'),
          node.state === 'locked' && 'text-outline',
        )}
      />
      <span className="min-w-0 flex-1 truncate text-body-sm">{node.title}</span>
      {node.points > 0 && (
        <span className="shrink-0 text-label-sm text-on-surface-variant">{node.points} pts</span>
      )}
    </>
  );

  const baseClass = cn(
    'flex min-h-11 items-center gap-2 rounded-lg p-2 transition-colors',
    node.depth === 1 && 'pl-6',
  );

  if (node.state === 'locked') {
    return (
      <li>
        <span
          aria-disabled="true"
          title="Selesaikan materi sebelumnya terlebih dahulu."
          className={cn(baseClass, 'cursor-not-allowed text-on-surface-variant opacity-60')}
        >
          {content}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/events/${eventId}/materials/${node.id}`}
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(
          baseClass,
          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
          isCurrent
            ? 'border-l-4 border-primary bg-surface-variant pl-2 text-primary'
            : 'text-on-surface-variant hover:bg-surface-variant',
          isCurrent && node.depth === 1 && 'pl-5',
        )}
      >
        {content}
      </Link>
    </li>
  );
}

/**
 * LearningPathSidebar — TDD §6.6. Dirender di SERVER (§6.6 "state: server"):
 * struktur kurikulum + status penyelesaian sudah tersedia saat halaman materi
 * dirender, sehingga tidak perlu request kedua dari klien.
 */
export function LearningPathSidebar({
  eventId,
  eventTitle,
  path,
  activeMaterialId,
  progressPercent,
  completedCount,
  totalCount,
}: {
  eventId: number;
  eventTitle: string;
  path: PathNodeData[];
  activeMaterialId: number;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-outline-variant bg-surface-container-low lg:h-[calc(100vh-4rem)] lg:w-80 lg:border-b-0 lg:border-r">
      <div className="border-b border-outline-variant p-6">
        <h2 className="mb-1 text-title-lg text-on-surface">Learning Path</h2>
        <p className="mb-4 truncate text-body-sm text-on-surface-variant">{eventTitle}</p>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-sm text-on-surface-variant">Course Progress</span>
          <span className="text-label-sm text-primary">{progressPercent}% Completed</span>
        </div>
        {/* Segmented: satu ruas per materi (§7.6 PRD — event multi-tahap). */}
        <ProgressBar
          value={progressPercent}
          label={`Progres kurikulum ${eventTitle}`}
          segmented={totalCount > 0 && totalCount <= 24}
          segments={totalCount}
          filledSegments={completedCount}
        />
      </div>

      <nav aria-label="Daftar materi" className="flex-1 py-4">
        {path.map((module, moduleIndex) => (
          <div key={module.id} className="mb-4 px-4">
            <p className="mb-2 px-2 text-label-sm uppercase text-on-surface-variant">
              Modul {moduleIndex + 1}
            </p>
            <ul className="space-y-1">
              <LessonNavItem
                node={module}
                eventId={eventId}
                isCurrent={module.id === activeMaterialId}
              />
              {module.children.map((lesson) => (
                <LessonNavItem
                  key={lesson.id}
                  node={lesson}
                  eventId={eventId}
                  isCurrent={lesson.id === activeMaterialId}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
