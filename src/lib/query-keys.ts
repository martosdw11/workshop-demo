import type { DashboardPeriod, EventCatalogFilter } from './constants';

/**
 * Query key factory TanStack Query.
 *
 * Semua key dibuat DI SINI supaya invalidasi setelah mutasi tidak bergantung
 * pada string yang diketik ulang di banyak komponen — mis. `complete` harus
 * menyegarkan enrollment, sidebar path, dan dashboard peserta sekaligus.
 *
 * Konvensi: key selalu diawali domain (`events`, `player`, `admin`), sehingga
 * `invalidateQueries({queryKey: qk.admin.all})` cukup untuk seluruh area admin.
 */

export type ResponseType = 'answer' | 'comment' | 'issue';

export const qk = {
  auth: {
    me: ['auth', 'me'] as const,
  },

  me: {
    dashboard: ['me', 'dashboard'] as const,
  },

  events: {
    all: ['events'] as const,
    list: (params: { status: EventCatalogFilter; q?: string }) =>
      ['events', 'list', params.status, params.q ?? ''] as const,
    detail: (eventId: number) => ['events', 'detail', eventId] as const,
  },

  player: {
    all: ['player'] as const,
    enrollment: (enrollmentId: number) => ['player', 'enrollment', enrollmentId] as const,
    material: (materialId: number) => ['player', 'material', materialId] as const,
    responses: (materialId: number, type: ResponseType) =>
      ['player', 'responses', materialId, type] as const,
  },

  /** Thread komentar issue — dipakai peserta DAN admin (komponen bersama). */
  issueComments: (responseId: number) => ['issue-comments', responseId] as const,

  admin: {
    all: ['admin'] as const,

    events: {
      all: ['admin', 'events'] as const,
      list: (params: { status?: string; q?: string }) =>
        ['admin', 'events', 'list', params.status ?? 'all', params.q ?? ''] as const,
      detail: (eventId: number) => ['admin', 'events', 'detail', eventId] as const,
      materials: (eventId: number) => ['admin', 'events', 'materials', eventId] as const,
      participants: (eventId: number, params: { q?: string; status?: string }) =>
        ['admin', 'events', 'participants', eventId, params.q ?? '', params.status ?? 'all'] as const,
      responses: (
        eventId: number,
        params: { type?: string; materialId?: number; issueStatus?: string },
      ) =>
        [
          'admin',
          'events',
          'responses',
          eventId,
          params.type ?? 'all',
          params.materialId ?? 0,
          params.issueStatus ?? 'all',
        ] as const,
    },

    dashboard: {
      kpi: (period: DashboardPeriod) => ['admin', 'dashboard', 'kpi', period] as const,
      pipeline: (period: DashboardPeriod, eventId?: number) =>
        ['admin', 'dashboard', 'pipeline', period, eventId ?? 0] as const,
      drilldown: (eventId: number) => ['admin', 'dashboard', 'drilldown', eventId] as const,
      activity: (eventId?: number) => ['admin', 'dashboard', 'activity', eventId ?? 0] as const,
    },

    participants: {
      all: ['admin', 'participants'] as const,
      list: (params: { q?: string; status?: string }) =>
        ['admin', 'participants', 'list', params.q ?? '', params.status ?? 'all'] as const,
      detail: (userId: number) => ['admin', 'participants', 'detail', userId] as const,
      eventDetail: (userId: number, eventId: number) =>
        ['admin', 'participants', 'detail', userId, 'event', eventId] as const,
    },

    users: {
      all: ['admin', 'users'] as const,
      list: (params: { q?: string; role?: string; status?: string }) =>
        ['admin', 'users', 'list', params.q ?? '', params.role ?? 'all', params.status ?? 'all'] as const,
    },
  },
} as const;
