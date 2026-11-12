import { useEffect, useState } from 'react';
import OrderedProblemPicker from '../../../components/OrderedProblemPicker';
import { slugifyVietnamese } from '../../../lib/slug';
import {
  deleteLearningTrack, getAllProblems, getManagedTracks, saveLearningTrack,
  type LearningTrack, type LearningTrackInput, type Problem,
} from '../../../lib/api';

const EMPTY: LearningTrackInput = { slug: '', title: '', description: '', sort_order: 0, is_public: false };
const field = 'block w-full mt-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-sm focus:outline-none focus:border-[var(--accent)]';

/** Curated learning tracks: ordered problem sets learners follow on /learn. */
export default function LearningTracksTab({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const [tracks, setTracks] = useState<LearningTrack[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<{ id: string | null; form: LearningTrackInput; problemIds: string[]; autoSlug: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    Promise.all([getManagedTracks(isAdmin ? undefined : userId), getAllProblems()]).then(([trackRows, problemRows]) => {
      if (!active) return;
      setTracks(trackRows.filter(t => isAdmin || t.created_by === userId));
      // Only problems the database lets this user attach: public or their own.
      setProblems(problemRows.filter(p => isAdmin || p.is_public || p.created_by === userId));
    }).catch(() => { if (active) setLoadError('Không tải được lộ trình.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, isAdmin, attempt]);

  const startEdit = (track: LearningTrack | null) => {
    setError(''); setNotice('');
    setEditing(track
      ? { id: track.id, form: { slug: track.slug, title: track.title, description: track.description, sort_order: track.sort_order, is_public: track.is_public }, problemIds: track.problems.map(p => p.id), autoSlug: false }
      : { id: null, form: EMPTY, problemIds: [], autoSlug: true });
  };
  const setForm = (patch: Partial<LearningTrackInput>) => setEditing(prev => prev && ({ ...prev, form: { ...prev.form, ...patch } }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setError('');
    try {
      await saveLearningTrack(editing.id, editing.form, editing.problemIds);
      setNotice(`Đã lưu lộ trình "${editing.form.title}".`);
      setEditing(null);
      setAttempt(v => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được lộ trình');
    } finally { setSaving(false); }
  };

  const remove = async (track: LearningTrack) => {
    setError(''); setNotice('');
    try {
      await deleteLearningTrack(track.id);
      setNotice(`Đã xóa lộ trình "${track.title}".`);
      setAttempt(v => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Không xóa được lộ trình'); }
  };

  if (editing) {
    const { form } = editing;
    return <form onSubmit={save} className="space-y-4" aria-label={editing.id ? 'Sửa lộ trình' : 'Tạo lộ trình'}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">{editing.id ? 'Sửa lộ trình' : 'Tạo lộ trình'}</h2>
        <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md border border-[var(--border)] text-xs">Hủy</button>
      </div>
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
        <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[var(--text-primary)]">
          <label>Tên lộ trình
            <input required maxLength={200} value={form.title} className={field}
              onChange={e => setEditing(prev => prev && ({ ...prev, form: { ...prev.form, title: e.target.value, slug: prev.autoSlug ? slugifyVietnamese(e.target.value) : prev.form.slug } }))} />
          </label>
          <label>Đường dẫn (slug)
            <input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} className={`${field} font-mono`}
              onChange={e => setEditing(prev => prev && ({ ...prev, autoSlug: false, form: { ...prev.form, slug: e.target.value } }))} />
          </label>
          <label className="md:col-span-2">Mô tả
            <textarea rows={3} maxLength={5000} value={form.description} onChange={e => setForm({ description: e.target.value })} className={field} />
          </label>
          <label>Thứ tự hiển thị
            <input type="number" min={0} max={1000} value={form.sort_order} onChange={e => setForm({ sort_order: Number(e.target.value) })} className={field} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input type="checkbox" checked={form.is_public} onChange={e => setForm({ is_public: e.target.checked })} className="accent-[var(--accent)]" />
            Công khai cho học sinh
          </label>
        </section>
        <section aria-label="Bài trong lộ trình" className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 space-y-3 text-[var(--text-primary)]">
          <div><h3 className="text-sm font-semibold">Bài trong lộ trình</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">Sắp xếp từ dễ đến khó; học sinh sẽ được gợi ý làm theo thứ tự này. Chỉ thêm được đề công khai hoặc đề do bạn tạo.</p></div>
          <OrderedProblemPicker problems={problems} selected={editing.problemIds} emptyText="Chưa chọn bài."
            onChange={next => setEditing(prev => prev && ({ ...prev, problemIds: next }))} />
        </section>
        {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
        <button className="px-3 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu lộ trình'}</button>
      </fieldset>
    </form>;
  }

  return <div className="space-y-4 text-[var(--text-primary)]">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Lộ trình luyện tập</h2><p className="text-xs text-[var(--text-secondary)]">Gom bài theo chủ đề (ví dụ Nhập môn lập trình, Sắp xếp) để học sinh ôn theo thứ tự.</p></div>
      <button type="button" onClick={() => startEdit(null)} className="px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium">Tạo lộ trình</button>
    </div>
    {notice && <p role="status" className="text-xs text-[var(--accent-text)]">{notice}</p>}
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
    {loading ? <p role="status" className="text-xs">Đang tải lộ trình...</p>
      : loadError ? <div role="alert" className="text-xs text-[var(--danger)]">{loadError} <button type="button" className="underline" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>
      : !tracks.length ? <p className="text-xs text-[var(--text-secondary)]">Chưa có lộ trình nào.</p>
      : <ul className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)]">
        {tracks.map(track => <li key={track.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{track.title}</span>
              <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-mono ${track.is_public ? 'bg-accent/10 text-[var(--accent-text)] border-accent/30' : 'bg-tertiary text-[var(--text-muted)] border-[var(--border)]'}`}>{track.is_public ? 'công khai' : 'nháp'}</span>
            </div>
            <span className="text-[var(--text-muted)] font-mono">/learn/{track.slug} · {track.problems.length} bài</span>
          </div>
          <button type="button" onClick={() => startEdit(track)} className="px-2.5 py-1 rounded-md border border-[var(--border)]">Sửa</button>
          <button type="button" onClick={() => void remove(track)} className="px-2.5 py-1 rounded-md border border-danger/30 text-danger">Xóa</button>
        </li>)}
      </ul>}
  </div>;
}
