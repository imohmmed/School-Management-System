import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const activityLogsTable = pgTable("activity_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  actorUserId: text("actor_user_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  recordId: text("record_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = typeof insertActivityLogSchema._type;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
