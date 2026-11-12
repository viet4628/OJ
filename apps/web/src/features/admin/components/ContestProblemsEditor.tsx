import { useEffect, useState } from 'react';
import OrderedProblemPicker from '../../../components/OrderedProblemPicker';
import { getAllProblems, getContestProblemsAdmin, setContestProblems, type Problem } from '../../../lib/api';

export default function ContestProblemsEditor({ contestId, rule, disabled, onBusyChange }: {
  contestId: string; rule: 'ACM' | 'OI'; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setNotice('');
    Promise.all([getAllProblems(), getContestProblemsAdmin(contestId)]).then(([all, assigned]) => {
      if (!active) return;
      setProblems(all);
      setSelected(assigned.map(row => row.problem_id));
      setScores(Object.fromEntries(assigned.map(row => [row.problem_id, row.score ?? 100])));
    }).catch(() => { if (active) setLoadError('Không tải được danh sách bài thi. Chưa thể chỉnh sửa.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contestId, attempt]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || loadError || saving || disabled) return;
    setSaving(true); onBusyChange(true); setSaveError(''); setNotice('');
    try {
      const result = await setContestProblems(contestId, selected.map(id => ({ problem_id: id, score: scores[id] ?? 100 })));
      if (!result.ok) throw new Error(result.error || 'Không lưu được bài thi');
      setNotice(`Đã lưu ${selected.length} bài thi.`);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Không lưu được bài thi'); }
    finally { setSaving(false); onBusyChange(false); }
  };
  return <section aria-label="Bài thi" className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 sm:p-5 space-y-4">
    <div><h3 className="text-sm font-semibold">Bài thi</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Chọn bài và sắp xếp thứ tự hiển thị cho thí sinh.{rule === 'OI' ? ' Điểm là điểm tối đa của từng bài.' : ''}</p></div>
    {loading && <p role="status" className="text-xs">Đang tải bài thi...</p>}
    {loadError && <div role="alert" className="text-xs text-[var(--danger)]">{loadError} <button type="button" onClick={() => setAttempt(v => v+1)} className="underline">Thử lại</button></div>}
    <form onSubmit={save}>
      <fieldset disabled={disabled || saving || loading || !!loadError} className="space-y-4 disabled:opacity-60">
        <OrderedProblemPicker problems={problems} selected={selected} loading={loading} emptyText="Chưa chọn bài thi."
          onChange={next => { setSelected(next); setNotice(''); }}
          renderItemExtra={rule === 'OI' ? (id, title) => <label className="ml-auto text-xs flex items-center gap-2">Điểm<input aria-label={`Điểm ${title}`} type="number" required min={1} max={100000} step={1} value={scores[id] ?? 100} onChange={e => { setScores(prev => ({ ...prev, [id]: Number(e.target.value) })); setNotice(''); }} className="w-20 p-1.5 border border-[var(--border)] rounded bg-[var(--bg-primary)]" /></label> : undefined} />
        {saveError && <p role="alert" className="text-xs text-[var(--danger)]">{saveError}</p>}
        {notice && <p role="status" className="text-xs text-[var(--accent)]">{notice}</p>}
        <div className="border-t border-[var(--border)] pt-4"><button className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-xs disabled:opacity-50">{saving ? 'Đang lưu bài thi...' : 'Lưu bài thi'}</button></div>
      </fieldset>
    </form>
  </section>;
}
