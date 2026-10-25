import { supabase } from '../supabase';
import type { PermissionCode, Profile, RankUser } from './types';

export async function setAccountSuspension(userId: string, suspended: boolean, reason: string) {
  const { data, error } = await supabase.rpc('set_account_suspension', { p_user_id: userId, p_suspended: suspended, p_reason: reason });
  if (error) throw new Error(error.message);
  return data as { suspended: boolean; revoked_sessions: number };
}

export async function getAdminAuditLog(page = 0) {
  const { data, error } = await supabase.from('admin_audit_log').select('id,actor_id,action,target_id,payload,created_at')
    .order('id', { ascending: false }).range(page * 50, page * 50 + 49);
  if (error) throw new Error(error.message);
  return (data || []) as { id: number; actor_id: string | null; action: string; target_id: string | null; payload: Record<string, unknown>; created_at: string }[];
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
}
export async function updateProfileRole(userId: string, role: Profile['role']) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles_public')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}
export async function getUserRankStats(userId: string): Promise<RankUser | null> {
  const { data, error } = await supabase
    .from('user_rank')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RankUser;
}
export async function getRanklist(params: { page?: number; pageSize?: number; type?: 'ACM' | 'OI'; search?: string } = {}, signal?: AbortSignal): Promise<RankUser[]> {
  const pageSize = params.pageSize ?? 50;
  const offset = (params.page ?? 0) * pageSize;
  let query = supabase.from('user_rank').select('*').eq('role', 'user');
  if (params.search?.trim()) query = query.ilike('username', `%${params.search.trim().replace(/[%_\\]/g, '\\$&')}%`);
  const { data, error } = await query.order(params.type === 'OI' ? 'total_score' : 'accepted_number', { ascending: false })
    .order('user_id', { ascending: true }).range(offset, offset + pageSize - 1)
    .abortSignal(signal ?? AbortSignal.timeout(10000));
  if (error) throw new Error(error.message);
  return (data || []) as RankUser[];
}
export async function getStats() {
  const [{ count: problems }, { count: submissions }, { count: profiles }] = await Promise.all([
    supabase.from('problems').select('id', { count: 'exact', head: true }).eq('is_public', true),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('is_run', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user'),
  ]);
  return {
    problems: problems || 0,
    submissions: submissions || 0,
    profiles: profiles || 0,
  };
}
export async function getMySubmissionCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACCEPTED')
    .eq('is_run', false);
  return count || 0;
}

/* ─────────────── Admin: Users & Permissions ─────────────── */
export const PERMISSION_DEFS: { code: string; label: string; group: string }[] = [
  { code: 'problems.manage', label: 'Quản lý bài tập', group: 'Nội dung' },
  { code: 'testcases.manage', label: 'Quản lý testcases', group: 'Nội dung' },
  { code: 'contests.manage', label: 'Quản lý kỳ thi', group: 'Nội dung' },
  { code: 'announcements.manage', label: 'Quản lý thông báo', group: 'Nội dung' },
  { code: 'submissions.view_all', label: 'Xem mọi bài nộp', group: 'Đánh giá' },
  { code: 'users.manage', label: 'Quản lý user & vai trò', group: 'Hệ thống' },
];
export function hasPermission(
  role: string | undefined,
  permissions: string[],
  requiredPerm: PermissionCode | string
): boolean {
  if (role === 'admin') return true;
  return permissions.includes(requiredPerm);
}
export const DEFAULT_TEACHER_PERMS: string[] = [
  'problems.manage',
  'testcases.manage',
  'contests.manage',
  'submissions.view_all',
];
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_permissions')
    .select('codes')
    .eq('user_id', userId)
    .maybeSingle();
  if (data && Array.isArray((data as any).codes)) {
    return (data as { codes: string[] }).codes;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role === 'teacher') {
    return DEFAULT_TEACHER_PERMS;
  }
  return [];
}
export async function setUserPermissions(userId: string, codes: string[]) {
  const { error } = await supabase
    .from('user_permissions')
    .upsert({ user_id: userId, codes }, { onConflict: 'user_id' });
  if (error) throw error;
}

/* ─────────────── Admin: Problems & Testcases ─────────────── */
export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('system_settings').select('key, value');
  if (error) return {};
  return Object.fromEntries((data || []).map((r) => [r.key as string, r.value as string]));
}
export async function saveSettings(patch: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ─────────────── Account: profile, password, avatar ─────────────── */

export interface JudgeServer {
  id: string;
  last_seen_at: string;
  mode: 'local' | 'engine';
  ready: boolean;
  queued: number;
  processing: number;
}
export async function getJudgeServers(): Promise<JudgeServer[]> {
  const { data, error } = await supabase.from('judge_servers').select('*').order('id');
  if (error) throw error;
  return (data || []) as JudgeServer[];
}
