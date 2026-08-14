/** Bentuk data People/User Access sesuai kontrak §3.4 (dideklarasikan ulang, §1.3). */

export type UserSummary = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'participant' | 'admin';
  initials: string;
  createdAt: string;
};

export type ParticipantRow = {
  user: UserSummary;
  eventsJoined: number;
  totalPoints: number;
  status: 'active' | 'inactive';
};

export type ParticipantProfile = UserSummary & {
  status: 'active' | 'inactive';
  totalPoints: number;
};

export type ParticipantEnrollment = {
  enrollmentId: number;
  event: { id: number; title: string; startAt: string; endAt: string };
  status: 'in_progress' | 'completed';
  points: number;
  pointsAvailable: number;
  progress: number;
  joinedAt: string;
  completedAt: string | null;
};

export type ParticipantEventDetail = {
  perMaterialPoints: Array<{
    materialId: number;
    title: string;
    depth: number;
    sequenceIndex: number;
    pointsAvailable: number;
    pointsEarned: number;
    completedAt: string | null;
  }>;
  responses: Array<{
    id: number;
    materialId: number;
    materialTitle: string;
    type: 'answer' | 'comment' | 'issue';
    content: string;
    /** HTML tersanitasi di server dari rich editor; `null` untuk respons lama. */
    contentHtml: string | null;
    issueStatus: 'open' | 'resolved' | null;
    createdAt: string;
  }>;
};

export type MatrixMaterialData = {
  id: number;
  title: string;
  depth: number;
  points: number;
  sequenceIndex: number;
};

export type MatrixParticipantData = {
  user: { id: number; name: string; email: string; initials: string };
  enrollmentId: number;
  status: 'in_progress' | 'completed';
  currentMaterial: { id: number; title: string } | null;
  totalPoints: number;
  progressPercent: number;
  lastActivityAt: string;
  perMaterial: Array<{ materialId: number; pointsEarned: number; completed: boolean }>;
};

export type EventResponseRow = {
  id: number;
  type: 'answer' | 'comment' | 'issue';
  content: string;
  /** HTML tersanitasi di server dari rich editor; `null` untuk respons lama. */
  contentHtml: string | null;
  issueStatus: 'open' | 'resolved' | null;
  createdAt: string;
  material: { id: number; title: string; depth: number };
  user: { id: number; name: string; email: string; initials: string };
};
