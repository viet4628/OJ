import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { difficultyLabels } from './ProblemDifficulty';

type PickerProblem = { id: string; title: string; slug: string; difficulty: 'Easy' | 'Medium' | 'Hard' };

/** Search the problem bank, tick problems and order the selection (contests, learning tracks). */
export default function OrderedProblemPicker({ problems, selected, onChange, loading = false, renderItemExtra, emptyText }: {
  problems: PickerProblem[];
  selected: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
  renderItemExtra?: (id: string, title: string) => ReactNode;
  emptyText: string;
}) {
  const [search, setSearch] = useState('');
  const move = (index: number, offset: number) => {
    const next = [...selected];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  const filtered = problems.filter(p => `${p.title} ${p.slug}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const control = 'inline-flex items-center justify-center p-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30';
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
    <div className="space-y-2 min-w-0">
      <label className="block text-xs">Tìm bài trong ngân hàng
        <input type="search" placeholder="Tìm bài tập..." value={search} onChange={e => setSearch(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-sm focus:outline-none focus:border-[var(--accent)]" />
      </label>
      <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] rounded-md">
        {filtered.slice(0, 50).map(p => <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-tertiary)] text-xs">
          <input type="checkbox" aria-label={p.title} checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="accent-[var(--accent)]" />
          <span className="flex-1 min-w-0 break-words">{p.title}</span>
          <span className="text-[var(--text-muted)]">{difficultyLabels[p.difficulty]}</span>
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
            <div className="flex items-start gap-2 text-xs"><span className="text-[var(--text-muted)]">{index + 1}.</span><span className="flex-1 break-words">{title}</span>
              <button type="button" aria-label={`Bỏ ${title}`} title="Bỏ bài" onClick={() => toggle(id)} className={control}><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Đưa ${title} lên`} title="Đưa lên" disabled={index === 0} onClick={() => move(index, -1)} className={control}><ArrowUp size={14} /></button>
              <button type="button" aria-label={`Đưa ${title} xuống`} title="Đưa xuống" disabled={index === selected.length - 1} onClick={() => move(index, 1)} className={control}><ArrowDown size={14} /></button>
              {renderItemExtra?.(id, title)}
            </div>
          </li>;
        })}
      </ol>
      {!selected.length && !loading && <p className="text-xs text-[var(--text-muted)]">{emptyText}</p>}
    </div>
  </div>;
}
