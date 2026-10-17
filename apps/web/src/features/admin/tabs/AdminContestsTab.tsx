import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  Trophy as TrophyData,
  ListTree as ListTreeData,
  Edit as EditData,
  Trash2 as Trash2Data,
  Save as SaveData,
  X as XData,
} from 'lucide';
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
  'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors';
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
  const [contestSaving, setContestSaving] = useState(false);
  const [contestNotice, setContestNotice] = useState<string | null>(null);
  const [contestError, setContestError] = useState<string | null>(null);
  const [contestEditingId, setContestEditingId] = useState<string | null>(null);

  // Contest problems sub-modal state
  const [cpContest, setCpContest] = useState<Contest | null>(null);
  const [cpProblems, setCpProblems] = useState<Problem[]>([]);
  const [cpSelected, setCpSelected] = useState<string[]>([]);
  const [cpScores, setCpScores] = useState<Record<string, number>>({});
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);
  const [cpError, setCpError] = useState<string | null>(null);

  const fetchContests = () => {
    let cancelled = false;
    getContests().then((l) => {
      if (!cancelled) setContests(l);
    });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return fetchContests();
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

    let res;
    if (contestEditingId) {
      res = await updateContest(contestEditingId, payload);
    } else {
      res = await createContest(payload);
    }
    setContestSaving(false);

    if (!res.ok) {
      setContestError(res.error || 'Lỗi khi lưu kỳ thi');
      return;
    }
    setContestNotice(contestEditingId ? 'Đã cập nhật kỳ thi' : 'Đã tạo kỳ thi mới');
    setContestEditingId(null);
    setContestForm({ title: '', description: '', rule_type: 'ACM', start_time: '', end_time: '', is_public: true });
    fetchContests();
    setTimeout(() => setContestNotice(null), 3000);
  };

  const startEditContest = (c: Contest) => {
    setContestEditingId(c.id);
    const toLocalISO = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setContestForm({
      title: c.title,
      description: c.description || '',
      rule_type: c.rule_type,
      start_time: toLocalISO(c.start_time),
      end_time: toLocalISO(c.end_time),
      is_public: c.is_public,
    });
  };

  const handleDeleteContest = async (id: string, title: string) => {
    if (!window.confirm(`Xác nhận xóa kỳ thi "${title}"? Mọi bài nộp trong kỳ thi này sẽ bị xóa.`)) return;
    const res = await deleteContest(id);
    if (res.ok) setContests((prev) => prev.filter((c) => c.id !== id));
  };

  const openCpModal = async (c: Contest) => {
    setCpContest(c);
    setCpLoading(true);
    setCpError(null);
    try {
      const [allP, assigned] = await Promise.all([
        getAllProblems(),
        getContestProblemsAdmin(c.id),
      ]);
      setCpProblems(allP);
      setCpSelected(assigned.map((a) => a.problem_id));
      const scoreMap: Record<string, number> = {};
      assigned.forEach((a) => {
        scoreMap[a.problem_id] = a.score ?? 100;
      });
      setCpScores(scoreMap);
    } catch {
      setCpError('Không thể tải danh sách bài tập của kỳ thi');
    } finally {
      setCpLoading(false);
    }
  };

  const toggleCp = (probId: string) => {
    setCpSelected((prev) =>
      prev.includes(probId) ? prev.filter((id) => id !== probId) : [...prev, probId]
    );
  };

  const saveCp = async () => {
    if (!cpContest) return;
    setCpSaving(true);
    setCpError(null);
    const problems = cpSelected.map((pid, idx) => ({
      problem_id: pid,
      display_order: idx + 1,
      score: cpScores[pid] ?? 100,
    }));
    const res = await setContestProblems(cpContest.id, problems);
    setCpSaving(false);
    if (!res.ok) {
      setCpError(res.error || 'Lỗi khi lưu bài thi');
      return;
    }
    setContestNotice(`Đã cập nhật ${cpSelected.length} bài cho kỳ thi "${cpContest.title}"`);
    setCpContest(null);
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <MorphIcon icon={TrophyData} size={14} className="text-[var(--accent-text)]" /> Quản Lý Kỳ Thi
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{contests.length} kỳ thi trong hệ thống</p>
        </div>
        {contestNotice && <span className="text-[11px] text-[var(--accent-text)] font-mono">{contestNotice}</span>}
      </div>

      <form onSubmit={saveContest} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)]">
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
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer pb-2">
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
            className="ml-auto px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
              className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Hủy
            </button>
          )}
        </div>
        {contestError && <div className="col-span-full p-2 rounded-md bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-[11px] font-medium">{contestError}</div>}
      </form>

      <div className="overflow-x-auto border border-[var(--border)] rounded-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
            <tr>
              <th className="px-3 py-2">Tên Kỳ Thi</th>
              <th className="px-3 py-2">Thể Thức</th>
              <th className="px-3 py-2">Thời Gian</th>
              <th className="px-3 py-2 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {contests.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{c.title}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.2 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] text-[10px] font-mono border border-[var(--accent)]/30">
                    {c.rule_type}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  {new Date(c.start_time).toLocaleString('vi-VN')} — {new Date(c.end_time).toLocaleString('vi-VN')}
                </td>
                <td className="px-3 py-2 text-right space-x-1">
                  <button
                    onClick={() => openCpModal(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] font-medium transition-colors cursor-pointer"
                    title="Chọn bài tập cho kỳ thi"
                  >
                    <MorphIcon icon={ListTreeData} size={12} className="text-[var(--accent-text)]" /> Bài Thi
                  </button>
                  <button
                    onClick={() => startEditContest(c)}
                    className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    title="Chỉnh sửa kỳ thi"
                  >
                    <MorphIcon icon={EditData} size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteContest(c.id, c.title)}
                    className="p-1 rounded-md text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Xóa kỳ thi"
                  >
                    <MorphIcon icon={Trash2Data} size={13} />
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setCpContest(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] shadow-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <MorphIcon icon={ListTreeData} size={14} className="text-[var(--accent-text)]" /> Bài Thi: {cpContest.title}
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Tích chọn các bài tập thuộc kỳ thi.</p>
              </div>
              <button
                onClick={() => setCpContest(null)}
                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <MorphIcon icon={XData} size={16} />
              </button>
            </div>

            {cpError && <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-[11px] font-medium">{cpError}</div>}

            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-secondary)]">
              <span>Đã chọn {cpSelected.length} bài</span>
              <button
                onClick={() => setCpSelected(cpProblems.map((p) => p.id))}
                className="text-[var(--accent-text)] hover:underline cursor-pointer"
              >
                Chọn tất cả
              </button>
            </div>

            {cpLoading ? (
              <div className="space-y-1.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-9 rounded-md bg-[var(--bg-primary)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
                {cpProblems.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-4">Chưa có bài tập nào.</p>}
                {cpProblems.map((p) => {
                  const checked = cpSelected.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 p-2 rounded-md border transition-colors cursor-pointer ${
                        checked
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30'
                          : 'bg-[var(--bg-primary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCp(p.id)}
                        className="accent-[var(--accent)] shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[var(--text-primary)] block truncate">{p.title}</span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          /{p.slug} · {p.difficulty}
                        </span>
                      </span>
                      {checked && (
                        <span className="text-[10px] font-mono text-[var(--accent-text)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-1.5 py-0.2 rounded">
                          #{cpSelected.indexOf(p.id) + 1}
                        </span>
                      )}
                      {checked && (
                        <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
                          Điểm:
                          <input
                            type="number"
                            value={cpScores[p.id] ?? 100}
                            onChange={(e) => setCpScores((prev) => ({ ...prev, [p.id]: Number(e.target.value) || 100 }))}
                            className="w-14 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] px-1 py-0.2 text-[10px]"
                          />
                        </label>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--border)]">
              <button
                onClick={() => setCpContest(null)}
                className="px-3 py-1.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium text-xs hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={saveCp}
                disabled={cpSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <MorphIcon icon={SaveData} size={14} /> {cpSaving ? 'Đang Lưu...' : 'Lưu Bài Thi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
