import { useEffect, useState } from 'react';
import { RewardSwatch } from '../../../components/Rewards';
import {
  equipReward, getEarnedRewards, getRewardCatalog, getUserProfile,
  type EarnedReward, type Reward, type RewardKind,
} from '../../../lib/api';

const KIND_LABEL: Record<RewardKind, string> = { frame: 'Khung avatar', banner: 'Nền hồ sơ' };

/** Rewards earned in contests; equip one frame and one banner shown on the public profile. */
export default function RewardCollection({ userId }: { userId: string }) {
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [earned, setEarned] = useState<EarnedReward[]>([]);
  const [equipped, setEquipped] = useState<Record<RewardKind, string | null>>({ frame: null, banner: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getRewardCatalog(), getEarnedRewards(userId), getUserProfile(userId)]).then(([items, rows, profile]) => {
      if (!active) return;
      setCatalog(items); setEarned(rows);
      setEquipped({ frame: profile?.equipped_frame ?? null, banner: profile?.equipped_banner ?? null });
    }).catch(() => { if (active) setError('Không tải được bộ sưu tập.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const choose = async (kind: RewardKind, rewardId: string | null) => {
    setBusy(true); setError('');
    try { await equipReward(kind, rewardId); setEquipped(prev => ({ ...prev, [kind]: rewardId })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không trang bị được phần thưởng'); }
    finally { setBusy(false); }
  };

  // One entry per reward, with the contests it came from (newest first).
  const owned = catalog.filter(r => earned.some(e => e.reward_id === r.id));
  return <section aria-labelledby="reward-collection" className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-4">
    <div className="border-b border-[var(--border)] pb-3">
      <h2 id="reward-collection" className="text-sm font-bold text-[var(--text-primary)]">Bộ sưu tập phần thưởng</h2>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Giành phần thưởng qua các kỳ thi. Khung avatar và nền đang dùng hiển thị trên trang hồ sơ công khai.</p>
    </div>
    {loading ? <p role="status" className="text-xs">Đang tải bộ sưu tập...</p>
      : !owned.length ? <p className="text-xs text-[var(--text-secondary)]">Bạn chưa có phần thưởng nào. Tham gia kỳ thi có phần thưởng để mở khóa khung avatar và nền hồ sơ.</p>
      : (['frame', 'banner'] as RewardKind[]).map(kind => {
        const items = owned.filter(r => r.kind === kind);
        if (!items.length) return null;
        return <div key={kind} className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">{KIND_LABEL[kind]}</h3>
          <ul className="space-y-2">
            {items.map(reward => {
              const sources = earned.filter(e => e.reward_id === reward.id);
              const active = equipped[kind] === reward.id;
              return <li key={reward.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-xs ${active ? 'border-accent/40 bg-accent/5' : 'border-[var(--border)] bg-[var(--bg-secondary)]'}`}>
                <RewardSwatch rewardId={reward.id} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)]">{reward.name}</div>
                  <div className="text-[var(--text-muted)] truncate">{sources.map(s => `${s.contest_title} (hạng ${s.rank})`).join(', ')}</div>
                </div>
                {active
                  ? <button type="button" disabled={busy} onClick={() => void choose(kind, null)} className="px-2.5 py-1 rounded-md border border-[var(--border)] disabled:opacity-50">Bỏ trang bị</button>
                  : <button type="button" disabled={busy} onClick={() => void choose(kind, reward.id)} className="px-2.5 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50">Trang bị</button>}
              </li>;
            })}
          </ul>
        </div>;
      })}
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
  </section>;
}
