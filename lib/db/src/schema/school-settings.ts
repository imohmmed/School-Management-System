import { createInsertSchema } from "drizzle-zod";
import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const schoolSettingsTable = pgTable("school_settings", {
  id: text("id").primaryKey().default("school"),
  schoolName: text("school_name").notNull().default("مدرسة جديدة"),
  academicYear: text("academic_year").notNull().default(""),
  gradeScaleMax: numeric("grade_scale_max", { precision: 7, scale: 2, mode: "number" }).notNull().default(100),
  passingPercent: numeric("passing_percent", { precision: 5, scale: 2, mode: "number" }).notNull().default(50),
  barcodePrefix: text("barcode_prefix").notNull().default("STD"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSchoolSettingsSchema = createInsertSchema(schoolSettingsTable).omit({ updatedAt: true });
export type InsertSchoolSettings = typeof insertSchoolSettingsSchema._type;
export type SchoolSettingsRecord = typeof schoolSettingsTable.$inferSelect;
