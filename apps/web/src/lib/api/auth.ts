import { supabase } from '../supabase';

export async function updateMyProfile(patch: { full_name?: string; avatar_url?: string }): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function changePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function uploadAvatar(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bạn cần đăng nhập' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Chỉ chấp nhận file ảnh' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Ảnh tối đa 2MB' };

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const objectPath = `${user.id}/${Date.now()}.${ext || 'png'}`;
  const { error } = await supabase.storage.from('avatars').upload(objectPath, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };
  const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
  return { ok: true, url: data.publicUrl };
}

/* ─────────────── Classrooms (Hệ thống Lớp học) ─────────────── */
