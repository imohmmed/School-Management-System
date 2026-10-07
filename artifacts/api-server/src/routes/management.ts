import { Router } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  db, schoolUsersTable, schoolSettingsTable, studentsTable, gradesTable,
  examsTable, subjectsTable,
} from "@workspace/db";
import { and, asc, count, eq, sql } from "drizzle-orm";
import {
  GetAttendanceReportQueryParams, GetGradesReportQueryParams,
  InviteUserBody, UpdateUserBody, UpdateSettingsBody, ListActivityQueryParams,
} from "@workspace/api-zod";
import { claimOrBindAccount, requireRole } from "../middlewares/schoolAuth";
import { isConfiguredOwnerEmail } from "../lib/owner-access";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { ApiProblem, audit, baghdadToday, currentAccount, parse, queryValues, settings, userOutput } from "../lib/school-core";
import { activity, attendance, classes, exams, grades, studentCount } from "../lib/school-queries";

export const publicSchoolRouter = Router();
publicSchoolRouter.get("/setup/status", async (_req, res) => {
  const [record] = await db.select({ id: schoolUsersTable.id }).from(schoolUsersTable).limit(1);
  res.json({ initialized: !!record });
});
publicSchoolRouter.get("/me", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth.sessionClaims?.userId || auth.userId;
  if (typeof userId !== "string" || !userId) throw new ApiProblem(401, "يرجى تسجيل الدخول");
  res.json(userOutput(await claimOrBindAccount(userId)));
});

const router = Router();
const admin = requireRole("administrator");
const settingsOutput = (record: Awaited<ReturnType<typeof settings>>) => ({
  schoolName: record.schoolName, academicYear: record.academicYear,
  gradeScaleMax: record.gradeScaleMax, passingPercent: record.passingPercent, barcodePrefix: record.barcodePrefix,
});

router.get("/dashboard", async (_req, res) => {
  const today = baghdadToday();
  const [classList, studentTotal, examList, recentActivity, todaysAttendance, recordedGrades] = await Promise.all([
    classes(), studentCount({ active: true }), exams(), activity(6), attendance({ from: today, to: today }),
    db.select({ total: count() }).from(gradesTable).innerJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id)).where(eq(studentsTable.active, true)),
  ]);
  const expected = examList.reduce((sum, exam) => sum + (classList.find((item) => item.id === exam.classId)?.studentCount ?? 0), 0);
  res.json({
    classCount: classList.filter((item) => item.active).length,
    studentCount: studentTotal,
    absentToday: todaysAttendance.filter((item) => item.status === "absent").length,
    gradeCompletionPercent: expected ? Math.min(100, Math.round(recordedGrades[0]!.total / expected * 100)) : 0,
    upcomingExams: examList.filter((item) => item.examDate >= today).slice(0, 6),
    recentActivity,
  });
});

router.get("/reports/attendance", async (req, res) => {
  const query = parse(GetAttendanceReportQueryParams, queryValues(req));
  const from = query.from.toISOString().slice(0, 10);
  const to = query.to.toISOString().slice(0, 10);
  if (from > to) throw new ApiProblem(400, "تاريخ البداية يجب أن يسبق النهاية");
  const records = await attendance({ from, to, classId: query.classId, academicYear: query.academicYear });
  res.json({
    from, to, totalStudents: new Set(records.map((item) => item.studentId)).size,
    absentCount: records.filter((item) => item.status === "absent").length,
    presentCount: records.filter((item) => item.status === "present").length,
    lateCount: records.filter((item) => item.status === "late").length,
    excusedCount: records.filter((item) => item.status === "excused").length,
    records,
  });
});
router.get("/reports/grades", async (req, res) => {
  const query = parse(GetGradesReportQueryParams, queryValues(req));
  const records = await grades(query);
  const thresholds = await db.select({
    examId: examsTable.id, passingMarks: subjectsTable.passingMarks, totalMarks: subjectsTable.totalMarks,
  }).from(examsTable).innerJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id));
  const thresholdMap = new Map(thresholds.map((item) => [item.examId, item.passingMarks / item.totalMarks * 100]));
  const percentages = records.map((item) => item.score / item.maxScore * 100);
  const passCount = records.filter((item) => item.score / item.maxScore * 100 >= (thresholdMap.get(item.examId) ?? 50)).length;
  res.json({
    average: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length * 100) / 100 : 0,
    passCount, failCount: records.length - passCount, records,
  });
});
router.get("/settings", async (_req, res) => { res.json(settingsOutput(await settings())); });
router.put("/settings", admin, async (req, res) => {
  const body = parse(UpdateSettingsBody, req.body);
  if (!body.schoolName.trim() || !body.academicYear.trim()) throw new ApiProblem(400, "اسم المدرسة والسنة الدراسية مطلوبان");
  if (body.barcodePrefix && !/^[A-Za-z0-9_-]{1,30}$/.test(body.barcodePrefix)) throw new ApiProblem(400, "بادئة الباركود تقبل الحروف الإنجليزية والأرقام والشرطة فقط");
  const record = await db.transaction(async (tx) => {
    const previous = await settings(tx);
    const [saved] = await tx.update(schoolSettingsTable).set({
      ...body, schoolName: body.schoolName.trim(), academicYear: body.academicYear.trim(),
    }).where(eq(schoolSettingsTable.id, "school")).returning();
    await audit(tx, currentAccount(res), "update", "settings", "school",
      "تعديل إعدادات المدرسة. سلم الدرجات وبادئة الباركود يطبقان على السجلات الجديدة فقط؛ السجلات السابقة لم تتغير.",
      { previous: settingsOutput(previous), next: settingsOutput(saved!) });
    return saved!;
  });
  res.json(settingsOutput(record));
});
router.get("/activity", admin, async (req, res) => {
  const query = parse(ListActivityQueryParams, queryValues(req));
  res.json(await activity(query.limit ?? 30, query));
});
router.get("/users", admin, async (_req, res) => {
  const records = await db.select().from(schoolUsersTable).orderBy(asc(schoolUsersTable.createdAt));
  res.json(records.map(userOutput));
});
router.post("/users/invitations", admin, async (req, res) => {
  const body = parse(InviteUserBody, req.body);
  const email = body.email.trim().toLowerCase();
  const fullName = body.fullName.trim();
  if (fullName.length < 2) throw new ApiProblem(400, "اسم المستخدم مطلوب");
  const [existing] = await db.select().from(schoolUsersTable).where(eq(schoolUsersTable.email, email));
  if (existing && existing.status !== "suspended") throw new ApiProblem(400, "هذا البريد لديه حساب أو دعوة بالفعل");
  const clerkAccounts = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  const clerkUser = clerkAccounts.data.find((item) => item.emailAddresses.some((address) =>
    address.id === item.primaryEmailAddressId && address.emailAddress.toLowerCase() === email && address.verification?.status === "verified"));
  let invitationId: string | null = null;
  try {
    if (!clerkUser) {
      const host = getClerkProxyHost(req);
      if (!host || !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) throw new ApiProblem(400, "تعذر تحديد رابط دعوة المدرسة");
      const origin = req.get("origin") || `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
      const invitation = await clerkClient.invitations.createInvitation({ emailAddress: email, redirectUrl: `${origin}/sign-up`, notify: true, ignoreExisting: true });
      invitationId = invitation.id;
    }
    const account = await db.transaction(async (tx) => {
      const values = {
        email, fullName, role: body.role, status: clerkUser ? "active" : "invited",
        clerkUserId: clerkUser?.id ?? null, clerkInvitationId: invitationId,
      };
      const [account] = existing
        ? await tx.update(schoolUsersTable).set(values).where(eq(schoolUsersTable.id, existing.id)).returning()
        : await tx.insert(schoolUsersTable).values(values).returning();
      await audit(tx, currentAccount(res), "invite", "users", account!.id, clerkUser ? `منح صلاحية المدرسة للحساب المسجل ${fullName}` : `إرسال دعوة إلى ${fullName}`);
      return account!;
    });
    res.status(201).json(userOutput(account));
  } catch (error) {
    if (invitationId) await clerkClient.invitations.revokeInvitation(invitationId).catch(() => undefined);
    if (error instanceof ApiProblem) throw error;
    const external = error as { errors?: { longMessage?: string; code?: string }[] };
    if (external.errors) throw new ApiProblem(400, "تعذر إرسال الدعوة. تحقق من البريد الإلكتروني أو الدعوات المرسلة سابقاً.");
    throw error;
  }
});
router.patch("/users/:id", admin, async (req, res) => {
  const body = parse(UpdateUserBody, req.body);
  if (!body.role && !body.status) throw new ApiProblem(400, "اختر الدور أو الحالة المطلوب تعديلها");
  const id = String(req.params.id);
  const actor = currentAccount(res);
  const account = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(6719342027)`);
    const [existing] = await tx.select().from(schoolUsersTable).where(eq(schoolUsersTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "المستخدم غير موجود");
    if (isConfiguredOwnerEmail(existing.email) &&
        ((body.role && body.role !== "administrator") || body.status === "suspended")) {
      throw new ApiProblem(400, "لا يمكن إيقاف حساب مالك النظام المعيّن أو إزالة صلاحية إدارته");
    }
    if (id === actor.id && ((body.role && body.role !== "administrator") || body.status === "suspended")) throw new ApiProblem(400, "لا يمكنك إيقاف حسابك أو إزالة صلاحية إدارتك من هذه الشاشة");
    const [admins] = await tx.select({ total: count() }).from(schoolUsersTable).where(and(eq(schoolUsersTable.role, "administrator"), eq(schoolUsersTable.status, "active")));
    if (existing.role === "administrator" && existing.status === "active" && admins!.total <= 1 &&
      ((body.role && body.role !== "administrator") || body.status === "suspended")) throw new ApiProblem(400, "يجب أن يبقى مدير نشط واحد على الأقل");
    const status = body.status === "active" && !existing.clerkUserId ? "invited" : body.status;
    const [updated] = await tx.update(schoolUsersTable).set({ ...body, ...(status ? { status } : {}) }).where(eq(schoolUsersTable.id, id)).returning();
    await audit(tx, actor, "update", "users", id, `تعديل صلاحيات أو حالة ${existing.fullName}`, { previous: { role: existing.role, status: existing.status }, next: body });
    return updated!;
  });
  res.json(userOutput(account));
});
router.delete("/users/:id", admin, async (req, res) => {
  const id = String(req.params.id);
  const actor = currentAccount(res);
  if (id === actor.id) throw new ApiProblem(400, "لا يمكنك إلغاء صلاحية حسابك الحالي");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(6719342027)`);
    const [existing] = await tx.select().from(schoolUsersTable).where(eq(schoolUsersTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "المستخدم غير موجود");
    if (isConfiguredOwnerEmail(existing.email)) throw new ApiProblem(400, "لا يمكن إلغاء صلاحية مالك النظام المعيّن");
    const [admins] = await tx.select({ total: count() }).from(schoolUsersTable).where(and(eq(schoolUsersTable.role, "administrator"), eq(schoolUsersTable.status, "active")));
    if (existing.role === "administrator" && existing.status === "active" && admins!.total <= 1) throw new ApiProblem(400, "لا يمكن إلغاء صلاحية مدير المدرسة الوحيد");
    if (existing.clerkInvitationId && existing.status === "invited") {
      await clerkClient.invitations.revokeInvitation(existing.clerkInvitationId);
    }
    await tx.update(schoolUsersTable).set({ status: "suspended", clerkInvitationId: null }).where(eq(schoolUsersTable.id, id));
    await audit(tx, actor, "revoke", "users", id, `إلغاء صلاحية المدرسة للحساب ${existing.fullName}`);
  });
  res.sendStatus(204);
});

export default router;
