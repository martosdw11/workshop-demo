import { pgEnum } from 'drizzle-orm/pg-core';

/** Enum domain — TDD §2.1. Nilai tidak boleh diubah setelah rilis (kontrak API). */

export const userRoleEnum = pgEnum('user_role', ['participant', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive']);
export const eventStatusEnum = pgEnum('event_status', ['draft', 'published', 'finished']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', ['in_progress', 'completed']);
export const progressStatusEnum = pgEnum('progress_status', ['in_progress', 'completed']);
export const responseTypeEnum = pgEnum('response_type', ['answer', 'comment', 'issue']);
export const issueStatusEnum = pgEnum('issue_status', ['open', 'resolved']);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type EnrollmentStatus = (typeof enrollmentStatusEnum.enumValues)[number];
export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];
export type ResponseType = (typeof responseTypeEnum.enumValues)[number];
export type IssueStatus = (typeof issueStatusEnum.enumValues)[number];
