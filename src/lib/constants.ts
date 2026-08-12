/**
 * Konstanta domain yang dipakai bersama server & client.
 * Nilai yang dapat dikalibrasi per-deployment tinggal di `.env` (TDD §10);
 * yang di sini adalah kontrak bentuk data dan ukuran halaman (§3).
 */

/** Ambang klasifikasi "Stalled" (TDD §7.5). Nilai runtime dibaca dari env. */
export const STALLED_THRESHOLD_DAYS_DEFAULT = 3;

/** Ukuran halaman default per daftar, mengikuti kontrak §3.3–§3.4. */
export const PAGE_SIZE = {
  catalog: 12,
  adminEvents: 20,
  responses: 20,
  activity: 20,
  eventParticipants: 25,
  eventResponses: 25,
  participants: 10,
} as const;

export const MAX_PAGE_SIZE = 50;

/** Batas validasi domain (TDD §9.2). */
export const LIMITS = {
  nameMin: 2,
  nameMax: 120,
  passwordMin: 8,
  eventTitleMax: 200,
  materialTitleMax: 200,
  pointsMin: 0,
  pointsMax: 1000,
  responseContentMin: 1,
  responseContentMax: 5000,
} as const;

/** Filter katalog peserta (§3.3). `finished` diturunkan dari `end_at` (A-11). */
export const EVENT_CATALOG_FILTERS = ['all', 'active', 'upcoming', 'finished'] as const;
export type EventCatalogFilter = (typeof EVENT_CATALOG_FILTERS)[number];

export const RESPONSE_TYPES = ['answer', 'comment', 'issue'] as const;

/** Periode filter dashboard admin (§3.4). */
export const DASHBOARD_PERIODS = ['7d', '30d', 'quarter', 'ytd'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Alasan hasil scoring (§3.5 payload `complete`). */
export const SCORING_REASONS = ['ANSWER_PRESENT', 'NO_ANSWER_RESPONSE', 'ALREADY_COMPLETED'] as const;
export type ScoringReason = (typeof SCORING_REASONS)[number];

/** Whitelist node TipTap yang boleh dirender (TDD §8.4). */
export const ALLOWED_TIPTAP_NODES = [
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'image',
  'codeBlock',
  'hardBreak',
  'text',
] as const;

export const ALLOWED_TIPTAP_MARKS = ['bold', 'italic', 'link', 'code'] as const;

/** Format media yang diterima upload (TDD §8.3). */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const UPLOAD_KINDS = ['cover', 'material-image'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];
