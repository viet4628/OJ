import { useEffect, useState } from 'react';
import {
  Sparkles,
  Edit,
  Download,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  getAllProblems,
  createProblem,
  updateProblem,
  deleteProblem,
  addTestcase,
  deleteTestcase,
  type Problem,
} from '../../../lib/api';
import { createZip, downloadBlob } from '../../../lib/zip';

export interface ProblemForm {
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  input_format: string;
  output_format: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  tags: string;
  is_public: boolean;
}

const EMPTY_FORM: ProblemForm = {
  title: '',
  slug: '',
  difficulty: 'Easy',
  description: '',
  input_format: '',
  output_format: '',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  tags: '',
  is_public: true,
};

interface AdminProblemsTabProps {
  mode: 'list' | 'create';
  onModeChange: (m: 'list' | 'create') => void;
}

const inputCls =
  'w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
const labelCls = 'text-xs font-semibold text-[var(--text-secondary)]';

export default function AdminProblemsTab({ mode, onModeChange }: AdminProblemsTabProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /* form */
  const [problemForm, setProblemForm] = useState<ProblemForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* testcases modal */
  const [tcProblem, setTcProblem] = useState<Problem | null>(null);
  const [tcList, setTcList] = useState<any[]>([]);
  const [tcLoading, setTcLoading] = useState(false);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');
  const [tcScore, setTcScore] = useState(10);
  const [tcSample, setTcSample] = useState(false);
  const [tcNotice, setTcNotice] = useState<string | null>(null);

  const fetchProblems = () => {
    setLoading(true);
    getAllProblems()
      .then(setProblems)
      .catch((err: any) => setNotice(`Lỗi tải: ${err.message}`))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const startEdit = (p: Problem) => {
    setProblemForm({
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      description: p.description,
      input_format: p.input_format || '',
      output_format: p.output_format || '',
      time_limit_ms: p.time_limit_ms,
      memory_limit_mb: p.memory_limit_mb,
      tags: (p.tags || []).join(', '),
      is_public: p.is_public,
    });
    setEditingId(p.id);
    setSaveError(null);
    onModeChange('create');
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    const payload = {
      title: problemForm.title,
      slug: problemForm.slug || problemForm.title.toLowerCase().replace(/\s+/g, '-'),
      difficulty: problemForm.difficulty,
      description: problemForm.description,
      input_format: problemForm.input_format,
      output_format: problemForm.output_format,
      time_limit_ms: problemForm.time_limit_ms,
      memory_limit_mb: problemForm.memory_limit_mb,
      tags: problemForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      samples: [],
      is_public: problemForm.is_public,
    };
    const res = editingId
      ? await updateProblem(editingId, payload)
      : await createProblem(payload);
    setIsSaving(false);
    if (!res.ok) {
      setSaveError(res.error || 'Lưu thất bại');
      return;
    }
    setNotice(editingId ? 'Đã cập nhật bài tập' : 'Đã tạo bài tập thành công');
    setEditingId(null);
    setProblemForm(EMPTY_FORM);
    onModeChange('list');
    fetchProblems();
  };

  const handleDeleteProblem = async (id: string, title: string) => {
    if (!window.confirm(`Xóa bài "${title}"? (kèm toàn bộ testcases)`)) return;
    const res = await deleteProblem(id);
    if (!res.ok) {
      alert(res.error || 'Xóa thất bại');
      setNotice(res.error || 'Xóa thất bại');
      return;
    }
    setNotice(`Đã xóa "${title}"`);
    setProblems((prev) => prev.filter((p) => p.id !== id));
  };

  /* testcases modal */
  const openTcModal = async (p: Problem) => {
    setTcProblem(p);
    setTcNotice(null);
    setTcLoading(true);
    setTcList([]);
    try {
      const rows = await supabase.from('testcases').select('*').eq('problem_id', p.id).order('created_at');
      setTcList((rows.data as any[]) || []);
    } finally {
      setTcLoading(false);
    }
  };

  const handleAddTc = async () => {
    if (!tcProblem || !tcInput.trim() || !tcOutput.trim()) return;
    setTcNotice(null);
    const res = await addTestcase({
      problem_id: tcProblem.id,
      input_content: tcInput,
      output_content: tcOutput,
      score: tcScore,
      is_sample: tcSample,
    });
    if (!res.ok) {
      setTcNotice(res.error || 'Thêm thất bại');
      return;
    }
    setTcInput('');
    setTcOutput('');
    setTcScore(10);
    setTcSample(false);
    const rows = await supabase.from('testcases').select('*').eq('problem_id', tcProblem.id).order('created_at');
    setTcList((rows.data as any[]) || []);
  };

  const handleDeleteTc = async (id: string) => {
    if (!tcProblem) return;
    const res = await deleteTestcase(id);
    if (res.ok) setTcList((prev) => prev.filter((t) => t.id !== id));
    else setTcNotice(res.error || 'Xóa testcase thất bại');
  };

  if (mode === 'create') {
    return (
      <form onSubmit={handleSaveProblem} className="bg-white p-5 rounded-xl border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" /> {editingId ? `Sửa Bài: ${editingId}` : 'Thêm Bài Tập Mới'}
          </h2>
          {saveError && <span className="text-xs text-[var(--danger)] font-bold">{saveError}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Tên Bài Tập *</label>
            <input
              type="text"
              required
              value={problemForm.title}
              onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
              placeholder="1001. Two Sum"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>URL Slug</label>
            <input
              type="text"
              value={problemForm.slug}
              onChange={(e) => setProblemForm({ ...problemForm, slug: e.target.value })}
              placeholder="two-sum"
              className={`${inputCls} font-code`}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Mức Độ</label>
            <select
              value={problemForm.difficulty}
              onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value as any })}
              className={inputCls}
            >
              <option value="Easy">Dễ</option>
              <option value="Medium">Trung bình</option>
              <option value="Hard">Khó</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Tags (phân cách bằng dấu phẩy)</label>
            <input
              type="text"
              value={problemForm.tags}
              onChange={(e) => setProblemForm({ ...problemForm, tags: e.target.value })}
              placeholder="two-pointer, mảng"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Giới hạn thời gian (ms)</label>
            <input
              type="number"
              min={100}
              value={problemForm.time_limit_ms}
              onChange={(e) => setProblemForm({ ...problemForm, time_limit_ms: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Giới hạn bộ nhớ (MB)</label>
            <input
              type="number"
              min={16}
              value={problemForm.memory_limit_mb}
              onChange={(e) => setProblemForm({ ...problemForm, memory_limit_mb: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelCls}>Mô Tả (Markdown) *</label>
          <textarea
            rows={5}
            required
            value={problemForm.description}
            onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
            className={`${inputCls} font-code resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Dữ Liệu Vào (Input Format)</label>
            <textarea
              rows={3}
              value={problemForm.input_format}
              onChange={(e) => setProblemForm({ ...problemForm, input_format: e.target.value })}
              className={`${inputCls} font-code resize-y`}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Dữ Liệu Ra (Output Format)</label>
            <textarea
              rows={3}
              value={problemForm.output_format}
              onChange={(e) => setProblemForm({ ...problemForm, output_format: e.target.value })}
              className={`${inputCls} font-code resize-y`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={problemForm.is_public}
            onChange={(e) => setProblemForm({ ...problemForm, is_public: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          Công khai cho mọi người
        </label>

        {editingId && (
          <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
            Testcases của bài này được quản lý trong tab Problem List (nút "Quản lý Testcase").
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setProblemForm(EMPTY_FORM);
              onModeChange('list');
            }}
            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold text-xs hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Đang Lưu...' : editingId ? 'Cập Nhật Bài Tập' : 'Lưu Bài Tập'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Cơ Sở Dữ Liệu Bài Tập</h3>
        <div className="flex items-center gap-2">
          {notice && <span className="text-[11px] text-[var(--accent-text)] font-bold">{notice}</span>}
          <span className="text-xs text-[var(--text-muted)] font-code">{problems.length} bài</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-secondary)] uppercase text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Tên Bài / Slug</th>
                <th className="px-4 py-3">Mức Độ</th>
                <th className="px-4 py-3">Thời Gian / RAM</th>
                <th className="px-4 py-3">Testcase</th>
                <th className="px-4 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {problems.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-[var(--text-primary)]">{p.title}</div>
                    <div className="font-code text-[11px] text-[var(--text-muted)]">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        p.difficulty === 'Easy'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {p.difficulty === 'Easy' ? 'Dễ' : p.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-code text-[var(--text-secondary)]">
                    {p.time_limit_ms}ms / {p.memory_limit_mb}MB
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openTcModal(p)}
                      className="font-code font-bold text-sky-700 hover:underline cursor-pointer"
                    >
                      Quản lý Testcase
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1.5">
                    <button
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProblem(p.id, p.title)}
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
      )}

      {/* testcases modal */}
      {tcProblem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setTcProblem(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)]">Testcase: {tcProblem.title}</h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Thêm hoặc xóa bộ dữ liệu chấm.</p>
              </div>
              <button
                onClick={() => setTcProblem(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tcNotice && <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold">{tcNotice}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <textarea
                rows={3}
                value={tcInput}
                onChange={(e) => setTcInput(e.target.value)}
                placeholder="Input (vd: 2 7&#10;11 15)"
                className={`${inputCls} font-code`}
              />
              <textarea
                rows={3}
                value={tcOutput}
                onChange={(e) => setTcOutput(e.target.value)}
                placeholder="Output mong đợi (vd: 0 1)"
                className={`${inputCls} font-code`}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                Điểm:
                <input
                  type="number"
                  value={tcScore}
                  onChange={(e) => setTcScore(Number(e.target.value))}
                  className={`${inputCls} !w-20`}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={tcSample}
                  onChange={(e) => setTcSample(e.target.checked)}
                  className="accent-[var(--accent)]"
                />{' '}
                Test mẫu
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!tcProblem || tcList.length === 0) return;
                  const entries = tcList.flatMap((tc, idx) => {
                    const n = String(idx).padStart(2, '0');
                    return [
                      { name: `input${n}.txt`, data: tc.input_content || '' },
                      { name: `output${n}.txt`, data: tc.output_content || '' },
                    ];
                  });
                  downloadBlob(createZip(entries), `${tcProblem.slug || 'problem'}-testcases.zip`, 'application/zip');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Tải ZIP (HackerRank)
              </button>
              <button
                onClick={handleAddTc}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Testcase
              </button>
            </div>

            <div className="space-y-2">
              {tcLoading ? (
                <div className="h-10 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
              ) : (
                tcList.map((tc, idx) => (
                  <div
                    key={tc.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                        Testcase #{idx + 1}
                        {tc.is_sample && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-200">
                            Mẫu
                          </span>
                        )}
                        <span className="text-[var(--text-muted)] font-code">· {tc.score} điểm</span>
                      </div>
                      <p className="font-code text-[11px] text-[var(--text-secondary)] truncate">
                        in: {tc.input_content ? tc.input_content.replace(/\n/g, '⏎').slice(0, 60) : '—'} · out:{' '}
                        {tc.output_content ? tc.output_content.replace(/\n/g, '⏎').slice(0, 60) : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTc(tc.id)}
                      className="p-1.5 rounded-lg bg-red-50 text-[var(--danger)] hover:bg-red-100 border border-red-200 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
              {!tcLoading && tcList.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-3">Chưa có testcase.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

