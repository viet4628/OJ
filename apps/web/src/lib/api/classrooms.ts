import { supabase } from '../supabase';
import type { Classroom, ClassroomMember, ClassroomProblem, ClassroomProgressItem } from './types';

export async function getClassrooms(teacherOnly = false): Promise<Classroom[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('classrooms')
    .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (teacherOnly) {
    query = query.eq('teacher_id', user.id);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const classIds = data.map((c) => c.id);
  if (classIds.length === 0) return [];

  const [membersRes, problemsRes] = await Promise.all([
    supabase.from('classroom_members').select('classroom_id').in('classroom_id', classIds),
    supabase.from('classroom_problems').select('classroom_id').in('classroom_id', classIds),
  ]);

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
        .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
        .eq('id', classId)
        .single(),
      supabase
        .from('classroom_members')
        .select('*, profile:profiles!user_id(id, username, full_name, avatar_url)')
        .eq('classroom_id', classId)
        .order('joined_at', { ascending: true }),
      supabase
        .from('classroom_problems')
        .select('*, problem:problems!problem_id(*)')
        .eq('classroom_id', classId)
        .order('sort_order', { ascending: true }),
    ]);

    if (classRes.error) return { classroom: null, members: [], problems: [], error: classRes.error.message };

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
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
export async function createClassroom(input: {
  name: string;
  description?: string;
  code?: string;
}): Promise<{ ok: boolean; classroom?: Classroom; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };

  const code = (input.code && input.code.trim().length >= 4) ? input.code.trim().toUpperCase() : generateClassCode();

  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      code,
      teacher_id: user.id,
    })
    .select('*, teacher:profiles!teacher_id(username, full_name, avatar_url)')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, classroom: data as Classroom };
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
  const { data, error } = await supabase
    .from('submissions')
    .select('user_id, problem_id, status, score, time_used_ms, created_at')
    .in('problem_id', problemIds)
    .in('user_id', userIds)
    .eq('is_run', false)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const map: Record<string, ClassroomProgressItem> = {};
  for (const s of data) {
    const key = `${s.user_id}_${s.problem_id}`;
    const existing = map[key];
    if (!existing) {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    } else if (existing.status !== 'ACCEPTED' && s.status === 'ACCEPTED') {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    } else if (s.score > existing.score) {
      map[key] = {
        userId: s.user_id,
        problemId: s.problem_id,
        status: s.status,
        score: s.score,
        time_used_ms: s.time_used_ms,
        submitted_at: s.created_at,
      };
    }
  }

  return Object.values(map);
}
