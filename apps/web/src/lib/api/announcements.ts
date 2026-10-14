import { supabase } from '../supabase';
import type { Announcement, AnnouncementInput } from './types';

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as Announcement[];
}
export async function createAnnouncement(input: AnnouncementInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('announcements').insert(input);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function deleteAnnouncement(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.from('announcements').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Không thể xóa thông báo trên DB (kiểm tra quyền hạn RLS).' };
  }
  return { ok: true };
}

/* ─────────────── Admin: System Settings ─────────────── */
