import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";

export const subjectsTable = pgTable(
  "subjects",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code"),
    totalMarks: numeric("total_marks", { precision: 7, scale: 2, mode: "number" }).notNull().default(100),
    passingMarks: numeric("passing_marks", { precision: 7, scale: 2, mode: "number" }).notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("subjects_class_name_uq").on(table.classId, table.name)],
);

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSubject = typeof subjectsTable.$inferInsert;
export type Subject = typeof subjectsTable.$inferSelect;
