import { supabase } from '../supabase';
import type { Classroom, ClassroomMember, ClassroomProblem, ClassroomProgressItem } from './types';

export async function getClassrooms(teacherOnly = false): Promise<Classroom[]> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) return [];

  let query = supabase
    .from('classrooms')
    .select('*, teacher:profiles_public!classrooms_teacher_id_fkey(username:full_name, full_name, avatar_url)')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (teacherOnly) {
    query = query.eq('teacher_id', user.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  const classIds = data.map((c) => c.id);
  if (classIds.length === 0) return [];

  const [membersRes, problemsRes] = await Promise.all([
    supabase.from('classroom_members').select('classroom_id').in('classroom_id', classIds),
    supabase.from('classroom_problems').select('classroom_id').in('classroom_id', classIds),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (problemsRes.error) throw problemsRes.error;

  const memberCounts: Record<string, number> = {};
  (membersRes.data || []).forEach((m) => {
    memberCounts[m.classroom_id] = (memberCounts[m.classroom_id] || 0) + 1;
  });

  const problemCounts: Record<string, number> = {};
  (problemsRes.data || []).forEach((p) => {
    problemCounts[p.classroom_id] = (problemCounts[p.classroom_id] || 0) + 1;
  });

  return (data as any[]).map((c) => ({
    ...c,
    student_count: memberCounts[c.id] || 0,
    problem_count: problemCounts[c.id] || 0,
  }));
}
export async function getClassroomDetail(classId: string): Promise<{
  classroom: Classroom | null;
  members: ClassroomMember[];
  problems: ClassroomProblem[];
  error?: string;
}> {
  try {
    const [classRes, membersRes, problemsRes] = await Promise.all([
      supabase
        .from('classrooms')
        .select('*, teacher:profiles_public!classrooms_teacher_id_fkey(username:full_name, full_name, avatar_url)')
        .eq('id', classId)
        .single(),
      supabase
        .from('classroom_members')
        .select('*, profile:profiles_public!classroom_members_user_id_fkey(id, username:full_name, full_name, avatar_url)')
        .eq('classroom_id', classId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('classroom_problems')
        .select('*, problem:problems!problem_id(*)')
        .eq('classroom_id', classId)
        .order('sort_order', { ascending: true }),
    ]);

    const error = classRes.error || membersRes.error || problemsRes.error;
    if (error) return { classroom: null, members: [], problems: [], error: error.message };

    return {
      classroom: classRes.data as Classroom,
      members: (membersRes.data || []) as unknown as ClassroomMember[],
      problems: (problemsRes.data || []) as unknown as ClassroomProblem[],
    };
  } catch (err: any) {
    return { classroom: null, members: [], problems: [], error: err.message || 'Lỗi tải dữ liệu lớp học' };
  }
}
export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => chars[value % chars.length]).join('');
}
export async function createClassroom(input: {
  name: string;
  description?: string;
  code?: string;
}): Promise<{ ok: boolean; classroom?: Classroom; error?: string }> {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const customCode = input.code?.trim().toUpperCase() || '';
  if (!name || name.length > 120) return { ok: false, error: 'Tên lớp cần có từ 1 đến 120 ký tự.' };
  if (description && description.length > 2000) return { ok: false, error: 'Mô tả tối đa 2.000 ký tự.' };
  if (customCode && !/^[A-Z0-9]{4,10}$/.test(customCode)) {
    return { ok: false, error: 'Mã mời cần có 4–10 ký tự, chỉ gồm chữ A–Z và số 0–9.' };
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
    // Only retry a confirmed unique-code conflict; never retry an ambiguous network failure.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.from('classrooms').insert({
        name, description, code: customCode || generateClassCode(), teacher_id: user.id,
      }).select('*').single();
      if (!error) return { ok: true, classroom: data as Classroom };
      if (error.code === '23505') {
        if (customCode) return { ok: false, error: 'Mã mời này đã được sử dụng. Hãy chọn mã khác hoặc để trống để tạo tự động.' };
        continue;
      }
      if (error.code === '42501') return { ok: false, error: 'Bạn chưa có quyền tạo lớp học. Vui lòng liên hệ quản trị viên.' };
      return { ok: false, error: 'Chưa xác nhận được kết quả tạo lớp. Hãy tải lại danh sách lớp trước khi thử lại.' };
    }
    return { ok: false, error: 'Chưa tạo được mã mời duy nhất. Vui lòng thử lại.' };
  } catch {
    return { ok: false, error: 'Mất kết nối khi tạo lớp. Hãy tải lại danh sách lớp trước khi thử lại.' };
  }
}
export async function updateClassroom(
  id: string,
  input: Partial<Pick<Classroom, 'name' | 'description' | 'is_archived'>>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('classrooms').update(input).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function deleteClassroom(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error: rpcErr } = await supabase.rpc('delete_classroom', { p_classroom_id: id });
  if (!rpcErr) return { ok: true };

  const { data, error } = await supabase.from('classrooms').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: rpcErr?.message || 'Không thể xóa lớp học.' };
  return { ok: true };
}
export async function joinClassroomByCode(code: string): Promise<{ ok: boolean; classroom?: Classroom; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { ok: false, error: 'Vui lòng nhập mã lớp' };

  const { data, error } = await supabase.rpc('join_classroom', { p_code: cleanCode });
  if (error) return { ok: false, error: error.message };
  return { ok: true, classroom: data as Classroom };
}
export async function addClassroomProblem(
  classId: string,
  problemId: string,
  deadline?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('classroom_problems').insert({
    classroom_id: classId,
    problem_id: problemId,
    deadline: deadline || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function removeClassroomProblem(classId: string, problemId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('classroom_problems')
    .delete()
    .eq('classroom_id', classId)
    .eq('problem_id', problemId)
    .select('problem_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Không thể xóa bài tập khỏi lớp' };
  return { ok: true };
}
export async function removeClassroomMember(classId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('classroom_members')
    .delete()
    .eq('classroom_id', classId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Không thể xóa học sinh khỏi lớp' };
  return { ok: true };
}
export async function getClassroomProgress(classId: string, problemIds: string[], userIds: string[]): Promise<ClassroomProgressItem[]> {
  if (problemIds.length === 0 || userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('get_classroom_progress', { p_classroom_id: classId });
  if (error) throw new Error(error.message);
  return (data || []).filter((row: any) => problemIds.includes(row.problem_id) && userIds.includes(row.user_id))
    .map((row: any) => ({ userId: row.user_id, problemId: row.problem_id, status: row.status,
      score: row.score, time_used_ms: row.time_used_ms, submitted_at: row.created_at }));
}
