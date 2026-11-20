import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  Plus as PlusData,
  Edit as EditData,
  Trash2 as Trash2Data,
  ArrowLeft as ArrowLeftData,
  Search as SearchData,
} from 'lucide';
import OrderedProblemPicker from '../../../components/OrderedProblemPicker';
import { slugifyVietnamese } from '../../../lib/slug';
import {
  deleteLearningTrack, getAllProblems, getManagedTracks, saveLearningTrack,
  type LearningTrack, type LearningTrackInput, type Problem,
} from '../../../lib/api';

const EMPTY: LearningTrackInput = { slug: '', title: '', description: '', sort_order: 0, is_public: false };
const field = 'block w-full mt-1 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors';

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
  const [search, setSearch] = useState('');

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
    if (!window.confirm(`Xác nhận xóa lộ trình "${track.title}"?`)) return;
    setError(''); setNotice('');
    try {
      await deleteLearningTrack(track.id);
      setNotice(`Đã xóa lộ trình "${track.title}".`);
      setAttempt(v => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Không xóa được lộ trình'); }
  };

  if (editing) {
    const { form } = editing;
    return (
      <form onSubmit={save} className="space-y-4" aria-label={editing.id ? 'Sửa lộ trình' : 'Tạo lộ trình'}>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editing.id ? 'Chỉnh sửa lộ trình' : 'Tạo lộ trình mới'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Cấu hình đường dẫn, độ khó và danh sách bài tập theo thứ tự luyện tập.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <MorphIcon icon={ArrowLeftData} size={13} /> Quay lại danh sách
          </button>
        </div>
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[var(--text-primary)] shadow-xs">
            <label className="font-semibold text-[var(--text-secondary)]">Tên lộ trình *
              <input required maxLength={200} value={form.title} className={field}
                onChange={e => setEditing(prev => prev && ({ ...prev, form: { ...prev.form, title: e.target.value, slug: prev.autoSlug ? slugifyVietnamese(e.target.value) : prev.form.slug } }))} />
            </label>
            <label className="font-semibold text-[var(--text-secondary)]">Đường dẫn (slug) *
              <input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} className={`${field} font-mono`}
                onChange={e => setEditing(prev => prev && ({ ...prev, autoSlug: false, form: { ...prev.form, slug: e.target.value } }))} />
            </label>
            <label className="md:col-span-2 font-semibold text-[var(--text-secondary)]">Mô tả
              <textarea rows={3} maxLength={5000} value={form.description} onChange={e => setForm({ description: e.target.value })} className={field} />
            </label>
            <label className="font-semibold text-[var(--text-secondary)]">Thứ tự hiển thị
              <input type="number" min={0} max={1000} value={form.sort_order} onChange={e => setForm({ sort_order: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 font-semibold text-[var(--text-secondary)] cursor-pointer">
              <input type="checkbox" checked={form.is_public} onChange={e => setForm({ is_public: e.target.checked })} className="accent-[var(--accent)]" />
              Công khai cho học sinh
            </label>
          </section>
          <section aria-label="Bài trong lộ trình" className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 space-y-3 text-[var(--text-primary)] shadow-xs">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Bài tập trong lộ trình</h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                Sắp xếp từ dễ đến khó; học sinh sẽ được gợi ý giải theo thứ tự này.
              </p>
            </div>
            <OrderedProblemPicker problems={problems} selected={editing.problemIds} emptyText="Chưa chọn bài."
              onChange={next => setEditing(prev => prev && ({ ...prev, problemIds: next }))} />
          </section>
          {error && <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">{error}</div>}
          <div className="pt-2">
            <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs disabled:opacity-50 transition-colors cursor-pointer">
              {saving ? 'Đang lưu...' : 'Lưu lộ trình'}
            </button>
          </div>
        </fieldset>
      </form>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredTracks = tracks.filter(t => !query || t.title.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query));

  return (
    <div className="space-y-4 text-[var(--text-primary)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Lộ Trình Luyện Tập</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Gom bài theo chủ đề (ví dụ: Nhập môn, Sắp xếp) để học sinh ôn luyện tuần tự.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startEdit(null)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer w-fit"
        >
          <MorphIcon icon={PlusData} size={14} /> Tạo Lộ Trình
        </button>
      </div>

      {notice && (
        <div role="status" className="p-2.5 rounded-md bg-accent/10 border border-accent/25 text-xs text-[var(--accent-text)] font-medium">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
          {error}
        </div>
      )}

      {tracks.length > 0 && (
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <MorphIcon icon={SearchData} size={13} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc slug lộ trình..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
          {loadError} <button type="button" className="underline ml-1 cursor-pointer" onClick={() => setAttempt(v => v + 1)}>Thử lại</button>
        </div>
      ) : !tracks.length ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
          Chưa có lộ trình nào được tạo.
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
          Không tìm thấy lộ trình phù hợp với tìm kiếm.
        </div>
      ) : (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] divide-y divide-[var(--border)] shadow-xs overflow-hidden">
          {filteredTracks.map(track => (
            <div key={track.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs hover:bg-[var(--bg-primary)] transition-colors">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[var(--text-primary)] truncate">{track.title}</span>
                  <span className={`px-1.5 py-0.2 rounded-full border text-[10px] font-mono ${track.is_public ? 'bg-accent/10 text-[var(--accent-text)] border-accent/25' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]'}`}>
                    {track.is_public ? 'công khai' : 'nháp'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  <span>/learn/{track.slug}</span>
                  <span> · </span>
                  <span>{track.problems.length} bài tập</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(track)}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
                  title="Chỉnh sửa lộ trình"
                >
                  <MorphIcon icon={EditData} size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(track)}
                  className="p-1.5 rounded-md text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                  title="Xóa lộ trình"
                >
                  <MorphIcon icon={Trash2Data} size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
