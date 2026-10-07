import { Router } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db, classesTable, studentsTable, subjectsTable, examSessionsTable,
  examsTable, gradesTable, attendanceTable,
} from "@workspace/db";
import {
  CreateExamSessionBody, UpdateExamSessionBody, ListExamsQueryParams, CreateExamBody, UpdateExamBody,
  ListGradesQueryParams, SaveGradesBody, ListAttendanceQueryParams, RecordAttendanceBody, RecordClassAttendanceBody,
} from "@workspace/api-zod";
import { ApiProblem, audit, baghdadToday, calendarDate, currentAccount, parse, queryValues, recordId } from "../lib/school-core";
import { exams, grades, attendance, students } from "../lib/school-queries";
import { requireRole } from "../middlewares/schoolAuth";

const router = Router();
const admin = requireRole("administrator", "registrar");
const educator = requireRole("administrator", "registrar", "teacher");

router.get("/exam-sessions", async (_req, res) => {
  res.json(await db.select({ id: examSessionsTable.id, name: examSessionsTable.name, academicYear: examSessionsTable.academicYear, active: examSessionsTable.active })
    .from(examSessionsTable).orderBy(asc(examSessionsTable.academicYear), asc(examSessionsTable.id)));
});
router.post("/exam-sessions", admin, async (req, res) => {
  const body = parse(CreateExamSessionBody, req.body);
  if (!body.name.trim() || !body.academicYear.trim()) throw new ApiProblem(400, "اسم الفترة والسنة الدراسية مطلوبان");
  const record = await db.transaction(async (tx) => {
    const [record] = await tx.insert(examSessionsTable).values({ ...body, name: body.name.trim(), academicYear: body.academicYear.trim() }).returning();
    await audit(tx, currentAccount(res), "create", "exam-sessions", record!.id, `إضافة فترة امتحانات ${body.name}`);
    return record!;
  });
  res.status(201).json({ id: record.id, name: record.name, academicYear: record.academicYear, active: record.active });
});
router.patch("/exam-sessions/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  const body = parse(UpdateExamSessionBody, req.body);
  if (!body.name.trim() || !body.academicYear.trim()) throw new ApiProblem(400, "اسم الفترة والسنة الدراسية مطلوبان");
  const record = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(examSessionsTable).where(eq(examSessionsTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "الفترة غير موجودة");
    if (existing.academicYear !== body.academicYear) {
      const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.sessionId, id)).limit(1);
      if (exam) throw new ApiProblem(400, "لا يمكن تغيير سنة فترة مرتبطة بامتحانات");
    }
    const [updated] = await tx.update(examSessionsTable).set({ ...body, name: body.name.trim(), academicYear: body.academicYear.trim() }).where(eq(examSessionsTable.id, id)).returning();
    await audit(tx, currentAccount(res), "update", "exam-sessions", id, `تعديل فترة امتحانات ${body.name}`);
    return updated!;
  });
  res.json({ id: record.id, name: record.name, academicYear: record.academicYear, active: record.active });
});
router.delete("/exam-sessions/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.sessionId, id)).limit(1);
    if (exam) throw new ApiProblem(400, "الفترة تحتوي على امتحانات ولا يمكن حذفها");
    const [record] = await tx.delete(examSessionsTable).where(eq(examSessionsTable.id, id)).returning();
    if (!record) throw new ApiProblem(404, "الفترة غير موجودة");
    await audit(tx, currentAccount(res), "delete", "exam-sessions", id, `حذف فترة ${record.name}`);
  });
  res.sendStatus(204);
});

router.get("/exams", async (req, res) => { res.json(await exams(parse(ListExamsQueryParams, queryValues(req)))); });
router.post("/exams", admin, async (req, res) => {
  const body = parse(CreateExamBody, req.body);
  const examDate = calendarDate(req.body.examDate);
  const id = await db.transaction(async (tx) => {
    const [classRecord] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId)).for("share");
    const [subject] = await tx.select().from(subjectsTable).where(eq(subjectsTable.id, body.subjectId)).for("share");
    const [session] = await tx.select().from(examSessionsTable).where(eq(examSessionsTable.id, body.sessionId)).for("share");
    if (!classRecord?.active || !session?.active || !subject) throw new ApiProblem(400, "اختر صفاً وفترة نشطين ومادة صحيحة");
    if (subject.classId !== classRecord.id || session.academicYear !== classRecord.academicYear) throw new ApiProblem(400, "المادة يجب أن تتبع الصف، والفترة يجب أن تتبع نفس السنة الدراسية");
    const [conflict] = await tx.select({ id: examsTable.id }).from(examsTable).where(and(eq(examsTable.classId, body.classId), eq(examsTable.sessionId, body.sessionId), eq(examsTable.examDate, examDate))).limit(1);
    if (conflict) throw new ApiProblem(400, "يوجد امتحان آخر للصف نفسه في هذا اليوم والفترة");
    const [record] = await tx.insert(examsTable).values({ ...body, examDate }).returning();
    await audit(tx, currentAccount(res), "create", "exams", record!.id, `جدولة امتحان ${subject.name} بتاريخ ${examDate}`);
    return record!.id;
  });
  res.status(201).json((await exams({ id }))[0]);
});
router.patch("/exams/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  const body = parse(UpdateExamBody, req.body);
  const examDate = calendarDate(req.body.examDate);
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(examsTable).where(eq(examsTable.id, id)).for("update");
    if (!existing) throw new ApiProblem(404, "الامتحان غير موجود");
    const [grade] = await tx.select({ id: gradesTable.id }).from(gradesTable).where(eq(gradesTable.examId, id)).limit(1);
    if (grade && (body.classId !== existing.classId || body.subjectId !== existing.subjectId || body.sessionId !== existing.sessionId || body.totalMarks !== existing.totalMarks)) {
      throw new ApiProblem(400, "بعد حفظ الدرجات يمكن تغيير موعد الامتحان فقط. بقية البيانات محفوظة لحماية النتائج.");
    }
    const [classRecord] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId));
    const [subject] = await tx.select().from(subjectsTable).where(eq(subjectsTable.id, body.subjectId));
    const [session] = await tx.select().from(examSessionsTable).where(eq(examSessionsTable.id, body.sessionId));
    if (!classRecord || !subject || !session || subject.classId !== body.classId || session.academicYear !== classRecord.academicYear) throw new ApiProblem(400, "الصف والمادة والفترة غير متطابقة");
    const conflicts = await tx.select({ id: examsTable.id }).from(examsTable).where(and(eq(examsTable.classId, body.classId), eq(examsTable.sessionId, body.sessionId), eq(examsTable.examDate, examDate)));
    if (conflicts.some((item) => item.id !== id)) throw new ApiProblem(400, "يوجد امتحان آخر للصف نفسه في هذا اليوم والفترة");
    await tx.update(examsTable).set({ ...body, examDate }).where(eq(examsTable.id, id));
    await audit(tx, currentAccount(res), "update", "exams", id, `تعديل امتحان ${subject.name}`);
  });
  res.json((await exams({ id }))[0]);
});
router.delete("/exams/:id", admin, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [grade] = await tx.select({ id: gradesTable.id }).from(gradesTable).where(eq(gradesTable.examId, id)).limit(1);
    if (grade) throw new ApiProblem(400, "الامتحان يحتوي على درجات محفوظة ولا يمكن حذفه");
    const [record] = await tx.delete(examsTable).where(eq(examsTable.id, id)).returning();
    if (!record) throw new ApiProblem(404, "الامتحان غير موجود");
    await audit(tx, currentAccount(res), "delete", "exams", id, "حذف موعد امتحان دون درجات");
  });
  res.sendStatus(204);
});

router.get("/grades", async (req, res) => { res.json(await grades(parse(ListGradesQueryParams, queryValues(req)))); });
router.put("/grades/bulk", educator, async (req, res) => {
  const body = parse(SaveGradesBody, req.body);
  if (!body.grades.length || body.grades.length > 5000) throw new ApiProblem(400, "أدخل درجات طالب واحد على الأقل، وبحد أقصى 5000 طالب");
  const studentIds = body.grades.map((item) => item.studentId);
  if (new Set(studentIds).size !== studentIds.length) throw new ApiProblem(400, "لا يمكن تكرار الطالب في كشف الدرجات");
  await db.transaction(async (tx) => {
    const [exam] = await tx.select().from(examsTable).where(eq(examsTable.id, body.examId)).for("update");
    if (!exam) throw new ApiProblem(404, "الامتحان غير موجود");
    const enrolled = await tx.select({ id: studentsTable.id }).from(studentsTable)
      .where(and(inArray(studentsTable.id, studentIds), eq(studentsTable.classId, exam.classId), eq(studentsTable.active, true))).for("share");
    if (enrolled.length !== studentIds.length) throw new ApiProblem(400, "جميع الطلاب يجب أن يكونوا نشطين ومسجلين في صف الامتحان");
    if (body.grades.some((item) => !Number.isFinite(item.score) || item.score > exam.totalMarks)) {
      throw new ApiProblem(400, `الدرجة يجب أن تكون بين صفر و${exam.totalMarks}`);
    }
    const previous = await tx.select().from(gradesTable).where(and(eq(gradesTable.examId, exam.id), inArray(gradesTable.studentId, studentIds)));
    for (const grade of body.grades) {
      const old = previous.find((item) => item.studentId === grade.studentId);
      if (old && old.score !== grade.score && !grade.note?.trim()) throw new ApiProblem(400, "أدخل سبب تعديل الدرجة في حقل الملاحظة قبل الحفظ");
      const values = { examId: exam.id, studentId: grade.studentId, score: grade.score, note: grade.note?.trim() || null };
      await tx.insert(gradesTable).values(values).onConflictDoUpdate({
        target: [gradesTable.examId, gradesTable.studentId], set: { score: values.score, note: values.note, updatedAt: new Date() },
      });
    }
    const changeDescription = body.grades.map((grade) => {
      const old = previous.find((item) => item.studentId === grade.studentId);
      return `طالب #${grade.studentId}: ${old?.score ?? "غير مدخلة"} ← ${grade.score}${grade.note ? ` (${grade.note})` : ""}`;
    }).join("؛ ");
    await audit(tx, currentAccount(res), "save", "grades", exam.id, `حفظ درجات ${body.grades.length} طالب في الامتحان رقم ${exam.id}. ${changeDescription}`, {
      previous: previous.map((item) => ({ studentId: item.studentId, score: item.score, note: item.note })),
      next: body.grades,
    });
  });
  res.json(await grades({ examId: body.examId }));
});

router.get("/attendance", async (req, res) => {
  const query = parse(ListAttendanceQueryParams, queryValues(req));
  const from = query.from?.toISOString().slice(0, 10);
  const to = query.to?.toISOString().slice(0, 10);
  if (from && to && from > to) throw new ApiProblem(400, "تاريخ البداية يجب أن يسبق النهاية");
  res.json(await attendance({ from, to, classId: query.classId, studentId: query.studentId }));
});
router.post("/attendance/bulk", educator, async (req, res) => {
  const body = parse(RecordClassAttendanceBody, req.body);
  const attendanceDate = calendarDate(req.body.attendanceDate);
  if (attendanceDate > baghdadToday()) throw new ApiProblem(400, "لا يمكن تسجيل الحضور لتاريخ مستقبلي");
  const result = await db.transaction(async (tx) => {
    const [cls] = await tx.select().from(classesTable).where(eq(classesTable.id, body.classId)).for("share");
    if (!cls?.active) throw new ApiProblem(400, "اختر صفاً فعالاً");
    const enrolled = await tx.select({ id: studentsTable.id }).from(studentsTable)
      .where(and(eq(studentsTable.classId, cls.id), eq(studentsTable.active, true))).for("share");
    if (enrolled.length > 5000) throw new ApiProblem(400, "الحد الأعلى للتسجيل الجماعي 5000 طالب في الصف");
    const saved = enrolled.length ? await tx.insert(attendanceTable).values(enrolled.map((student) => ({
      studentId: student.id, classId: cls.id, attendanceDate, status: "present", note: null,
    }))).onConflictDoNothing({ target: [attendanceTable.studentId, attendanceTable.attendanceDate] }).returning({ id: attendanceTable.id }) : [];
    await audit(tx, currentAccount(res), "record", "attendance", cls.id, `تسجيل حضور ${saved.length} طالب في صف ${cls.gradeLevel} بتاريخ ${attendanceDate}; لم تُغيّر السجلات السابقة`, {
      attendanceDate, savedCount: saved.length, skippedCount: enrolled.length - saved.length,
    });
    return { savedCount: saved.length, skippedCount: enrolled.length - saved.length };
  });
  res.json(result);
});
router.post("/attendance", educator, async (req, res) => {
  const body = parse(RecordAttendanceBody, req.body);
  const attendanceDate = calendarDate(req.body.attendanceDate);
  if (attendanceDate > baghdadToday()) throw new ApiProblem(400, "لا يمكن تسجيل الحضور لتاريخ مستقبلي");
  if (!body.studentId && !body.barcode) throw new ApiProblem(400, "اختر طالباً أو أدخل الباركود");
  const [student] = await students({ id: body.studentId, code: body.barcode?.trim(), active: true });
  if (!student) throw new ApiProblem(404, "الطالب غير موجود أو مؤرشف");
  const id = await db.transaction(async (tx) => {
    const [record] = await tx.insert(attendanceTable).values({
      studentId: student.id, classId: student.classId, attendanceDate, status: body.status, note: body.note?.trim() || null,
    }).onConflictDoUpdate({
      target: [attendanceTable.studentId, attendanceTable.attendanceDate],
      set: { status: body.status, note: body.note?.trim() || null, updatedAt: new Date() },
    }).returning();
    await audit(tx, currentAccount(res), "record", "attendance", record!.id, `تسجيل حالة حضور ${student.fullName} بتاريخ ${attendanceDate}`);
    return record!.id;
  });
  res.status(201).json((await attendance({ id }))[0]);
});
router.delete("/attendance/:id", educator, async (req, res) => {
  const id = recordId(req.params.id);
  await db.transaction(async (tx) => {
    const [record] = await tx.delete(attendanceTable).where(eq(attendanceTable.id, id)).returning();
    if (!record) throw new ApiProblem(404, "سجل الحضور غير موجود");
    await audit(tx, currentAccount(res), "delete", "attendance", id, `حذف حالة حضور بتاريخ ${record.attendanceDate}`);
  });
  res.sendStatus(204);
});

export default router;
