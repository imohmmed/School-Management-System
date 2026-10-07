import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const schoolUsersTable = pgTable("school_users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSchoolUserSchema = createInsertSchema(schoolUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSchoolUser = typeof insertSchoolUserSchema._type;
export type SchoolUserRecord = typeof schoolUsersTable.$inferSelect;
