/** Bentuk data Event Builder sesuai kontrak §3.4 (dideklarasikan ulang, §1.3). */

export type TiptapDoc = { type: 'doc'; content?: unknown[] } & Record<string, unknown>;

export type AdminEvent = {
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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaterialNode = {
  id: number;
  eventId: number;
  parentId: number | null;
  depth: number;
  title: string;
  points: number;
  orderIndex: number;
  sequenceIndex: number;
  contentJson: TiptapDoc | null;
  contentHtml: string | null;
  children: MaterialNode[];
};

export type MaterialTreeResponse = {
  tree: MaterialNode[];
  materialCount: number;
  totalPoints: number;
};

/**
 * Bentuk respons `POST /admin/uploads`. UI sedang memakai mode insert-URL
 * (tanpa upload), tapi tipe & endpoint-nya dipertahankan untuk kembali nanti.
 */
export type UploadResult = { publicUrl: string; key: string; bytes: number };
