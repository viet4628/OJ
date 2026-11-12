import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { RewardSwatch } from '../../../components/Rewards';
import {
  awardContestRewards, getContestRewards, getRewardCatalog, setContestRewards,
  type ContestRewardRule, type Reward,
} from '../../../lib/api';

const field = 'px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-xs focus:outline-none focus:border-[var(--accent)]';

/**
 * Contest prizes: rank rules (each player gets the best tier reached per kind,
 * plus participation prizes) and the award action once the contest has ended.
 */
export default function ContestRewardsEditor({ contestId, ended, disabled }: { contestId: string; ended: boolean; disabled: boolean }) {
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [rules, setRules] = useState<ContestRewardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmAward, setConfirmAward] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([getRewardCatalog(), getContestRewards(contestId)]).then(([items, current]) => {
      if (active) { setCatalog(items); setRules(current); }
    }).catch(() => { if (active) setLoadError('Không tải được phần thưởng.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contestId, attempt]);

  const update = (index: number, patch: Partial<ContestRewardRule>) => {
    setRules(prev => prev.map((rule, i) => i === index ? { ...rule, ...patch } : rule)); setNotice('');
  };
  const unused = catalog.filter(r => !rules.some(rule => rule.reward_id === r.id));
  const nameOf = (id: string) => catalog.find(r => r.id === id)?.name ?? id;

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await setContestRewards(contestId, rules); setNotice('Đã lưu phần thưởng.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được phần thưởng'); }
    finally { setBusy(false); }
  };
  const award = async () => {
    setBusy(true); setError(''); setNotice(''); setConfirmAward(false);
    try {
      const count = await awardContestRewards(contestId);
      setNotice(count ? `Đã trao ${count} phần thưởng.` : 'Không có phần thưởng mới để trao.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không trao được giải'); }
    finally { setBusy(false); }
  };

  return <section aria-label="Phần thưởng" className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 sm:p-5 space-y-4 text-[var(--text-primary)]">
    <div>
      <h3 className="text-sm font-semibold">Phần thưởng</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Đặt khung avatar và nền hồ sơ theo hạng. Mỗi thí sinh nhận bậc cao nhất đạt được cho từng loại; giải theo hạng cần có kết quả lớn hơn 0. "Mọi thí sinh" trao cho ai đã nộp bài. Giáo viên và admin không nhận giải.</p>
    </div>
    {loading && <p role="status" className="text-xs">Đang tải phần thưởng...</p>}
    {loadError && <div role="alert" className="text-xs text-[var(--danger)]">{loadError} <button type="button" className="underline" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>}
    {!loading && !loadError && <fieldset disabled={disabled || busy} className="space-y-3 disabled:opacity-60">
      <ol className="space-y-2">
        {rules.map((rule, index) => <li key={rule.reward_id} className="flex flex-wrap items-center gap-2 border border-[var(--border)] rounded-md p-2.5">
          <RewardSwatch rewardId={rule.reward_id} />
          <select aria-label="Phần thưởng" value={rule.reward_id} onChange={e => update(index, { reward_id: e.target.value })} className={field}>
            {[catalog.find(r => r.id === rule.reward_id), ...unused].filter(Boolean).map(r => <option key={r!.id} value={r!.id}>{r!.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={rule.max_rank === null} onChange={e => update(index, { max_rank: e.target.checked ? null : 1 })} className="accent-[var(--accent)]" />
            Mọi thí sinh
          </label>
          {rule.max_rank !== null && <label className="flex items-center gap-1.5 text-xs">Hạng từ 1 đến
            <input type="number" min={1} max={100000} required value={rule.max_rank} onChange={e => update(index, { max_rank: Math.max(1, Number(e.target.value) || 1) })} className={`${field} w-20`} />
          </label>}
          <button type="button" aria-label={`Bỏ ${nameOf(rule.reward_id)}`} onClick={() => { setRules(prev => prev.filter((_, i) => i !== index)); setNotice(''); }}
            className="ml-auto inline-flex items-center justify-center p-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-tertiary)]"><X size={14} /></button>
        </li>)}
      </ol>
      {!rules.length && <p className="text-xs text-[var(--text-muted)]">Chưa có phần thưởng.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!unused.length || rules.length >= 8} onClick={() => { setRules(prev => [...prev, { reward_id: unused[0].id, max_rank: 1 }]); setNotice(''); }}
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-xs disabled:opacity-40">Thêm phần thưởng</button>
        <button type="button" onClick={() => void save()} className="px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs">Lưu phần thưởng</button>
        <span className="flex-1" />
        {!ended ? <span className="text-xs text-[var(--text-muted)]">Trao giải sau khi kỳ thi kết thúc.</span>
          : confirmAward ? <>
            <span className="text-xs">Trao giải theo bảng xếp hạng cuối cùng?</span>
            <button type="button" onClick={() => void award()} className="px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs">Xác nhận trao giải</button>
            <button type="button" onClick={() => setConfirmAward(false)} className="px-3 py-1.5 rounded-md border border-[var(--border)] text-xs">Hủy</button>
          </>
          : <button type="button" disabled={!rules.length} onClick={() => setConfirmAward(true)} className="px-3 py-1.5 rounded-md border border-accent/40 text-[var(--accent-text)] text-xs disabled:opacity-40">Trao giải</button>}
      </div>
    </fieldset>}
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
    {notice && <p role="status" className="text-xs text-[var(--accent-text)]">{notice}</p>}
  </section>;
}
