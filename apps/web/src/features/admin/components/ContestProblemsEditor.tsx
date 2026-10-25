import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { getAllProblems, getContestProblemsAdmin, setContestProblems, type Problem } from '../../../lib/api';

export default function ContestProblemsEditor({ contestId, rule, disabled, onBusyChange }: {
  contestId: string; rule: 'ACM' | 'OI'; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
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
  const move = (index: number, offset: number) => {
    setSelected(prev => { const next = [...prev]; [next[index], next[index+offset]] = [next[index+offset], next[index]]; return next; });
    setNotice('');
  };
  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]);
    setNotice('');
  };
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
  const filtered = problems.filter(p => `${p.title} ${p.slug}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const control = 'inline-flex items-center justify-center p-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30';
  return <section aria-label="Bài thi" className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 sm:p-5 space-y-4">
    <div><h3 className="text-sm font-semibold">Bài thi</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Chọn bài và sắp xếp thứ tự hiển thị cho thí sinh.{rule === 'OI' ? ' Điểm là điểm tối đa của từng bài.' : ''}</p></div>
    {loading && <p role="status" className="text-xs">Đang tải bài thi...</p>}
    {loadError && <div role="alert" className="text-xs text-[var(--danger)]">{loadError} <button type="button" onClick={() => setAttempt(v => v+1)} className="underline">Thử lại</button></div>}
    <form onSubmit={save}>
      <fieldset disabled={disabled || saving || loading || !!loadError} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="space-y-2 min-w-0">
            <label className="block text-xs">Tìm bài trong ngân hàng
              <input type="search" placeholder="Tìm bài tập..." value={search} onChange={e => setSearch(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </label>
            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] rounded-md">
              {filtered.slice(0, 50).map(p => <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-tertiary)] text-xs">
                <input type="checkbox" aria-label={p.title} checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="accent-[var(--accent)]" />
                <span className="flex-1 min-w-0 break-words">{p.title}</span>
                <span className="text-[var(--text-muted)]">{p.difficulty === 'Easy' ? 'Dễ' : p.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}</span>
              </label>)}
              {!loading && !filtered.length && <p className="p-3 text-xs text-[var(--text-muted)]">Không có bài phù hợp.</p>}
            </div>
            {filtered.length > 50 && <p className="text-xs text-[var(--text-muted)]">Hiển thị 50/{filtered.length} bài. Nhập tên để thu hẹp kết quả.</p>}
          </div>
          <div className="min-w-0 space-y-2">
            <h4 className="text-xs font-medium">Đã chọn {selected.length} bài</h4>
            <ol className="space-y-2">
              {selected.map((id, index) => {
                const title = problems.find(p => p.id === id)?.title || 'Bài chưa tải được tên';
                return <li key={id} className="border border-[var(--border)] rounded-md p-3 space-y-2">
                  <div className="flex items-start gap-2 text-xs"><span className="text-[var(--text-muted)]">{index+1}.</span><span className="flex-1 break-words">{title}</span>
                    <button type="button" aria-label={`Bỏ ${title}`} title="Bỏ bài" onClick={() => toggle(id)} className={control}><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={`Đưa ${title} lên`} title="Đưa lên" disabled={index === 0} onClick={() => move(index, -1)} className={control}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Đưa ${title} xuống`} title="Đưa xuống" disabled={index === selected.length-1} onClick={() => move(index, 1)} className={control}><ArrowDown size={14} /></button>
                    {rule === 'OI' && <label className="ml-auto text-xs flex items-center gap-2">Điểm<input aria-label={`Điểm ${title}`} type="number" required min={1} max={100000} step={1} value={scores[id] ?? 100} onChange={e => { setScores(prev => ({ ...prev, [id]: Number(e.target.value) })); setNotice(''); }} className="w-20 p-1.5 border border-[var(--border)] rounded bg-[var(--bg-primary)]" /></label>}
                  </div>
                </li>;
              })}
            </ol>
            {!selected.length && !loading && <p className="text-xs text-[var(--text-muted)]">Chưa chọn bài thi.</p>}
          </div>
        </div>
        {saveError && <p role="alert" className="text-xs text-[var(--danger)]">{saveError}</p>}
        {notice && <p role="status" className="text-xs text-[var(--accent)]">{notice}</p>}
        <div className="border-t border-[var(--border)] pt-4"><button className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-xs disabled:opacity-50">{saving ? 'Đang lưu bài thi...' : 'Lưu bài thi'}</button></div>
      </fieldset>
    </form>
  </section>;
}
