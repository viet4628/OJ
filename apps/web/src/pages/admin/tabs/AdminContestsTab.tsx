import { useEffect, useState } from 'react';
import {
  Trophy,
  ListTree,
  Edit,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import {
  getContests,
  createContest,
  updateContest,
  deleteContest,
  getAllProblems,
  getContestProblemsAdmin,
  setContestProblems,
  type Contest,
  type Problem,
} from '../../../lib/api';

const inputCls =
  'w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
const labelCls = 'text-xs font-semibold text-[var(--text-secondary)]';

export default function AdminContestsTab() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    rule_type: 'ACM' as 'ACM' | 'OI',
    start_time: '',
    end_time: '',
    is_public: true,
  });
  const [contestEditingId, setContestEditingId] = useState<string | null>(null);
  const [contestSaving, setContestSaving] = useState(false);
  const [contestNotice, setContestNotice] = useState<string | null>(null);
  const [contestError, setContestError] = useState<string | null>(null);

  /* contest problems modal */
  const [cpContest, setCpContest] = useState<Contest | null>(null);
  const [cpProblems, setCpProblems] = useState<Problem[]>([]);
  const [cpSelected, setCpSelected] = useState<string[]>([]);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);

  const fetchContests = () => {
    getContests().then(setContests);
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const saveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setContestSaving(true);
    setContestError(null);
    const payload = {
      title: contestForm.title,
      description: contestForm.description,
      rule_type: contestForm.rule_type,
      start_time: new Date(contestForm.start_time).toISOString(),
      end_time: new Date(contestForm.end_time).toISOString(),
      is_public: contestForm.is_public,
    };
    const res = contestEditingId
      ? await updateContest(contestEditingId, payload)
      : await createContest(payload);
    setContestSaving(false);
    if (!res.ok) {
      setContestError(res.error || 'Lưu thất bại');
      return;
    }
    setContestEditingId(null);
    setContestForm({ title: '', description: '', rule_type: 'ACM', start_time: '', end_time: '', is_public: true });
    setContestNotice(contestEditingId ? 'Đã cập nhật kỳ thi' : 'Đã tạo kỳ thi');
    fetchContests();
  };

  const startEditContest = (c: Contest) => {
    setContestEditingId(c.id);
    setContestError(null);
    setContestForm({
      title: c.title,
      description: c.description,
      rule_type: c.rule_type,
      start_time: new Date(c.start_time).toISOString().slice(0, 16),
      end_time: new Date(c.end_time).toISOString().slice(0, 16),
      is_public: c.is_public,
    });
  };

  const handleDeleteContest = async (id: string, title: string) => {
    if (!window.confirm(`Xóa kỳ thi "${title}"?`)) return;
    const res = await deleteContest(id);
    if (!res.ok) {
      alert(res.error || 'Xóa thất bại');
      setContestNotice(res.error || 'Xóa thất bại');
      return;
    }
    setContestNotice(`Đã xóa kỳ thi "${title}"`);
    setContests((prev) => prev.filter((c) => c.id !== id));
  };

  /* contest problems: pick which problems belong to a contest */
  const openCpModal = async (c: Contest) => {
    setCpContest(c);
    setCpError(null);
    setCpLoading(true);
    setCpSelected([]);
    try {
      const [all, current] = await Promise.all([getAllProblems(), getContestProblemsAdmin(c.id)]);
      setCpProblems(all);
      setCpSelected(current.map((r) => r.problem_id));
    } catch (err: any) {
      setCpError(err.message || 'Không tải được danh sách bài');
    } finally {
      setCpLoading(false);
    }
  };

  const toggleCp = (id: string) => {
    setCpSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveCp = async () => {
    if (!cpContest) return;
    setCpSaving(true);
    setCpError(null);
    const res = await setContestProblems(cpContest.id, cpSelected);
    setCpSaving(false);
    if (!res.ok) {
      setCpError(res.error || 'Lưu thất bại');
      return;
    }
    setContestNotice(`Đã cập nhật ${cpSelected.length} bài cho kỳ thi "${cpContest.title}"`);
    setCpContest(null);
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" /> Quản Lý Kỳ Thi
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{contests.length} kỳ thi</p>
        </div>
        {contestNotice && <span className="text-[11px] text-[var(--accent-text)] font-bold">{contestNotice}</span>}
      </div>

      <form onSubmit={saveContest} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
        <div className="space-y-1">
          <label className={labelCls}>Tên Kỳ Thi *</label>
          <input
            type="text"
            required
            value={contestForm.title}
            onChange={(e) => setContestForm({ ...contestForm, title: e.target.value })}
            placeholder="Weekly Sprint #1"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Thể Thức</label>
          <select
            value={contestForm.rule_type}
            onChange={(e) => setContestForm({ ...contestForm, rule_type: e.target.value as any })}
            className={inputCls}
          >
            <option value="ACM">ACM</option>
            <option value="OI">OI</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Mô Tả</label>
          <input
            type="text"
            value={contestForm.description}
            onChange={(e) => setContestForm({ ...contestForm, description: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Bắt Đầu *</label>
          <input
            type="datetime-local"
            required
            value={contestForm.start_time}
            onChange={(e) => setContestForm({ ...contestForm, start_time: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Kết Thúc *</label>
          <input
            type="datetime-local"
            required
            value={contestForm.end_time}
            onChange={(e) => setContestForm({ ...contestForm, end_time: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={contestForm.is_public}
              onChange={(e) => setContestForm({ ...contestForm, is_public: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Công khai
          </label>
          <button
            type="submit"
            disabled={contestSaving}
            className="ml-auto px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {contestSaving ? 'Đang Lưu...' : contestEditingId ? 'Cập Nhật' : 'Thêm Kỳ Thi'}
          </button>
          {contestEditingId && (
            <button
              type="button"
              onClick={() => {
                setContestEditingId(null);
                setContestForm({ title: '', description: '', rule_type: 'ACM', start_time: '', end_time: '', is_public: true });
              }}
              className="text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Hủy sửa
            </button>
          )}
        </div>
        {contestError && <div className="col-span-full p-2 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold">{contestError}</div>}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-secondary)] uppercase text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px]">
            <tr>
              <th className="px-4 py-3">Tên Contest</th>
              <th className="px-4 py-3">Thể Thức</th>
              <th className="px-4 py-3">Thời Gian</th>
              <th className="px-4 py-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {contests.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{c.title}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] text-[10px] font-bold border border-[var(--accent)]/20">
                    {c.rule_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-code text-[var(--text-secondary)]">
                  {new Date(c.start_time).toLocaleString('vi-VN')} — {new Date(c.end_time).toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-3 text-right space-x-1.5">
                  <button
                    onClick={() => openCpModal(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] font-bold transition-colors cursor-pointer"
                    title="Chọn bài tập cho kỳ thi"
                  >
                    <ListTree className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Bài Thi
                  </button>
                  <button
                    onClick={() => startEditContest(c)}
                    className="p-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteContest(c.id, c.title)}
                    className="p-1.5 rounded-lg bg-red-50 text-[var(--danger)] hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* contest problems modal */}
      {cpContest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setCpContest(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-[var(--accent-text)]" /> Bài Thi: {cpContest.title}
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Tích chọn các bài tập thuộc kỳ thi (thứ tự theo danh sách bên dưới).</p>
              </div>
              <button
                onClick={() => setCpContest(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cpError && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold">{cpError}</div>}

            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)]">
              <span>Đã chọn {cpSelected.length} bài</span>
              <button
                onClick={() => setCpSelected(cpProblems.map((p) => p.id))}
                className="text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                Chọn tất cả
              </button>
            </div>

            {cpLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                {cpProblems.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-4">Chưa có bài tập nào.</p>}
                {cpProblems.map((p) => {
                  const checked = cpSelected.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                        checked
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30'
                          : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCp(p.id)}
                        className="accent-[var(--accent)] shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[var(--text-primary)] block truncate">{p.title}</span>
                        <span className="font-code text-[10px] text-[var(--text-muted)]">
                          /{p.slug} · {p.difficulty}
                        </span>
                      </span>
                      {checked && (
                        <span className="text-[10px] font-black text-[var(--accent-text)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-0.5 rounded font-code">
                          #{cpSelected.indexOf(p.id) + 1}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setCpContest(null)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-xs hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={saveCp}
                disabled={cpSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {cpSaving ? 'Đang Lưu...' : 'Lưu Bài Thi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

