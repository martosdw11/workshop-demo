'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/LoadingSkeletons';
import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusPill } from '@/components/shared/StatusPill';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { RESPONSE_TAB_LABELS } from '@/features/player/types';
import type { ParticipantEnrollment, ParticipantEventDetail, ParticipantProfile } from './types';

/**
 * ParticipantDetailPanel — TDD §6.9, PRD §3.B.10.
 *
 * Profil + riwayat event + **drill-down per event**: rincian poin tiap materi
 * dan seluruh respons peserta di event tersebut. Drill-down memakai query
 * on-demand (`enabled` saat baris dibuka), bukan memuat semua event sekaligus —
 * seorang peserta bisa mengikuti puluhan event.
 */
function EnrollmentDrilldown({ userId, eventId }: { userId: number; eventId: number }) {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: qk.admin.participants.eventDetail(userId, eventId),
    queryFn: () =>
      api.get<ParticipantEventDetail>(`/admin/participants/${userId}/events/${eventId}`),
  });

  if (isPending) return <ListSkeleton count={3} />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="grid grid-cols-1 gap-6 border-t border-outline-variant p-4 lg:grid-cols-2">
      <div>
        <h4 className="mb-2 text-title-md text-on-surface">Poin per materi</h4>
        <ul className="rounded-lg border border-outline-variant">
          {data.perMaterialPoints.map((item) => (
            <li
              key={item.materialId}
              className="flex items-center justify-between gap-3 border-b border-outline-variant px-3 py-2 last:border-0"
            >
              <span className={cn('min-w-0 truncate text-body-sm', item.depth === 1 && 'pl-4')}>
                {item.title}
              </span>
              <span className="shrink-0 text-label-sm text-on-surface-variant">
                {formatNumber(item.pointsEarned)} / {formatNumber(item.pointsAvailable)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-2 text-title-md text-on-surface">Respons peserta</h4>
        {data.responses.length === 0 ? (
          <EmptyState
            icon="forum"
            title="Belum ada respons"
            description="Peserta belum mengirim jawaban, komentar, atau issue pada event ini."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.responses.map((response) => (
              <li
                key={response.id}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      response.type === 'answer'
                        ? 'answer'
                        : response.type === 'issue'
                          ? 'issue'
                          : 'comment'
                    }
                  >
                    {RESPONSE_TAB_LABELS[response.type]}
                  </Badge>
                  <span className="text-label-sm text-on-surface-variant">
                    {response.materialTitle} · {formatDateTime(response.createdAt)}
                  </span>
                </div>
                {response.contentHtml ? (
                  <div
                    className="prose-material text-body-sm text-on-surface-variant"
                    // HTML sudah tersanitasi DI SERVER (`renderResponseContent`, §8.4).
                    dangerouslySetInnerHTML={{ __html: response.contentHtml }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-body-sm text-on-surface-variant">
                    {response.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ParticipantDetailPanel({
  profile,
  enrollments,
}: {
  profile: ParticipantProfile;
  enrollments: ParticipantEnrollment[];
}) {
  const [openEventId, setOpenEventId] = React.useState<number | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-title-lg">{profile.initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-headline-md text-on-surface">{profile.name}</h1>
              <StatusPill variant={profile.status} />
              {profile.role === 'admin' && <Badge variant="primary">Admin</Badge>}
            </div>
            <dl className="grid grid-cols-1 gap-1 text-body-sm text-on-surface-variant sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-label-sm uppercase">Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-label-sm uppercase">No. HP</dt>
                <dd>{profile.phone}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-label-sm uppercase">Terdaftar</dt>
                <dd>{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <span className="flex items-center gap-2 rounded-full bg-tertiary-fixed px-4 py-2 text-title-md text-on-tertiary-fixed">
            <MaterialIcon name="workspace_premium" filled />
            {formatNumber(profile.totalPoints)} poin
          </span>
        </div>
      </section>

      <section aria-labelledby="enrollment-history-title">
        <h2 id="enrollment-history-title" className="mb-3 text-title-lg text-on-surface">
          Riwayat event
        </h2>

        {enrollments.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="Belum mengikuti event"
            description="Peserta ini belum bergabung ke event mana pun."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {enrollments.map((enrollment) => {
              const isOpen = openEventId === enrollment.event.id;
              return (
                <li
                  key={enrollment.enrollmentId}
                  className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-title-md text-on-surface">
                        {enrollment.event.title}
                      </p>
                      <p className="text-label-sm text-on-surface-variant">
                        Bergabung {formatDate(enrollment.joinedAt)}
                        {enrollment.completedAt
                          ? ` · Selesai ${formatDate(enrollment.completedAt)}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <StatusPill
                        variant={enrollment.status === 'completed' ? 'completed' : 'in-progress'}
                      />
                      <span className="text-label-md text-on-surface">
                        {formatNumber(enrollment.points)} / {formatNumber(enrollment.pointsAvailable)}{' '}
                        poin
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-expanded={isOpen}
                        onClick={() => setOpenEventId(isOpen ? null : enrollment.event.id)}
                      >
                        {isOpen ? 'Tutup rincian' : 'Lihat rincian'}
                        <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} />
                      </Button>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <ProgressBar
                      value={enrollment.progress}
                      label={`Progres ${enrollment.event.title}`}
                    />
                  </div>

                  {isOpen && (
                    <EnrollmentDrilldown userId={profile.id} eventId={enrollment.event.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
