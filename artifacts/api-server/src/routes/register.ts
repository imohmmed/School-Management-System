import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, classesTable, studentsTable, subjectsTable, examsTable } from "@workspace/db";
import {
  CreateClassBody, UpdateClassBody, CreateStudentBody, UpdateStudentBody,
  ListStudentsQueryParams, CreateSubjectBody, UpdateSubjectBody, ListSubjectsQueryParams,
  GetStudentRegisterQueryParams,
} from "@workspace/api-zod";
import { ApiProblem, audit, calendarDate, currentAccount, parse, queryValues, recordId, settings } from "../lib/school-core";
import { classes, students, studentCount, subjects } from "../lib/school-queries";
import { requireRole } from "../middlewares/schoolAuth";

const router = Router();
const admin = requireRole("administrator", "registrar");
function meaningful(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new ApiProblem(400, `${label} مطلوب`);
  return trimmed;
}

router.get("/classes", async (_req, res) => { res.json(await classes()); });
router.post("/classes", admin, async (req, res) => {
  const body = parse(CreateClassBody, req.body);
  const actor = currentAccount(res);
  const values = { ...body, gradeLevel: meaningful(body.gradeLevel, "الصف"), section: meaningful(body.section, "الشعبة"), academicYear: meaningful(body.academicYear, "السنة الدراسية"), room: body.room?.trim() || null };
  const record = await db.transaction(async (tx) => {
    const [created] = await tx.insert(classesTable).values(values).returning();
    await audit(tx, actor, "create", "classes", created!.id, `إضافة صف ${values.gradeLevel} / ${values.section}`);
    return created!;
  });
  res.status(201).json((await classes()).find((item) => item.id === record.id));
});
router.patch("/classes/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  const body = parse(UpdateClassBody, req.body);
  const actor = currentAccount(res);
  const values = { ...body, gradeLevel: meaningful(body.gradeLevel, "الصف"), section: meaningful(body.section, "الشعبة"), academicYear: meaningful(body.academicYear, "السنة الدراسية"), room: body.room?.trim() || null };
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(classesTable).where(eq(classesTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "الصف غير موجود");
    if (existing.academicYear !== values.academicYear) {
      const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.classId, id)).limit(1);
      if (exam) throw new ApiProblem(400, "لا يمكن تغيير السنة الدراسية لصف مرتبط بامتحانات. أنشئ صفاً للسنة الجديدة.");
    }
    await tx.update(classesTable).set(values).where(eq(classesTable.id, id));
    await audit(tx, actor, "update", "classes", id, `تعديل صف ${values.gradeLevel} / ${values.section}`);
  });
  res.json((await classes()).find((item) => item.id === id));
});
router.delete("/classes/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [student] = await tx.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.classId, id)).limit(1);
    const [subject] = await tx.select({ id: subjectsTable.id }).from(subjectsTable).where(eq(subjectsTable.classId, id)).limit(1);
    if (student || subject) throw new ApiProblem(400, "الصف مرتبط بطلاب أو مواد. عطّله بدلاً من حذفه للحفاظ على السجلات.");
    const [deleted] = await tx.delete(classesTable).where(eq(classesTable.id, id)).returning();
    if (!deleted) throw new ApiProblem(404, "الصف غير موجود");
    await audit(tx, currentAccount(res), "delete", "classes", id, `حذف صف ${deleted.gradeLevel} / ${deleted.section}`);
  });
  res.sendStatus(204);
});

router.get("/students", async (req, res) => { res.json(await students(parse(ListStudentsQueryParams, queryValues(req)))); });
router.get("/students/register", async (req, res) => {
  const query = parse(GetStudentRegisterQueryParams, queryValues(req));
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const filters = { search: query.search, classId: query.classId, active: query.active, academicYear: query.academicYear, sort: query.sort };
  const [records, total] = await Promise.all([students(filters, { page, pageSize }), studentCount(filters)]);
  res.json({ records, total, page, pageSize });
});
router.get("/barcode/:code", async (req, res) => {
  const code = String(req.params.code).trim();
  if (!code || code.length > 100) throw new ApiProblem(400, "رمز الباركود غير صحيح");
  const [student] = await students({ code, active: true });
  if (!student) throw new ApiProblem(404, "لم يتم العثور على طالب نشط بهذا الرمز");
  res.json(student);
});
router.post("/students", admin, async (req, res) => {
  const body = parse(CreateStudentBody, { ...req.body, dateOfBirth: req.body?.dateOfBirth || null });
  const dateOfBirth = req.body.dateOfBirth == null || req.body.dateOfBirth === "" ? null : calendarDate(req.body.dateOfBirth);
  const actor = currentAccount(res);
  const id = await db.transaction(async (tx) => {
    const [classRecord] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId));
    if (!classRecord || !classRecord.active) throw new ApiProblem(400, "اختر صفاً نشطاً");
    const school = await settings(tx);
    const studentCode = meaningful(body.studentCode, "رقم الطالب");
    const [created] = await tx.insert(studentsTable).values({
      ...body, fullName: meaningful(body.fullName, "اسم الطالب"), studentCode,
      barcode: `${school.barcodePrefix ? `${school.barcodePrefix}-` : ""}${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      dateOfBirth, guardianName: body.guardianName?.trim() || null, guardianPhone: body.guardianPhone?.trim() || null,
      gender: body.gender?.trim() || null, address: body.address?.trim() || null,
    }).returning();
    await audit(tx, actor, "create", "students", created!.id, `إضافة الطالب ${created!.fullName}`);
    return created!.id;
  });
  res.status(201).json((await students({ id }))[0]);
});
router.patch("/students/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  const body = parse(UpdateStudentBody, { ...req.body, dateOfBirth: req.body?.dateOfBirth || null });
  const dateOfBirth = req.body.dateOfBirth == null || req.body.dateOfBirth === "" ? null : calendarDate(req.body.dateOfBirth);
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(studentsTable).where(eq(studentsTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "الطالب غير موجود");
    const [classRecord] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId));
    if (!classRecord || (!classRecord.active && body.classId !== existing.classId)) throw new ApiProblem(400, "اختر صفاً نشطاً");
    await tx.update(studentsTable).set({
      ...body, fullName: meaningful(body.fullName, "اسم الطالب"), studentCode: meaningful(body.studentCode, "رقم الطالب"), dateOfBirth,
      guardianName: body.guardianName?.trim() || null, guardianPhone: body.guardianPhone?.trim() || null,
      gender: body.gender?.trim() || null, address: body.address?.trim() || null,
    }).where(eq(studentsTable.id, id));
    await audit(tx, currentAccount(res), "update", "students", id, `تعديل بيانات الطالب ${body.fullName}`);
  });
  res.json((await students({ id }))[0]);
});
router.delete("/students/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [record] = await tx.update(studentsTable).set({ active: false }).where(eq(studentsTable.id, id)).returning();
    if (!record) throw new ApiProblem(404, "الطالب غير موجود");
    await audit(tx, currentAccount(res), "archive", "students", id, `أرشفة الطالب ${record.fullName} مع الاحتفاظ بدرجاته وحضوره`);
  });
  res.sendStatus(204);
});

router.get("/subjects", async (req, res) => { res.json(await subjects(parse(ListSubjectsQueryParams, queryValues(req)).classId)); });
router.post("/subjects", admin, async (req, res) => {
  const body = parse(CreateSubjectBody, req.body);
  if (body.passingMarks > body.totalMarks) throw new ApiProblem(400, "درجة النجاح لا يمكن أن تتجاوز الدرجة الكاملة");
  const id = await db.transaction(async (tx) => {
    const [classRecord] = await tx.select().from(classesTable).where(and(eq(classesTable.id, body.classId), eq(classesTable.active, true)));
    if (!classRecord) throw new ApiProblem(400, "اختر صفاً نشطاً");
    const [record] = await tx.insert(subjectsTable).values({ ...body, name: meaningful(body.name, "اسم المادة"), code: body.code?.trim() || null }).returning();
    await audit(tx, currentAccount(res), "create", "subjects", record!.id, `إضافة مادة ${record!.name}`);
    return record!.id;
  });
  res.status(201).json((await subjects()).find((item) => item.id === id));
});
router.patch("/subjects/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  const body = parse(UpdateSubjectBody, req.body);
  if (body.passingMarks > body.totalMarks) throw new ApiProblem(400, "درجة النجاح لا يمكن أن تتجاوز الدرجة الكاملة");
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(subjectsTable).where(eq(subjectsTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "المادة غير موجودة");
    const [classRecord] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId));
    if (!classRecord) throw new ApiProblem(400, "الصف غير موجود");
    const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.subjectId, id)).limit(1);
    if (exam && (body.classId !== existing.classId || body.totalMarks !== existing.totalMarks || body.passingMarks !== existing.passingMarks)) {
      throw new ApiProblem(400, "لا يمكن نقل المادة أو تغيير سلم الدرجات بعد ربطها بامتحانات. أنشئ مادة جديدة.");
    }
    await tx.update(subjectsTable).set({ ...body, name: meaningful(body.name, "اسم المادة"), code: body.code?.trim() || null }).where(eq(subjectsTable.id, id));
    await audit(tx, currentAccount(res), "update", "subjects", id, `تعديل مادة ${body.name}`);
  });
  res.json((await subjects()).find((item) => item.id === id));
});
router.delete("/subjects/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.subjectId, id)).limit(1);
    if (exam) throw new ApiProblem(400, "المادة مرتبطة بامتحانات ولا يمكن حذفها");
    const [record] = await tx.delete(subjectsTable).where(eq(subjectsTable.id, id)).returning();
    if (!record) throw new ApiProblem(404, "المادة غير موجودة");
    await audit(tx, currentAccount(res), "delete", "subjects", id, `حذف مادة ${record.name}`);
  });
  res.sendStatus(204);
});

export default router;
