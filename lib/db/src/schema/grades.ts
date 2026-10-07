import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { examsTable } from "./exams";
import { studentsTable } from "./students";

export const gradesTable = pgTable(
  "grades",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "restrict" }),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
    score: numeric("score", { precision: 7, scale: 2, mode: "number" }).notNull(),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("grades_exam_student_uq").on(table.examId, table.studentId)],
);

export const insertGradeSchema = createInsertSchema(gradesTable).omit({ updatedAt: true });
export type InsertGrade = typeof gradesTable.$inferInsert;
export type Grade = typeof gradesTable.$inferSelect;
