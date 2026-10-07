import type { Request, Response } from "express";
import { db, activityLogsTable, schoolSettingsTable, type SchoolUserRecord } from "@workspace/db";
import { eq } from "drizzle-orm";

export type SchoolTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type SchoolDatabase = typeof db | SchoolTransaction;

export class ApiProblem extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function parse<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
    throw new ApiProblem(400, `البيانات غير صحيحة${fields.length ? `: ${fields.join("، ")}` : ""}`);
  }
  return result.data;
}

export function recordId(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new ApiProblem(400, "رقم السجل غير صحيح");
  return result;
}

export function calendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiProblem(400, "يجب أن يكون التاريخ بصيغة YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiProblem(400, "التاريخ غير صحيح");
  }
  return value;
}

export function baghdadToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function queryValues(req: Request): Record<string, unknown> {
  const values: Record<string, unknown> = { ...req.query };
  for (const key of ["from", "to"]) {
    if (values[key] !== undefined) values[key] = new Date(`${calendarDate(values[key])}T00:00:00Z`);
  }
  if (values.active !== undefined) {
    if (values.active !== "true" && values.active !== "false") throw new ApiProblem(400, "حالة الطالب غير صحيحة");
    values.active = values.active === "true";
  }
  return values;
}

export function currentAccount(res: Response): SchoolUserRecord {
  const account = res.locals.schoolUser as SchoolUserRecord | undefined;
  if (!account) throw new ApiProblem(401, "يرجى تسجيل الدخول");
  return account;
}

export async function audit(
  connection: SchoolDatabase,
  actor: SchoolUserRecord,
  action: string,
  entity: string,
  id: number | string | null,
  message: string,
  changes?: Record<string, unknown>,
) {
  await connection.insert(activityLogsTable).values({
    actorUserId: actor.id,
    actorName: actor.fullName,
    action,
    entity,
    recordId: id === null ? null : String(id),
    details: { message, ...changes },
  });
}

export async function settings(connection: SchoolDatabase = db) {
  await connection.insert(schoolSettingsTable).values({ id: "school" }).onConflictDoNothing();
  const [record] = await connection.select().from(schoolSettingsTable).where(eq(schoolSettingsTable.id, "school"));
  return record!;
}

export function userOutput(record: SchoolUserRecord) {
  return {
    id: record.id,
    clerkUserId: record.clerkUserId,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
  };
}
