import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const examSessionsTable = pgTable(
  "exam_sessions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    academicYear: text("academic_year").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("exam_sessions_name_year_uq").on(table.name, table.academicYear)],
);

export const insertExamSessionSchema = createInsertSchema(examSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExamSession = typeof insertExamSessionSchema._type;
export type ExamSession = typeof examSessionsTable.$inferSelect;
