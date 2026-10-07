import {
  db, classesTable, studentsTable, subjectsTable, examSessionsTable, examsTable,
  gradesTable, attendanceTable, activityLogsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

export async function classes() {
  return db.select({
    id: classesTable.id, gradeLevel: classesTable.gradeLevel, section: classesTable.section,
    academicYear: classesTable.academicYear, room: classesTable.room, active: classesTable.active,
    studentCount: sql<number>`(select count(*)::int from students where students.class_id = ${classesTable.id} and students.active = true)`,
  }).from(classesTable).orderBy(asc(classesTable.gradeLevel), asc(classesTable.section));
}

type StudentFilters = { search?: string; classId?: number; academicYear?: string; sort?: "name" | "code" | "newest"; active?: boolean; id?: number; code?: string };
function studentConditions(filters: StudentFilters) {
  const conditions: SQL[] = [];
  if (filters.id !== undefined) conditions.push(eq(studentsTable.id, filters.id));
  if (filters.classId !== undefined) conditions.push(eq(studentsTable.classId, filters.classId));
  if (filters.academicYear) conditions.push(inArray(studentsTable.classId, db.select({ id: classesTable.id }).from(classesTable).where(eq(classesTable.academicYear, filters.academicYear))));
  if (filters.active !== undefined) conditions.push(eq(studentsTable.active, filters.active));
  if (filters.code !== undefined) conditions.push(or(eq(studentsTable.barcode, filters.code), eq(studentsTable.studentCode, filters.code))!);
  if (filters.search) {
    const escaped = filters.search.replace(/[\\%_]/g, "\\$&");
    conditions.push(or(ilike(studentsTable.fullName, `%${escaped}%`), ilike(studentsTable.studentCode, `%${escaped}%`), ilike(studentsTable.barcode, `%${escaped}%`))!);
  }
  return conditions;
}

export async function students(filters: StudentFilters = {}, pagination?: { page: number; pageSize: number }) {
  return db.select({
    id: studentsTable.id, fullName: studentsTable.fullName, studentCode: studentsTable.studentCode,
    barcode: studentsTable.barcode, gender: studentsTable.gender, dateOfBirth: studentsTable.dateOfBirth,
    guardianName: studentsTable.guardianName, guardianPhone: studentsTable.guardianPhone,
    address: studentsTable.address, classId: studentsTable.classId,
    className: classesTable.gradeLevel, section: classesTable.section, active: studentsTable.active,
    createdAt: studentsTable.createdAt,
  }).from(studentsTable).innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(and(...studentConditions(filters))).orderBy(filters.sort === "code" ? asc(studentsTable.studentCode) : filters.sort === "newest" ? desc(studentsTable.createdAt) : asc(studentsTable.fullName), asc(studentsTable.id))
    .limit(pagination?.pageSize ?? 5000).offset(pagination ? (pagination.page - 1) * pagination.pageSize : 0);
}

export async function studentCount(filters: StudentFilters = {}) {
  const [result] = await db.select({ total: count() }).from(studentsTable).where(and(...studentConditions(filters)));
  return result!.total;
}

export async function subjects(classId?: number) {
  return db.select({
    id: subjectsTable.id, classId: subjectsTable.classId, className: classesTable.gradeLevel,
    section: classesTable.section, name: subjectsTable.name, code: subjectsTable.code,
    totalMarks: subjectsTable.totalMarks, passingMarks: subjectsTable.passingMarks,
  }).from(subjectsTable).innerJoin(classesTable, eq(subjectsTable.classId, classesTable.id))
    .where(classId === undefined ? undefined : eq(subjectsTable.classId, classId)).orderBy(asc(subjectsTable.name));
}

export async function exams(filters: { classId?: number; sessionId?: number; id?: number } = {}) {
  const conditions: SQL[] = [];
  if (filters.classId !== undefined) conditions.push(eq(examsTable.classId, filters.classId));
  if (filters.sessionId !== undefined) conditions.push(eq(examsTable.sessionId, filters.sessionId));
  if (filters.id !== undefined) conditions.push(eq(examsTable.id, filters.id));
  return db.select({
    id: examsTable.id, sessionId: examsTable.sessionId, sessionName: examSessionsTable.name,
    classId: examsTable.classId, className: classesTable.gradeLevel, section: classesTable.section,
    subjectId: examsTable.subjectId, subjectName: subjectsTable.name,
    examDate: examsTable.examDate, totalMarks: examsTable.totalMarks,
  }).from(examsTable).innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .innerJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
    .innerJoin(examSessionsTable, eq(examsTable.sessionId, examSessionsTable.id))
    .where(and(...conditions)).orderBy(asc(examsTable.examDate), asc(subjectsTable.name));
}

export async function grades(filters: { examId?: number; studentId?: number; academicYear?: string; classId?: number; sessionId?: number; subjectId?: number } = {}) {
  const conditions: SQL[] = [];
  if (filters.examId !== undefined) conditions.push(eq(gradesTable.examId, filters.examId));
  if (filters.studentId !== undefined) conditions.push(eq(gradesTable.studentId, filters.studentId));
  if (filters.academicYear) conditions.push(eq(classesTable.academicYear, filters.academicYear));
  if (filters.classId !== undefined) conditions.push(eq(examsTable.classId, filters.classId));
  if (filters.sessionId !== undefined) conditions.push(eq(examsTable.sessionId, filters.sessionId));
  if (filters.subjectId !== undefined) conditions.push(eq(examsTable.subjectId, filters.subjectId));
  return db.select({
    id: gradesTable.id, examId: gradesTable.examId, studentId: gradesTable.studentId,
    studentName: studentsTable.fullName, studentCode: studentsTable.studentCode,
    className: sql<string>`concat(${classesTable.gradeLevel}, ' / ', ${classesTable.section})`,
    subjectName: subjectsTable.name, examTitle: examSessionsTable.name,
    score: gradesTable.score, maxScore: examsTable.totalMarks, note: gradesTable.note, updatedAt: gradesTable.updatedAt,
  }).from(gradesTable).innerJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id))
    .innerJoin(examsTable, eq(gradesTable.examId, examsTable.id))
    .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .innerJoin(subjectsTable, eq(examsTable.subjectId, subjectsTable.id))
    .innerJoin(examSessionsTable, eq(examsTable.sessionId, examSessionsTable.id))
    .where(and(...conditions)).orderBy(asc(studentsTable.fullName), asc(subjectsTable.name));
}

export async function attendance(filters: { from?: string; to?: string; academicYear?: string; studentId?: number; classId?: number; id?: number } = {}) {
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(attendanceTable.attendanceDate, filters.from));
  if (filters.to) conditions.push(lte(attendanceTable.attendanceDate, filters.to));
  if (filters.classId !== undefined) conditions.push(eq(attendanceTable.classId, filters.classId));
  if (filters.studentId !== undefined) conditions.push(eq(attendanceTable.studentId, filters.studentId));
  if (filters.academicYear) conditions.push(eq(classesTable.academicYear, filters.academicYear));
  if (filters.id !== undefined) conditions.push(eq(attendanceTable.id, filters.id));
  return db.select({
    id: attendanceTable.id, studentId: attendanceTable.studentId, studentName: studentsTable.fullName,
    studentCode: studentsTable.studentCode, barcode: studentsTable.barcode,
    classId: attendanceTable.classId, className: classesTable.gradeLevel, section: classesTable.section,
    attendanceDate: attendanceTable.attendanceDate, status: attendanceTable.status, note: attendanceTable.note,
  }).from(attendanceTable).innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
    .where(and(...conditions)).orderBy(desc(attendanceTable.attendanceDate), asc(studentsTable.fullName));
}

export async function activity(limit = 30, filters: { page?: number; search?: string; entity?: string; action?: string } = {}) {
  const conditions: SQL[] = [];
  if (filters.entity) conditions.push(eq(activityLogsTable.entity, filters.entity));
  if (filters.action) conditions.push(eq(activityLogsTable.action, filters.action));
  if (filters.search) {
    const term = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(activityLogsTable.actorName, term), sql`${activityLogsTable.details}::text ilike ${term}`)!);
  }
  const records = await db.select().from(activityLogsTable).where(and(...conditions)).orderBy(desc(activityLogsTable.createdAt), desc(activityLogsTable.id))
    .limit(limit).offset(((filters.page ?? 1) - 1) * limit);
  return records.map((item) => ({
    id: item.id, actorName: item.actorName, action: item.action, entity: item.entity, recordId: item.recordId,
    details: typeof item.details.message === "string" ? item.details.message : JSON.stringify(item.details),
    createdAt: item.createdAt.toISOString(),
  }));
}
