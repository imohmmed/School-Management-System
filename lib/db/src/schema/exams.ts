import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";
import { examSessionsTable } from "./exam-sessions";
import { subjectsTable } from "./subjects";

export const examsTable = pgTable(
  "exams",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer("session_id").notNull().references(() => examSessionsTable.id, { onDelete: "restrict" }),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    subjectId: integer("subject_id").notNull().references(() => subjectsTable.id, { onDelete: "restrict" }),
    examDate: date("exam_date", { mode: "string" }).notNull(),
    totalMarks: numeric("total_marks", { precision: 7, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("exams_session_class_subject_uq").on(table.sessionId, table.classId, table.subjectId)],
);

export const insertExamSchema = createInsertSchema(examsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExam = typeof insertExamSchema._type;
export type Exam = typeof examsTable.$inferSelect;
