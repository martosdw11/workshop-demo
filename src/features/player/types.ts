/**
 * Bentuk data Learning Player seperti yang dikirim kontrak §3.3.
 * Dideklarasikan ulang di sisi client — `features/**` dilarang menyentuh
 * `server/**` (§1.3).
 */
export type ResponseType = 'answer' | 'comment' | 'issue';

/** Dokumen TipTap dari rich editor respons (bentuk yang sama dengan builder). */
export type ResponseDoc = { type: 'doc'; content?: unknown[] } & Record<string, unknown>;

export type PathNodeData = {
  id: number;
  parentId: number | null;
  depth: number;
  title: string;
  points: number;
  sequenceIndex: number;
  state: 'completed' | 'active' | 'locked';
  pointsEarned: number | null;
  children: PathNodeData[];
};

export type ResponseItemData = {
  id: number;
  materialId: number;
  enrollmentId: number;
  type: ResponseType;
  content: string;
  /** HTML tersanitasi DI SERVER (§8.4); `null` untuk respons lama plain-text. */
  contentHtml: string | null;
  issueStatus: 'open' | 'resolved' | null;
  createdAt: string;
  /** Terisi bila penulis pernah meng-edit respons ini — FE menampilkan "(diedit)". */
  editedAt: string | null;
  /** Jumlah komentar thread — hanya bermakna untuk `type = 'issue'`. */
  commentCount: number;
  author: { id: number; name: string; initials: string };
};

/** Komentar thread pada kartu issue — bentuk kontrak `GET /responses/:id/comments`. */
export type IssueCommentData = {
  id: number;
  responseId: number;
  content: string;
  contentHtml: string | null;
  createdAt: string;
  editedAt: string | null;
  author: { id: number; name: string; initials: string; isAdmin: boolean };
};

export type CompleteResultData = {
  materialId: number;
  pointsEarned: number;
  pointsAvailable: number;
  awarded: boolean;
  reason: 'ANSWER_PRESENT' | 'NO_ANSWER_RESPONSE' | 'ALREADY_COMPLETED';
  enrollment: {
    totalPoints: number;
    completedMaterialCount: number;
    progressPercent: number;
    currentMaterialId: number | null;
  };
  nextMaterialId: number | null;
  isLast: boolean;
};

export type FinishResultData = {
  enrollment: {
    id: number;
    status: 'in_progress' | 'completed';
    totalPoints: number;
    completedAt: string | null;
  };
  summary: {
    eventTitle: string;
    materialsCompleted: number;
    materialsTotal: number;
    pointsEarned: number;
    pointsAvailable: number;
    userTotalPoints: number;
  };
  readOnly: boolean;
  redirectTo: string;
};

/** Label tab respons — PRD §3.A.4, ditulis PERSIS seperti di PRD. */
export const RESPONSE_TAB_LABELS: Record<ResponseType, string> = {
  answer: 'Jawaban',
  comment: 'Komentar',
  issue: 'Issue / Kendala',
};
