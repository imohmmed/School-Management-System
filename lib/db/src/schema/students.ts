import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { classesTable } from "./classes";

export const studentsTable = pgTable(
  "students",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    fullName: text("full_name").notNull(),
    studentCode: text("student_code").notNull().unique(),
    barcode: text("barcode").notNull().unique(),
    gender: text("gender"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    address: text("address"),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
);

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudent = typeof insertStudentSchema._type;
export type Student = typeof studentsTable.$inferSelect;
