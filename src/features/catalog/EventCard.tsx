'use client';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { formatDateRange, formatNumber } from '@/lib/format';
import { EventCardAction } from './EventCardAction';
import { EventStatusBadge } from './EventStatusBadge';
import type { EventCardData } from './types';

/**
 * EventCard — TDD §6.5, acuan `event_catalog/`.
 *
 * Isi kartu mengikuti PRD §3.A.3: cover, judul, rentang tanggal, jumlah materi,
 * total poin, jumlah peserta, badge status keikutsertaan, dan aksi kontekstual.
 * Kartu memakai Level 1 elevasi (surface + border 1px), bukan shadow.
 */
export function EventCard({
  event,
  onJoin,
}: {
  event: EventCardData;
  onJoin: (event: EventCardData) => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="relative h-40 bg-surface-container-high">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL cover berasal dari adapter storage (§8.1); host-nya ditentukan env, bukan daftar statis `next/image`.
          <img src={event.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-on-surface-variant">
            <MaterialIcon name="menu_book" className="text-[40px]" />
          </div>
        )}
        <div className="absolute right-3 top-3">
          <EventStatusBadge status={event.myStatus} />
        </div>
      </div>

      <div className="flex flex-grow flex-col p-4">
        <h3 className="mb-1 line-clamp-2 text-title-lg text-on-surface">{event.title}</h3>

        <p className="mb-2 flex items-center gap-2 text-body-sm text-on-surface-variant">
          <MaterialIcon name="calendar_month" className="text-[16px]" />
          {formatDateRange(event.startAt, event.endAt)}
        </p>

        <dl className="mb-4 mt-auto grid grid-cols-2 gap-2 border-t border-outline-variant pt-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="menu_book" filled className="text-[18px] text-outline" />
            <dt className="sr-only">Jumlah materi</dt>
            <dd className="text-label-sm text-on-surface-variant">
              {formatNumber(event.materialCount)} Materials
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <MaterialIcon name="stars" filled className="text-[18px] text-tertiary-fixed-dim" />
            <dt className="sr-only">Total poin</dt>
            <dd className="text-label-sm text-on-surface-variant">
              {formatNumber(event.totalPoints)} Pts
            </dd>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <MaterialIcon name="group" filled className="text-[18px] text-outline" />
            <dt className="sr-only">Jumlah peserta</dt>
            <dd className="text-label-sm text-on-surface-variant">
              {formatNumber(event.enrolledCount)} Participants
              {event.quota ? ` / ${formatNumber(event.quota)} kuota` : ''}
            </dd>
          </div>
        </dl>

        <EventCardAction event={event} onJoin={() => onJoin(event)} />
      </div>
    </article>
  );
}
