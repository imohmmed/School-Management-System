import { getStudentRegister, type GetStudentRegisterParams, type Student } from '@workspace/api-client-react';

/** Reads every register page (100 rows each) until total is reached. Throws instead of returning a partial list. */
export async function fetchAllStudents(params: Omit<GetStudentRegisterParams, 'page' | 'pageSize'>): Promise<Student[]> {
  const out: Student[] = [];
  let total = Infinity;
  for (let page = 1; out.length < total; page++) {
    const r = await getStudentRegister({ ...params, page, pageSize: 100 });
    total = r.total;
    if (r.records.length === 0) break;
    out.push(...r.records);
    if (page > 1000) break;
  }
  if (out.length !== total || new Set(out.map((student) => student.id)).size !== total) {
    throw new Error('تغيّرت قائمة الطلاب أثناء جلبها أو لم تكتمل. أعد المحاولة للحصول على قائمة كاملة دون تكرار.');
  }
  return out;
}
