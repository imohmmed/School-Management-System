/**
 * Isolated integration harness. It is never mounted in the running application.
 * Authentication itself remains Clerk-owned; this tests authorized school actions,
 * real PostgreSQL persistence, role checks, validation and transaction integrity.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express, { type ErrorRequestHandler } from "express";
import { db, pool, activityLogsTable, attendanceTable, gradesTable, examsTable, examSessionsTable, subjectsTable, studentsTable, classesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import register from "../routes/register";
import academic from "../routes/academic";
import management from "../routes/management";
import { ApiProblem, baghdadToday } from "../lib/school-core";

test("school records persist, grades validate atomically, attendance upserts and roles protect writes", async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const actorId = `integration-${suffix}`;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.schoolUser = {
      id: actorId, clerkUserId: null, clerkInvitationId: null, email: `integration-${suffix}@example.invalid`,
      fullName: "اختبار تكامل", role: req.get("x-test-role") ?? "administrator", status: "active",
      createdAt: new Date(), updatedAt: new Date(),
    };
    next();
  });
  app.use("/api", register, academic, management);
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const code = (error as { cause?: { code?: string }; code?: string }).cause?.code ?? (error as { code?: string }).code;
    res.status(error instanceof ApiProblem ? error.status : code?.startsWith("23") ? 400 : 500)
      .json({ message: error instanceof ApiProblem ? error.message : "integration database error" });
  };
  app.use(errors);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const ids = { class: 0, students: [] as number[], subjects: [] as number[], session: 0, exam: 0 };
  const call = async (path: string, method = "GET", body?: unknown, role = "administrator") => {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", "x-test-role": role }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    // This generic test client intentionally accepts both objects and arrays;
    // assertions below verify each endpoint's concrete JSON shape.
    return { status: response.status, data: (response.status === 204 ? null : await response.json()) as any };
  };
  try {
    const forbidden = await call("/classes", "POST", { gradeLevel: "ممنوع", section: "أ", academicYear: "2026-2027", active: true }, "viewer");
    assert.equal(forbidden.status, 403);
    const classInput = { gradeLevel: `صف اختبار ${suffix}`, section: "أ", academicYear: "2026-2027", room: null, active: true };
    const cls = await call("/classes", "POST", classInput);
    assert.equal(cls.status, 201, JSON.stringify(cls.data));
    ids.class = cls.data.id;
    assert.equal((await call("/classes", "POST", classInput)).status, 400);
    const studentInput = { fullName: `طالب اختبار ${suffix}`, studentCode: `T-${suffix}`, classId: ids.class, active: true, dateOfBirth: null };
    const student = await call("/students", "POST", studentInput);
    assert.equal(student.status, 201, JSON.stringify(student.data));
    ids.students.push(student.data.id);
    assert.notEqual(student.data.barcode, studentInput.studentCode);
    assert.equal((await call("/students", "POST", studentInput)).status, 400);
    assert.equal((await call("/students", "POST", { ...studentInput, studentCode: `BAD-${suffix}`, dateOfBirth: "2026-02-30" })).status, 400);
    assert.equal((await call(`/barcode/${student.data.barcode}`)).data.id, student.data.id);
    const second = await call("/students", "POST", { ...studentInput, fullName: `طالب ثان ${suffix}`, studentCode: `T2-${suffix}` });
    assert.equal(second.status, 201);
    ids.students.push(second.data.id);
    const page = await call(`/students/register?classId=${ids.class}&page=1&pageSize=1`);
    assert.equal(page.data.total, 2);
    assert.equal(page.data.records.length, 1);
    const page2 = await call(`/students/register?classId=${ids.class}&page=2&pageSize=1`);
    assert.notEqual(page.data.records[0].id, page2.data.records[0].id);
    const subject = await call("/subjects", "POST", { classId: ids.class, name: `رياضيات ${suffix}`, totalMarks: 100, passingMarks: 80 });
    assert.equal(subject.status, 201);
    ids.subjects.push(subject.data.id);
    const subject2 = await call("/subjects", "POST", { classId: ids.class, name: `علوم ${suffix}`, totalMarks: 100, passingMarks: 50 });
    assert.equal(subject2.status, 201);
    ids.subjects.push(subject2.data.id);
    const session = await call("/exam-sessions", "POST", { name: `دور اختبار ${suffix}`, academicYear: "2026-2027", active: true });
    assert.equal(session.status, 201);
    ids.session = session.data.id;
    const examInput = { sessionId: ids.session, classId: ids.class, subjectId: subject.data.id, examDate: baghdadToday(), totalMarks: 100 };
    const exam = await call("/exams", "POST", examInput);
    assert.equal(exam.status, 201, JSON.stringify(exam.data));
    ids.exam = exam.data.id;
    assert.equal((await call("/exams", "POST", { ...examInput, subjectId: subject2.data.id })).status, 400);
    const gradeInput = { examId: ids.exam, grades: [{ studentId: student.data.id, score: 75 }] };
    assert.equal((await call("/grades/bulk", "PUT", gradeInput, "teacher")).status, 200);
    assert.equal((await call(`/grades?examId=${ids.exam}`)).data[0].score, 75);
    assert.equal((await call("/grades/bulk", "PUT", { examId: ids.exam, grades: [{ studentId: student.data.id, score: 101, note: "خارج الحدود" }] })).status, 400);
    assert.equal((await call("/grades/bulk", "PUT", { examId: ids.exam, grades: [{ studentId: student.data.id, score: 76 }] })).status, 400);
    assert.equal((await call("/grades/bulk", "PUT", { examId: ids.exam, grades: [{ studentId: student.data.id, score: 76, note: "تصحيح ورقة الامتحان" }] })).status, 200);
    const atomic = await call("/grades/bulk", "PUT", { examId: ids.exam, grades: [{ studentId: student.data.id, score: 78, note: "لن تحفظ" }, { studentId: 2147483647, score: 40 }] });
    assert.equal(atomic.status, 400);
    assert.equal((await call(`/grades?examId=${ids.exam}`)).data[0].score, 76);
    assert.equal((await call(`/exams/${ids.exam}`, "DELETE")).status, 400);
    const report = await call(`/reports/grades?classId=${ids.class}&sessionId=${ids.session}`);
    assert.equal(report.status, 200);
    assert.equal(report.data.average, 76);
    assert.equal(report.data.passCount, 0);
    assert.equal(report.data.failCount, 1);
    const date = baghdadToday();
    const absent = await call("/attendance", "POST", { studentId: student.data.id, attendanceDate: date, status: "absent", note: "اختبار" }, "teacher");
    assert.equal(absent.status, 201, JSON.stringify(absent.data));
    const present = await call("/attendance", "POST", { barcode: student.data.barcode, attendanceDate: date, status: "present" }, "teacher");
    assert.equal(present.status, 201);
    assert.equal(present.data.id, absent.data.id);
    const attendance = await call(`/attendance?classId=${ids.class}&from=${date}&to=${date}`);
    assert.equal(attendance.status, 200);
    assert.equal(attendance.data.length, 1);
    assert.equal(attendance.data[0].status, "present");
    const attendanceReport = await call(`/reports/attendance?classId=${ids.class}&from=${date}&to=${date}`);
    assert.equal(attendanceReport.status, 200);
    assert.equal(attendanceReport.data.presentCount, 1);
    assert.equal(attendanceReport.data.absentCount, 0);
    const wholeClass = await call("/attendance/bulk", "POST", { classId: ids.class, attendanceDate: date }, "teacher");
    assert.equal(wholeClass.status, 200);
    assert.equal(wholeClass.data.savedCount, 1);
    assert.equal(wholeClass.data.skippedCount, 1);
    assert.equal((await call("/attendance/bulk", "POST", { classId: ids.class, attendanceDate: date })).data.savedCount, 0);
    assert.equal((await call(`/attendance?studentId=${student.data.id}`)).data.length, 1);
    assert.equal((await call(`/students/register?academicYear=not-this-year&sort=code`)).data.total, 0);
    assert.equal((await call(`/reports/grades?classId=${ids.class}&academicYear=not-this-year`)).data.records.length, 0);
    assert.equal((await call("/attendance", "POST", { studentId: student.data.id, attendanceDate: date, status: "absent" }, "viewer")).status, 403);
    assert.equal((await call(`/classes/${ids.class}`, "DELETE")).status, 400);
    assert.equal((await call(`/students/${student.data.id}`, "DELETE")).status, 204);
    assert.equal((await call(`/barcode/${student.data.barcode}`)).status, 404);
    assert.equal((await call(`/grades?examId=${ids.exam}`)).data[0].score, 76);
    assert.equal((await call(`/activity?search=${suffix}&page=1&limit=100`)).status, 200);
    assert.equal((await call("/users", "GET", undefined, "teacher")).status, 403);
  } finally {
    // Delete only synthetic records whose IDs were created by this test.
    await db.transaction(async (tx) => {
      for (const id of ids.students) {
        await tx.delete(attendanceTable).where(eq(attendanceTable.studentId, id));
        await tx.delete(gradesTable).where(eq(gradesTable.studentId, id));
      }
      if (ids.exam) await tx.delete(examsTable).where(eq(examsTable.id, ids.exam));
      if (ids.session) await tx.delete(examSessionsTable).where(eq(examSessionsTable.id, ids.session));
      for (const id of ids.subjects) await tx.delete(subjectsTable).where(eq(subjectsTable.id, id));
      for (const id of ids.students) await tx.delete(studentsTable).where(eq(studentsTable.id, id));
      if (ids.class) await tx.delete(classesTable).where(eq(classesTable.id, ids.class));
      await tx.delete(activityLogsTable).where(eq(activityLogsTable.actorUserId, actorId));
    });
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
