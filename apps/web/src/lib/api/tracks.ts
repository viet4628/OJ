import { supabase } from '../supabase';
import type { Problem } from './types';

export type TrackProblem = Pick<Problem, 'id' | 'slug' | 'title' | 'difficulty'>;
export interface LearningTrack {
  id: string;
  slug: string;
  title: string;
  description: string;
  sort_order: number;
  is_public: boolean;
  created_by: string | null;
  problems: TrackProblem[];
}
export type LearningTrackInput = Pick<LearningTrack, 'slug' | 'title' | 'description' | 'sort_order' | 'is_public'>;

const TRACK_SELECT = 'id,slug,title,description,sort_order,is_public,created_by,learning_track_problems(sort_order,problems(id,slug,title,difficulty))';

type TrackRow = Omit<LearningTrack, 'problems'> & {
  learning_track_problems: { sort_order: number; problems: TrackProblem | null }[] | null;
};

// Problems hidden by RLS (private ones) come back as null embeds and are skipped.
function toTrack(row: TrackRow): LearningTrack {
  const { learning_track_problems: links, ...track } = row;
  const problems = [...(links || [])].sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(link => link.problems ? [link.problems] : []);
  return { ...track, problems };
}

/** Public tracks for learners, in display order. */
export async function getPublicTracks(): Promise<LearningTrack[]> {
  const { data, error } = await supabase.from('learning_tracks').select(TRACK_SELECT)
    .eq('is_public', true).order('sort_order').order('title');
  if (error) throw error;
  return (data as unknown as TrackRow[]).map(toTrack);
}

export async function getTrackBySlug(slug: string): Promise<LearningTrack | null> {
  const { data, error } = await supabase.from('learning_tracks').select(TRACK_SELECT).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? toTrack(data as unknown as TrackRow) : null;
}

/** Tracks the caller manages: their own, or all for admins (`ownerId` omitted). */
export async function getManagedTracks(ownerId?: string): Promise<LearningTrack[]> {
  let query = supabase.from('learning_tracks').select(TRACK_SELECT).order('sort_order').order('title');
  if (ownerId) query = query.eq('created_by', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TrackRow[]).map(toTrack);
}

export async function saveLearningTrack(id: string | null, track: LearningTrackInput, problemIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('save_learning_track', { p_track_id: id, p_track: track, p_problem_ids: problemIds });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteLearningTrack(id: string): Promise<void> {
  const { data, error } = await supabase.from('learning_tracks').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Không xóa được lộ trình (chỉ người tạo hoặc admin mới xóa được).');
}

/** Solved count and the next unsolved problem of a track, in track order. */
export function trackProgress(track: LearningTrack, solved: ReadonlySet<string>) {
  const done = track.problems.filter(p => solved.has(p.id)).length;
  return { done, total: track.problems.length, next: track.problems.find(p => !solved.has(p.id)) ?? null };
}
