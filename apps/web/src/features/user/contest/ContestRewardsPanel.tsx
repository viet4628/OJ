import { useEffect, useState } from 'react';
import { RewardSwatch } from '../../../components/Rewards';
import { getContestRewards, getRewardCatalog, type ContestRewardRule, type Reward } from '../../../lib/api';

/** Rank range each prize really covers: per kind, the best tier wins (gold <=1, silver <=3 -> silver is 2-3). */
function rankRanges(rules: ContestRewardRule[], catalog: Reward[]) {
  const kindOf = (id: string) => catalog.find(r => r.id === id)?.kind ?? 'frame';
  const previous: Record<string, number> = {};
  return rules.map(rule => {
    if (rule.max_rank === null) return { rule, label: 'Mọi thí sinh' };
    const kind = kindOf(rule.reward_id);
    const from = (previous[kind] ?? 0) + 1;
    previous[kind] = Math.max(previous[kind] ?? 0, rule.max_rank);
    return { rule, label: from >= rule.max_rank ? `Hạng ${rule.max_rank}` : `Hạng ${from}–${rule.max_rank}` };
  });
}

export default function ContestRewardsPanel({ contestId }: { contestId: string }) {
  const [rules, setRules] = useState<ContestRewardRule[]>([]);
  const [catalog, setCatalog] = useState<Reward[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([getContestRewards(contestId), getRewardCatalog()])
      .then(([rows, items]) => { if (active) { setRules(rows); setCatalog(items); } })
      .catch(() => { /* prizes are optional decoration of the page */ });
    return () => { active = false; };
  }, [contestId]);
  if (!rules.length) return null;
  return <section aria-labelledby="contest-rewards" className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-3">
    <div className="pb-3 border-b border-[var(--border)]">
      <h2 id="contest-rewards" className="text-sm font-bold text-[var(--text-primary)]">Phần thưởng</h2>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Trao theo bảng xếp hạng cuối cùng sau khi kỳ thi kết thúc. Giải theo hạng cần giải được ít nhất một bài (hoặc có điểm).</p>
    </div>
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {rankRanges(rules, catalog).map(({ rule, label }) => <li key={rule.reward_id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs">
        <RewardSwatch rewardId={rule.reward_id} />
        <span className="flex-1 font-medium text-[var(--text-primary)]">{catalog.find(r => r.id === rule.reward_id)?.name ?? rule.reward_id}</span>
        <span className="text-[var(--text-secondary)]">{label}</span>
      </li>)}
    </ul>
  </section>;
}
