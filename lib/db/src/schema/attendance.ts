import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { classesTable } from "./classes";

export const attendanceTable = pgTable(
  "attendance",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    attendanceDate: date("attendance_date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("attendance_student_date_uq").on(table.studentId, table.attendanceDate)],
);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertAttendance = typeof attendanceTable.$inferInsert;
export type Attendance = typeof attendanceTable.$inferSelect;
