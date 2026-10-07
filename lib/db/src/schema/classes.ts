import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const classesTable = pgTable(
  "school_classes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gradeLevel: text("grade_level").notNull(),
    section: text("section").notNull(),
    academicYear: text("academic_year").notNull(),
    room: text("room"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("school_classes_grade_section_year_uq").on(table.gradeLevel, table.section, table.academicYear)],
);

export const insertClassSchema = createInsertSchema(classesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClass = typeof insertClassSchema._type;
export type SchoolClass = typeof classesTable.$inferSelect;
