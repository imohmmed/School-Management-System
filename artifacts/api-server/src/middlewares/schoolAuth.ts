import { clerkClient, getAuth } from "@clerk/express";
import { db, schoolUsersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import type { RequestHandler } from "express";
import { ApiProblem, audit } from "../lib/school-core";
import { isConfiguredOwnerEmail } from "../lib/owner-access";

/** Only /me can claim setup or bind a verified invited email. All data routes are deny-by-default. */
export const identifySchoolAccount: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const userId = auth.sessionClaims?.userId || auth.userId;
    if (typeof userId !== "string" || !userId) throw new ApiProblem(401, "يرجى تسجيل الدخول للوصول إلى النظام");
    const [account] = await db.select().from(schoolUsersTable).where(eq(schoolUsersTable.clerkUserId, userId));
    if (!account || account.status !== "active") throw new ApiProblem(403, "هذا الحساب لا يمتلك صلاحية دخول المدرسة. تواصل مع مدير النظام لإرسال دعوة.");
    res.locals.schoolUser = account;
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: string[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(res.locals.schoolUser?.role)) {
      return next(new ApiProblem(403, "ليس لديك صلاحية تنفيذ هذا الإجراء"));
    }
    next();
  };
}

interface ClerkSchoolIdentity {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification?: { status: string } | null }[];
}

// The loader is dependency-injected only for isolated tests; /me never accepts identity input.
export async function claimOrBindAccount(
  userId: string,
  loadIdentity: (id: string) => Promise<ClerkSchoolIdentity> = (id) => clerkClient.users.getUser(id),
) {
  const clerkUser = await loadIdentity(userId);
  if (clerkUser.id !== userId) throw new ApiProblem(401, "تعذر التحقق من هوية الحساب");
  const email = clerkUser.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId);
  if (!email || email.verification?.status !== "verified") throw new ApiProblem(403, "يرجى تأكيد البريد الإلكتروني أولاً");
  const normalizedEmail = email.emailAddress.trim().toLowerCase();
  const designatedOwner = isConfiguredOwnerEmail(normalizedEmail);
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || normalizedEmail.split("@")[0]!;
  return db.transaction(async (tx) => {
    // Serialize first-owner claims and invitation binding.
    await tx.execute(sql`select pg_advisory_xact_lock(6719342026)`);
    const [again] = await tx.select().from(schoolUsersTable).where(eq(schoolUsersTable.clerkUserId, userId));
    if (designatedOwner) {
      const [reserved] = await tx.select().from(schoolUsersTable).where(eq(schoolUsersTable.email, normalizedEmail));
      if (again && reserved && again.id !== reserved.id) {
        throw new ApiProblem(409, "البريد مرتبط بسجل آخر في المدرسة. تواصل مع مدير النظام لتصحيح ربط الحساب.");
      }
      const previous = again ?? reserved;
      if (previous) {
        if (previous.clerkUserId === userId && previous.email === normalizedEmail &&
            previous.role === "administrator" && previous.status === "active") return previous;
        const [owner] = await tx.update(schoolUsersTable).set({
          clerkUserId: userId, email: normalizedEmail, fullName,
          role: "administrator", status: "active", clerkInvitationId: null,
        }).where(eq(schoolUsersTable.id, previous.id)).returning();
        await audit(tx, owner!, "update", "users", owner!.id, "تفعيل صلاحية مالك النظام بعد التحقق من البريد المعيّن", {
          previous: { role: previous.role, status: previous.status },
          next: { role: "administrator", status: "active" },
        });
        return owner!;
      }
      const [owner] = await tx.insert(schoolUsersTable).values({
        clerkUserId: userId, email: normalizedEmail, fullName, role: "administrator", status: "active",
      }).returning();
      await audit(tx, owner!, "setup", "users", owner!.id, "إنشاء حساب مالك النظام بعد التحقق من البريد المعيّن");
      return owner!;
    }
    if (again) {
      if (again.status !== "active") throw new ApiProblem(403, "حسابك موقوف");
      return again;
    }
    const [invited] = await tx.select().from(schoolUsersTable).where(and(eq(schoolUsersTable.email, normalizedEmail), eq(schoolUsersTable.status, "invited")));
    if (invited) {
      const [bound] = await tx.update(schoolUsersTable).set({ clerkUserId: userId, status: "active" }).where(eq(schoolUsersTable.id, invited.id)).returning();
      await audit(tx, bound!, "activate", "users", bound!.id, "تفعيل حساب موظف عبر دعوة المدرسة");
      return bound!;
    }
    const [first] = await tx.select({ id: schoolUsersTable.id }).from(schoolUsersTable).limit(1);
    if (first) throw new ApiProblem(403, "تحتاج إلى دعوة من مدير المدرسة قبل الدخول. أرسل بريدك الإلكتروني للمدير.");
    const [owner] = await tx.insert(schoolUsersTable).values({
      clerkUserId: userId, email: normalizedEmail, fullName, role: "administrator", status: "active",
    }).returning();
    await audit(tx, owner!, "setup", "users", owner!.id, "إنشاء حساب مدير المدرسة الأول");
    return owner!;
  });
}
