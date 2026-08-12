import { relations } from 'drizzle-orm';

import { enrollments } from './enrollments';
import { events } from './events';
import { materials } from './materials';
import { materialProgress } from './progress';
import { responses } from './responses';
import { sessions } from './sessions';
import { users } from './users';

/**
 * Relasi untuk Drizzle relational query API — 1:1 dengan ERD PRD §6.
 * Ini metadata TypeScript saja; integritas tetap ditegakkan FK di migrasi.
 */

export const usersRelations = relations(users, ({ many }) => ({
  createdEvents: many(events), // users ||--o{ events : "created by admin"
  enrollments: many(enrollments), // users ||--o{ enrollments : "joins"
  responses: many(responses), // users ||--o{ responses : "writes"
  sessions: many(sessions),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
  materials: many(materials), // events ||--o{ materials : "has many"
  enrollments: many(enrollments), // events ||--o{ enrollments : "is joined by"
}));

export const materialsRelations = relations(materials, ({ one, many }) => ({
  event: one(events, { fields: [materials.eventId], references: [events.id] }),
  // materials ||--o{ materials : "has sub-materials" (maks. 2 level)
  parent: one(materials, {
    fields: [materials.parentId],
    references: [materials.id],
    relationName: 'material_children',
  }),
  children: many(materials, { relationName: 'material_children' }),
  progress: many(materialProgress), // materials ||--o{ material_progress
  responses: many(responses), // materials ||--o{ responses : "receives"
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  event: one(events, { fields: [enrollments.eventId], references: [events.id] }),
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  currentMaterial: one(materials, {
    fields: [enrollments.currentMaterialId],
    references: [materials.id],
    relationName: 'enrollment_current_material',
  }),
  progress: many(materialProgress), // enrollments ||--o{ material_progress : "tracks"
  responses: many(responses), // enrollments ||--o{ responses : "produces"
}));

export const materialProgressRelations = relations(materialProgress, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [materialProgress.enrollmentId],
    references: [enrollments.id],
  }),
  material: one(materials, {
    fields: [materialProgress.materialId],
    references: [materials.id],
  }),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [responses.enrollmentId],
    references: [enrollments.id],
  }),
  material: one(materials, { fields: [responses.materialId], references: [materials.id] }),
  author: one(users, { fields: [responses.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
