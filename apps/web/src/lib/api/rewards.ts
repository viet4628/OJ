import { supabase } from '../supabase';

export type RewardKind = 'frame' | 'banner';
export type RewardTier = 'gold' | 'silver' | 'bronze' | 'participant';
export interface Reward { id: string; kind: RewardKind; tier: RewardTier; name: string; sort_order: number }
/** `max_rank` null means every participant. */
export interface ContestRewardRule { reward_id: string; max_rank: number | null }
export interface EarnedReward { id: number; reward_id: string; contest_id: string | null; contest_title: string; rank: number; awarded_at: string }

export async function getRewardCatalog(): Promise<Reward[]> {
  const { data, error } = await supabase.from('rewards').select('*').order('sort_order');
  if (error) throw error;
  return data as Reward[];
}

export async function getContestRewards(contestId: string): Promise<ContestRewardRule[]> {
  const { data, error } = await supabase.from('contest_rewards').select('reward_id,max_rank').eq('contest_id', contestId);
  if (error) throw error;
  // Best tiers first, participation prizes last.
  return (data as ContestRewardRule[]).sort((a, b) => (a.max_rank ?? Infinity) - (b.max_rank ?? Infinity));
}

export async function setContestRewards(contestId: string, rules: ContestRewardRule[]): Promise<void> {
  const { error } = await supabase.rpc('set_contest_rewards', { p_contest_id: contestId, p_rules: rules });
  if (error) throw new Error(error.message);
}

/** Grants the configured prizes from the final standings; returns how many were new. */
export async function awardContestRewards(contestId: string): Promise<number> {
  const { data, error } = await supabase.rpc('award_contest_rewards', { p_contest_id: contestId });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function getEarnedRewards(userId: string): Promise<EarnedReward[]> {
  const { data, error } = await supabase.from('user_rewards').select('id,reward_id,contest_id,contest_title,rank,awarded_at')
    .eq('user_id', userId).order('awarded_at', { ascending: false });
  if (error) throw error;
  return data as EarnedReward[];
}

export async function equipReward(kind: RewardKind, rewardId: string | null): Promise<void> {
  const { error } = await supabase.rpc('equip_reward', { p_kind: kind, p_reward_id: rewardId });
  if (error) throw new Error(error.message);
}

/** Human label for a rule: "Hạng 1", "Hạng 1–3" style ranges are derived by the caller. */
export function ruleLabel(maxRank: number | null): string {
  return maxRank === null ? 'Mọi thí sinh' : maxRank === 1 ? 'Hạng 1' : `Top ${maxRank}`;
}
