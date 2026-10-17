import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../../components/MorphIcon';
import {
  Edit as EditData,
  Download as DownloadData,
  Trash2 as Trash2Data,
  Plus as PlusData,
  X as XData,
  Upload as UploadData,
  Eye as EyeData,
  Search as SearchData,
  ArrowLeft as ArrowLeftData,
  ExternalLink as ExternalLinkData,
  Check as CheckData,
  AlertCircle as AlertCircleData,
  RefreshCw as RefreshCwData,
} from 'lucide';
import { supabase } from '../../../lib/supabase';
import {
  getAllProblems,
  createProblem,
  updateProblem,
  deleteProblem,
  addTestcasesBatch,
  deleteTestcase,
  type Problem,
} from '../../../lib/api';
import { createZip, downloadBlob, parseZip, pairTestcases } from '../../../lib/zip';
import Markdown from '../../../components/Markdown';

export interface ProblemForm {
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  input_format: string;
  output_format: string;
  constraints: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  tags: string[];
  is_public: boolean;
  samples: Array<{ input: string; output: string; explanation?: string }>;
}

export interface StagedTestcase {
  id?: string;
  input_content: string;
  output_content: string;
  score: number;
  is_sample: boolean;
  is_new?: boolean;
}

const EMPTY_FORM: ProblemForm = {
  title: '',
  slug: '',
  difficulty: 'Easy',
  description: '',
  input_format: '',
  output_format: '',
  constraints: '',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  tags: ['mảng', 'cơ bản'],
  is_public: true,
  samples: [
    {
      input: '5\n1 2 3 4 5',
      output: '15',
      explanation: 'Tổng của 5 phần tử: 1 + 2 + 3 + 4 + 5 = 15',
    },
  ],
};

const POPULAR_TAGS = [
  'mảng',
  'chuỗi',
  'toán học',
  'quy hoạch động',
  'tham lam',
  'đồ thị',
  'tìm kiếm nhị phân',
  'hai con trỏ',
  'ngăn xếp',
  'cây',
  'đệ quy',
  'sắp xếp',
];

interface AdminProblemsTabProps {
  mode: 'list' | 'create';
  onModeChange: (m: 'list' | 'create') => void;
}

function slugifyVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function AdminProblemsTab({ mode, onModeChange }: AdminProblemsTabProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter in list view
  const [searchKeyword, setSearchKeyword] = useState('');
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');
  const [testcaseCounts, setTestcaseCounts] = useState<Record<string, number>>({});

  // Studio state
  const [studioTab, setStudioTab] = useState<'statement' | 'samples' | 'testcases' | 'editorial'>('statement');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [problemForm, setProblemForm] = useState<ProblemForm>(EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(true);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Markdown write/preview view toggle (GitHub style)
  const [markdownView, setMarkdownView] = useState<'write' | 'preview' | 'split'>('split');

  // Staged testcases for the current problem
  const [stagedTestcases, setStagedTestcases] = useState<StagedTestcase[]>([]);
  const [deletedTcIds, setDeletedTcIds] = useState<string[]>([]);
  const [tcLoading, setTcLoading] = useState(false);

  // Manual testcase add form in Studio
  const [manualInput, setManualInput] = useState('');
  const [manualOutput, setManualOutput] = useState('');
  const [manualScore, setManualScore] = useState(10);
  const [manualIsSample, setManualIsSample] = useState(false);

  // ZIP import state
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [zipNotice, setZipNotice] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Student view preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const data = await getAllProblems();
      setProblems(data);
      const { data: tcRows } = await supabase.from('testcases').select('problem_id');
      if (tcRows) {
        const counts: Record<string, number> = {};
        for (const row of tcRows) {
          counts[row.problem_id] = (counts[row.problem_id] || 0) + 1;
        }
        setTestcaseCounts(counts);
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: `Lỗi tải danh sách: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const handleTitleChange = (val: string) => {
    setProblemForm((prev) => ({
      ...prev,
      title: val,
      slug: autoSlug ? slugifyVietnamese(val) : prev.slug,
    }));
  };

  const startCreateNew = () => {
    setEditingId(null);
    setProblemForm(EMPTY_FORM);
    setAutoSlug(true);
    setStagedTestcases([
      {
        input_content: '5\n1 2 3 4 5',
        output_content: '15',
        score: 10,
        is_sample: true,
        is_new: true,
      },
    ]);
    setDeletedTcIds([]);
    setStudioTab('statement');
    setSaveError(null);
    onModeChange('create');
  };

  const startEdit = async (p: Problem, targetTab: 'statement' | 'samples' | 'testcases' = 'statement') => {
    setEditingId(p.id);
    setAutoSlug(false);
    setSaveError(null);
    setStudioTab(targetTab);

    let desc = p.description || '';
    let constraints = '';
    const constraintMarker = '### Ràng buộc dữ liệu (Constraints)';
    if (desc.includes(constraintMarker)) {
      const parts = desc.split(constraintMarker);
      desc = parts[0].trim();
      constraints = parts[1].trim();
    }

    let rawSamples = p.samples || [];
    if (typeof rawSamples === 'string') {
      try {
        rawSamples = JSON.parse(rawSamples);
      } catch {
        rawSamples = [];
      }
    }

    setProblemForm({
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      description: desc,
      input_format: p.input_format || '',
      output_format: p.output_format || '',
      constraints: constraints,
      time_limit_ms: p.time_limit_ms,
      memory_limit_mb: p.memory_limit_mb,
      tags: p.tags || [],
      is_public: p.is_public,
      samples: Array.isArray(rawSamples) && rawSamples.length > 0
        ? rawSamples.map((s: any) => ({
            input: String(s?.input ?? ''),
            output: String(s?.output ?? ''),
            explanation: s?.explanation ? String(s.explanation) : undefined,
          }))
        : [{ input: '', output: '' }],
    });

    setTcLoading(true);
    setDeletedTcIds([]);
    try {
      const { data: rows } = await supabase
        .from('testcases')
        .select('*')
        .eq('problem_id', p.id)
        .order('is_sample', { ascending: false })
        .order('created_at', { ascending: true });

      setStagedTestcases(
        (rows || []).map((r: any) => ({
          id: r.id,
          input_content: r.input_content || '',
          output_content: r.output_content || '',
          score: r.score ?? 10,
          is_sample: Boolean(r.is_sample),
        }))
      );
    } finally {
      setTcLoading(false);
    }

    onModeChange('create');
  };

  const handleTagToggle = (tag: string) => {
    setProblemForm((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = customTagInput.trim().toLowerCase();
      if (trimmed && !problemForm.tags.includes(trimmed)) {
        setProblemForm((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }));
      }
      setCustomTagInput('');
    }
  };

  const handleAddSample = () => {
    setProblemForm((prev) => ({
      ...prev,
      samples: [...prev.samples, { input: '', output: '', explanation: '' }],
    }));
  };

  const handleRemoveSample = (idx: number) => {
    setProblemForm((prev) => ({
      ...prev,
      samples: prev.samples.filter((_, i) => i !== idx),
    }));
  };

  const handleSampleChange = (idx: number, field: 'input' | 'output' | 'explanation', val: string) => {
    setProblemForm((prev) => {
      const updated = [...prev.samples];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, samples: updated };
    });
  };

  const handleSyncSamplesToTestcases = () => {
    const validSamples = problemForm.samples.filter((s) => s.input.trim() || s.output.trim());
    if (validSamples.length === 0) {
      alert('Chưa có ví dụ mẫu nào có dữ liệu.');
      return;
    }
    const newCases: StagedTestcase[] = validSamples.map((s) => ({
      input_content: s.input.trim(),
      output_content: s.output.trim(),
      score: 10,
      is_sample: true,
      is_new: true,
    }));
    setStagedTestcases((prev) => [...prev, ...newCases]);
    setStudioTab('testcases');
    setZipNotice(`Đã đồng bộ ${newCases.length} ví dụ mẫu vào danh sách testcase.`);
  };

  const handleAddManualTestcase = () => {
    if (!manualInput.trim() || !manualOutput.trim()) {
      alert('Vui lòng nhập đầy đủ Đầu vào và Đầu ra.');
      return;
    }
    setStagedTestcases((prev) => [
      ...prev,
      {
        input_content: manualInput.trim(),
        output_content: manualOutput.trim(),
        score: manualScore,
        is_sample: manualIsSample,
        is_new: true,
      },
    ]);
    setManualInput('');
    setManualOutput('');
    setManualIsSample(false);
  };

  const handleZipFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingZip(true);
    setZipNotice(null);
    try {
      const buffer = await file.arrayBuffer();
      const extractedEntries = await parseZip(buffer);
      const pairs = pairTestcases(extractedEntries);
      if (pairs.length === 0) {
        setZipNotice('Không tìm thấy cặp testcase hợp lệ (cần inputXX.txt & outputXX.txt hoặc *.in & *.out).');
        return;
      }
      const importedCases: StagedTestcase[] = pairs.map((p, idx) => ({
        input_content: p.input.trim(),
        output_content: p.output.trim(),
        score: 10,
        is_sample: idx === 0,
        is_new: true,
      }));
      setStagedTestcases((prev) => [...prev, ...importedCases]);
      setZipNotice(`Đã nhập thành công ${importedCases.length} testcases từ "${file.name}".`);
    } catch (err: any) {
      setZipNotice(`Lỗi giải nén ZIP: ${err.message}`);
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleDistribute100Points = () => {
    if (stagedTestcases.length === 0) return;
    const count = stagedTestcases.length;
    const baseScore = Math.floor(100 / count);
    const remainder = 100 % count;
    setStagedTestcases((prev) =>
      prev.map((tc, idx) => ({
        ...tc,
        score: baseScore + (idx < remainder ? 1 : 0),
      }))
    );
  };

  const handleDownloadTestcasesZip = () => {
    if (stagedTestcases.length === 0) {
      alert('Chưa có testcase nào để tải.');
      return;
    }
    const entries = stagedTestcases.flatMap((tc, idx) => {
      const n = String(idx).padStart(2, '0');
      return [
        { name: `input${n}.txt`, data: tc.input_content || '' },
        { name: `output${n}.txt`, data: tc.output_content || '' },
      ];
    });
    const zipData = createZip(entries);
    downloadBlob(zipData, `${problemForm.slug || 'problem'}-testcases.zip`, 'application/zip');
  };

  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemForm.title.trim()) {
      setSaveError('Vui lòng nhập Tên bài tập.');
      return;
    }
    const finalSlug = (problemForm.slug.trim() || slugifyVietnamese(problemForm.title)).toLowerCase();
    if (!finalSlug) {
      setSaveError('URL Slug không hợp lệ.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const finalDesc = problemForm.constraints.trim()
      ? `${problemForm.description.trim()}\n\n### Ràng buộc dữ liệu (Constraints)\n${problemForm.constraints.trim()}`
      : problemForm.description.trim();

    const cleanedSamples = problemForm.samples
      .filter((s) => s.input.trim() || s.output.trim())
      .map((s) => ({
        input: s.input.trim(),
        output: s.output.trim(),
      }));

    const payload = {
      title: problemForm.title.trim(),
      slug: finalSlug,
      difficulty: problemForm.difficulty,
      description: finalDesc,
      input_format: problemForm.input_format.trim(),
      output_format: problemForm.output_format.trim(),
      time_limit_ms: Number(problemForm.time_limit_ms) || 1000,
      memory_limit_mb: Number(problemForm.memory_limit_mb) || 256,
      tags: problemForm.tags,
      samples: cleanedSamples,
      is_public: problemForm.is_public,
    };

    try {
      let savedProblemId = editingId;

      if (editingId) {
        const res = await updateProblem(editingId, payload);
        if (!res.ok) throw new Error(res.error || 'Cập nhật bài tập thất bại');
      } else {
        const res = await createProblem(payload);
        if (!res.ok) throw new Error(res.error || 'Tạo bài tập thất bại');
        savedProblemId = res.id || null;
      }

      if (savedProblemId) {
        if (deletedTcIds.length > 0) {
          for (const dId of deletedTcIds) {
            await deleteTestcase(dId);
          }
        }

        const newCases = stagedTestcases
          .filter((tc) => tc.is_new || !tc.id)
          .map((tc) => ({
            problem_id: savedProblemId!,
            input_content: tc.input_content,
            output_content: tc.output_content,
            score: tc.score,
            is_sample: tc.is_sample,
          }));

        if (newCases.length > 0) {
          await addTestcasesBatch(newCases);
        }
      }

      setNotice({
        type: 'success',
        text: editingId ? `Đã lưu cập nhật bài tập "${payload.title}".` : `Đã tạo bài tập "${payload.title}".`,
      });
      setEditingId(null);
      setProblemForm(EMPTY_FORM);
      onModeChange('list');
      fetchProblems();
    } catch (err: any) {
      setSaveError(err.message || 'Lỗi khi lưu bài tập');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProblem = async (id: string, title: string) => {
    if (!window.confirm(`Xóa bài "${title}"? Toàn bộ testcases và bài nộp sẽ bị xóa theo.`)) return;
    const res = await deleteProblem(id);
    if (!res.ok) {
      alert(res.error || 'Xóa thất bại');
      return;
    }
    setNotice({ type: 'success', text: `Đã xóa bài "${title}".` });
    setProblems((prev) => prev.filter((p) => p.id !== id));
  };

  const filteredProblems = problems.filter((p) => {
    const matchesKeyword =
      !searchKeyword.trim() ||
      p.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(searchKeyword.toLowerCase()));
    const matchesDiff = diffFilter === 'ALL' || p.difficulty === diffFilter;
    return matchesKeyword && matchesDiff;
  });

  const totalPoints = stagedTestcases.reduce((acc, tc) => acc + (Number(tc.score) || 0), 0);

  /* ─────────────────────────────────────────────────────────────
     MODE 1: GITHUB PRIMER STYLE PROBLEM STUDIO
  ───────────────────────────────────────────────────────────── */
  if (mode === 'create') {
    return (
      <div className="space-y-4 animate-fade-in pb-12 font-sans">
        {/* GitHub Subhead & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Quay lại danh sách? Các thay đổi chưa lưu có thể bị mất.')) {
                  onModeChange('list');
                }
              }}
              className="p-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              title="Quay lại danh sách"
            >
              <MorphIcon icon={ArrowLeftData} size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Problems / {editingId ? (problemForm.slug || 'edit') : 'new'}
                </span>
                <span
                  className={`text-[10px] font-medium font-mono px-2 py-0.2 rounded-full border ${
                    problemForm.is_public
                      ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/30'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {problemForm.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                {problemForm.title || (editingId ? 'Bài tập chưa đặt tên' : 'Soạn bài tập mới')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              <MorphIcon icon={EyeData} size={16} className="text-[var(--text-secondary)]" /> Xem trước đề
            </button>
            <button
              type="button"
              onClick={handleSaveProblem}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs border border-[var(--border)]/20"
            >
              {isSaving ? <MorphIcon icon={RefreshCwData} size={16} className="animate-spin" /> : <MorphIcon icon={CheckData} size={16} />}
              {isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo bài tập'}
            </button>
          </div>
        </div>

        {saveError && (
          <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-xs font-medium flex items-center gap-2">
            <MorphIcon icon={AlertCircleData} size={16} className="shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* GitHub UnderlineNav Tabs */}
        <nav className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            { id: 'statement', label: 'Đề bài & Cấu hình' },
            { id: 'samples', label: 'Ví dụ mẫu', count: problemForm.samples.length },
            { id: 'testcases', label: 'Bộ testcase', count: stagedTestcases.length },
            { id: 'editorial', label: 'Lời giải & Ghi chú' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStudioTab(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                studioTab === tab.id
                  ? 'border-[#fd8c73] dark:border-[#f78166] text-[var(--text-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] px-1.5 py-0.2 text-[10px] text-[var(--text-secondary)] font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* TAB 1: STATEMENT & BASIC INFO */}
        {studioTab === 'statement' && (
          <div className="space-y-4">
            {/* GitHub Box: Basic Settings */}
            <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
              <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2.5 border-b border-[var(--border)]">
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                  Cấu hình cơ bản & Giới hạn tài nguyên
                </h2>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8 space-y-1">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">Tên bài tập *</label>
                    <input
                      type="text"
                      required
                      value={problemForm.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="VD: 1001. Tính tổng hai số"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[var(--text-primary)]">URL Slug *</label>
                      <label className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 cursor-pointer font-normal">
                        <input
                          type="checkbox"
                          checked={autoSlug}
                          onChange={(e) => {
                            setAutoSlug(e.target.checked);
                            if (e.target.checked) {
                              setProblemForm((prev) => ({ ...prev, slug: slugifyVietnamese(prev.title) }));
                            }
                          }}
                          className="accent-[var(--accent)]"
                        />
                        Tự động
                      </label>
                    </div>
                    <input
                      type="text"
                      required
                      value={problemForm.slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setProblemForm({ ...problemForm, slug: e.target.value });
                      }}
                      placeholder="tinh-tong-hai-so"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                    />
                  </div>

                  {/* Difficulty */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">Mức độ khó</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Easy', 'Medium', 'Hard'] as const).map((diff) => {
                        const isSel = problemForm.difficulty === diff;
                        const label = diff === 'Easy' ? 'Dễ' : diff === 'Medium' ? 'Trung bình' : 'Khó';
                        return (
                          <button
                            key={diff}
                            type="button"
                            onClick={() => setProblemForm({ ...problemForm, difficulty: diff })}
                            className={`py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time limit */}
                  <div className="md:col-span-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[var(--text-primary)]">Thời gian (ms)</label>
                      <div className="flex items-center gap-1 text-[10px]">
                        {[500, 1000, 2000].map((ms) => (
                          <button
                            key={ms}
                            type="button"
                            onClick={() => setProblemForm({ ...problemForm, time_limit_ms: ms })}
                            className="px-1.5 py-0.2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono cursor-pointer"
                          >
                            {ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={problemForm.time_limit_ms}
                      onChange={(e) => setProblemForm({ ...problemForm, time_limit_ms: Number(e.target.value) })}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                    />
                  </div>

                  {/* Memory limit */}
                  <div className="md:col-span-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[var(--text-primary)]">Bộ nhớ (MB)</label>
                      <div className="flex items-center gap-1 text-[10px]">
                        {[128, 256, 512].map((mb) => (
                          <button
                            key={mb}
                            type="button"
                            onClick={() => setProblemForm({ ...problemForm, memory_limit_mb: mb })}
                            className="px-1.5 py-0.2 rounded border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono cursor-pointer"
                          >
                            {mb}MB
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={16}
                      step={16}
                      value={problemForm.memory_limit_mb}
                      onChange={(e) => setProblemForm({ ...problemForm, memory_limit_mb: Number(e.target.value) })}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                    />
                  </div>

                  {/* Tags (GitHub Repository Topics style) */}
                  <div className="md:col-span-12 space-y-2">
                    <label className="block text-xs font-semibold text-[var(--text-primary)]">Thẻ chủ đề (Topics & Labels)</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {POPULAR_TAGS.map((t) => {
                        const isSel = problemForm.tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleTagToggle(t)}
                            className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-colors cursor-pointer ${
                              isSel
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            {isSel ? `✓ ${t}` : t}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={handleAddCustomTag}
                      placeholder="Thêm thẻ chủ đề khác rồi gõ Enter..."
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                    />
                  </div>

                  <div className="md:col-span-12 pt-2 border-t border-[var(--border)]">
                    <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={problemForm.is_public}
                        onChange={(e) => setProblemForm({ ...problemForm, is_public: e.target.checked })}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                      <span>Công khai bài tập (học sinh có thể tìm kiếm và nộp bài tự do)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* GitHub Box: Markdown Editor (Write / Preview) */}
            <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
              <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                {/* Write / Preview Tab toggle */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMarkdownView('write')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      markdownView === 'write'
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkdownView('preview')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      markdownView === 'preview'
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkdownView('split')}
                    className={`hidden sm:inline-block px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      markdownView === 'split'
                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Split View
                  </button>
                </div>

                {/* Minimalist formatting bar */}
                <div className="hidden sm:flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setProblemForm((prev) => ({ ...prev, description: prev.description + ' **in đậm**' }))}
                    className="px-2 py-0.5 font-bold rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
                    title="In đậm"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemForm((prev) => ({ ...prev, description: prev.description + ' *in nghiêng*' }))}
                    className="px-2 py-0.5 italic rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
                    title="In nghiêng"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemForm((prev) => ({ ...prev, description: prev.description + ' `code`' }))}
                    className="px-2 py-0.5 font-mono rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
                    title="Code"
                  >
                    &lt;&gt;
                  </button>
                </div>
              </div>

              {/* Editor body */}
              <div className="p-3">
                {markdownView === 'write' && (
                  <textarea
                    rows={12}
                    required
                    value={problemForm.description}
                    onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                    placeholder="Mô tả đề bài chi tiết (Markdown hỗ trợ công thức $math$, code, bảng)..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-3 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
                  />
                )}

                {markdownView === 'preview' && (
                  <div className="w-full min-h-[240px] max-h-[400px] overflow-y-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-4 text-xs">
                    {problemForm.description.trim() ? (
                      <Markdown content={problemForm.description} />
                    ) : (
                      <p className="text-[var(--text-muted)] italic">Chưa có nội dung xem trước.</p>
                    )}
                  </div>
                )}

                {markdownView === 'split' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <textarea
                      rows={12}
                      required
                      value={problemForm.description}
                      onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                      placeholder="Mô tả đề bài chi tiết..."
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-3 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
                    />
                    <div className="w-full min-h-[220px] max-h-[340px] overflow-y-auto bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-3 text-xs">
                      {problemForm.description.trim() ? (
                        <Markdown content={problemForm.description} />
                      ) : (
                        <p className="text-[var(--text-muted)] italic">Xem trước đề bài thời gian thực...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-2 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                <span>Hỗ trợ chuẩn GitHub-Flavored Markdown</span>
                <span className="font-mono text-[10px]">{problemForm.description.length} ký tự</span>
              </div>
            </div>

            {/* Input / Output Formats & Constraints in GitHub Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
                <div className="bg-[var(--bg-tertiary)]/75 px-3 py-2 border-b border-[var(--border)]">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Định dạng đầu vào (Input)</label>
                </div>
                <div className="p-3">
                  <textarea
                    rows={4}
                    value={problemForm.input_format}
                    onChange={(e) => setProblemForm({ ...problemForm, input_format: e.target.value })}
                    placeholder="Dòng đầu gồm số nguyên N..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-2.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
                  />
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
                <div className="bg-[var(--bg-tertiary)]/75 px-3 py-2 border-b border-[var(--border)]">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Định dạng đầu ra (Output)</label>
                </div>
                <div className="p-3">
                  <textarea
                    rows={4}
                    value={problemForm.output_format}
                    onChange={(e) => setProblemForm({ ...problemForm, output_format: e.target.value })}
                    placeholder="In ra kết quả của bài toán..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-2.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
                  />
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
                <div className="bg-[var(--bg-tertiary)]/75 px-3 py-2 border-b border-[var(--border)]">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Ràng buộc (Constraints)</label>
                </div>
                <div className="p-3">
                  <textarea
                    rows={4}
                    value={problemForm.constraints}
                    onChange={(e) => setProblemForm({ ...problemForm, constraints: e.target.value })}
                    placeholder="1 ≤ N ≤ 10^5&#10;0 ≤ A[i] ≤ 10^9"
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-2.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SAMPLE TESTCASES */}
        {studioTab === 'samples' && (
          <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
            <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2.5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  Danh sách ví dụ mẫu
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Hiển thị trên trang làm bài để học sinh hiểu cách dữ liệu được nạp vào.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncSamplesToTestcases}
                  className="px-3 py-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer shadow-xs"
                >
                  Đồng bộ sang testcase chấm
                </button>
                <button
                  type="button"
                  onClick={handleAddSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
                >
                  <MorphIcon icon={PlusData} size={14} /> Thêm ví dụ
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {problemForm.samples.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                  <p>Chưa có ví dụ mẫu nào.</p>
                  <button
                    type="button"
                    onClick={handleAddSample}
                    className="px-3 py-1 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
                  >
                    + Thêm ví dụ
                  </button>
                </div>
              ) : (
                problemForm.samples.map((sample, idx) => (
                  <div
                    key={idx}
                    className="border border-[var(--border)] rounded-md bg-[var(--bg-primary)] p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Ví dụ #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSample(idx)}
                        className="p-1 rounded text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Xóa ví dụ này"
                      >
                        <MorphIcon icon={Trash2Data} size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Đầu vào (Input) *</label>
                        <textarea
                          rows={3}
                          value={sample.input}
                          onChange={(e) => handleSampleChange(idx, 'input', e.target.value)}
                          placeholder="Dữ liệu vào..."
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Đầu ra (Output) *</label>
                        <textarea
                          rows={3}
                          value={sample.output}
                          onChange={(e) => handleSampleChange(idx, 'output', e.target.value)}
                          placeholder="Kết quả ra..."
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Giải thích</label>
                        <input
                          type="text"
                          value={sample.explanation || ''}
                          onChange={(e) => handleSampleChange(idx, 'explanation', e.target.value)}
                          placeholder="Giải thích ngắn gọn cách tính kết quả..."
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-3 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TESTCASES & ZIP IMPORT */}
        {studioTab === 'testcases' && (
          <div className="space-y-4">
            {/* Box: ZIP Import */}
            <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
              <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2.5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                    Nhập & Xuất bộ testcase
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    File ZIP chuẩn: <code className="font-mono text-[var(--text-primary)]">input00.txt / output00.txt</code> hoặc <code className="font-mono text-[var(--text-primary)]">*.in / *.out</code>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={zipInputRef}
                    accept=".zip"
                    onChange={handleZipFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => zipInputRef.current?.click()}
                    disabled={isImportingZip}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isImportingZip ? <MorphIcon icon={RefreshCwData} size={14} className="animate-spin" /> : <MorphIcon icon={UploadData} size={14} />}
                    {isImportingZip ? 'Đang đọc...' : 'Tải lên ZIP'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTestcasesZip}
                    disabled={stagedTestcases.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <MorphIcon icon={DownloadData} size={14} className="text-[var(--text-secondary)]" /> Tải về ZIP
                  </button>
                </div>
              </div>

              {zipNotice && (
                <div className="p-3 bg-[var(--bg-primary)] border-b border-[var(--border)] text-xs font-medium text-[var(--text-primary)]">
                  {zipNotice}
                </div>
              )}

              {/* Manual Add inside box */}
              <div className="p-4 space-y-3 bg-[var(--bg-primary)]/40 border-b border-[var(--border)]">
                <span className="block text-xs font-semibold text-[var(--text-primary)]">
                  Thêm testcase thủ công
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <textarea
                    rows={2}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Input (dữ liệu vào)..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                  />
                  <textarea
                    rows={2}
                    value={manualOutput}
                    onChange={(e) => setManualOutput(e.target.value)}
                    placeholder="Output mong đợi..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      Điểm:
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={manualScore}
                        onChange={(e) => setManualScore(Number(e.target.value))}
                        className="w-14 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 py-0.5 text-xs text-center font-mono text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={manualIsSample}
                        onChange={(e) => setManualIsSample(e.target.checked)}
                        className="accent-[var(--accent)]"
                      />
                      Testcase mẫu (công khai cho học sinh)
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualTestcase}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer shadow-xs"
                  >
                    <MorphIcon icon={PlusData} size={14} /> Thêm test
                  </button>
                </div>
              </div>

              {/* Testcase List Table */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Danh sách testcase</span>
                    <span className="rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] px-2 py-0.2 text-[10px] text-[var(--text-secondary)] font-mono">
                      {stagedTestcases.length} tests · Tổng: {totalPoints} điểm
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDistribute100Points}
                      disabled={stagedTestcases.length === 0}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Chia đều 100 điểm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Xóa toàn bộ testcases hiện tại?')) {
                          setDeletedTcIds((prev) => [
                            ...prev,
                            ...stagedTestcases.map((t) => t.id).filter(Boolean) as string[],
                          ]);
                          setStagedTestcases([]);
                        }
                      }}
                      disabled={stagedTestcases.length === 0}
                      className="px-2.5 py-1 rounded-md text-[var(--danger)] hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                </div>

                {tcLoading ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
                    <MorphIcon icon={RefreshCwData} size={16} className="animate-spin mx-auto text-[var(--accent)]" />
                    <p>Đang tải testcases...</p>
                  </div>
                ) : stagedTestcases.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                    Chưa có testcase nào.
                  </div>
                ) : (
                  <div className="border border-[var(--border)] rounded-md overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-tertiary)]/75 text-[var(--text-muted)] font-medium text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Loại</th>
                          <th className="px-3 py-2">Điểm</th>
                          <th className="px-3 py-2">Đầu vào</th>
                          <th className="px-3 py-2">Đầu ra</th>
                          <th className="px-3 py-2 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-secondary)]">
                        {stagedTestcases.map((tc, idx) => (
                          <tr key={tc.id || idx} className="hover:bg-[var(--bg-tertiary)]/40 transition-colors">
                            <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">
                              #{idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setStagedTestcases((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], is_sample: !copy[idx].is_sample };
                                    return copy;
                                  });
                                }}
                                className={`px-2 py-0.2 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                                  tc.is_sample
                                    ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/30'
                                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)] border-[var(--border)]'
                                }`}
                              >
                                {tc.is_sample ? 'sample' : 'secret'}
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={tc.score}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setStagedTestcases((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], score: val };
                                    return copy;
                                  });
                                }}
                                className="w-12 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-1.5 py-0.2 text-xs text-center font-mono text-[var(--text-primary)]"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)] max-w-[200px] truncate">
                              {tc.input_content ? tc.input_content.replace(/\n/g, ' ⏎ ') : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-primary)] max-w-[200px] truncate">
                              {tc.output_content ? tc.output_content.replace(/\n/g, ' ⏎ ') : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (tc.id) {
                                    setDeletedTcIds((prev) => [...prev, tc.id!]);
                                  }
                                  setStagedTestcases((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                className="p-1 rounded text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Xóa testcase"
                              >
                                <MorphIcon icon={Trash2Data} size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EDITORIAL */}
        {studioTab === 'editorial' && (
          <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
            <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2.5 border-b border-[var(--border)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Lời giải mẫu & Ghi chú (Editorial)
              </h3>
            </div>

            <div className="p-4 space-y-2">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">Mã nguồn giải mẫu (C++ / Python)</label>
              <textarea
                rows={10}
                placeholder="#include <iostream>&#10;using namespace std;&#10;int main() { ... }"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md p-3 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] resize-y"
              />
            </div>
          </div>
        )}

        {/* GitHub Dialog: Student Preview */}
        {showPreviewModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowPreviewModal(false)}
          >
            <div
              className="w-full max-w-3xl bg-[var(--bg-primary)] border border-[var(--border)] rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)]">
                <div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    Preview Mode (Student view)
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {problemForm.title || 'Chưa đặt tên'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-pointer"
                >
                  <MorphIcon icon={XData} size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs text-[var(--text-primary)] leading-relaxed">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium border border-[var(--border)] bg-[var(--bg-secondary)]">
                    {problemForm.difficulty === 'Easy' ? 'Dễ' : problemForm.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {problemForm.time_limit_ms}ms · {problemForm.memory_limit_mb}MB
                  </span>
                </div>

                <div className="p-3.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                  <h4 className="font-semibold text-xs text-[var(--text-primary)]">Đề bài</h4>
                  <Markdown content={problemForm.description || 'Chưa có mô tả'} />
                </div>

                {problemForm.input_format && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Dữ liệu vào</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] font-mono">
                      {problemForm.input_format}
                    </div>
                  </div>
                )}

                {problemForm.output_format && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Dữ liệu ra</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] font-mono">
                      {problemForm.output_format}
                    </div>
                  </div>
                )}

                {problemForm.constraints && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Ràng buộc</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] font-mono">
                      {problemForm.constraints}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-[var(--text-primary)]">Ví dụ mẫu</h4>
                  {problemForm.samples.map((s, i) => (
                    <div key={i} className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Ví dụ #{i + 1}</span>
                      <div className="grid grid-cols-2 gap-3 font-mono">
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Input:</span>
                          <div className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border)] whitespace-pre-wrap">
                            {s.input || '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Output:</span>
                          <div className="bg-[var(--bg-primary)] p-2 rounded border border-[var(--border)] text-[var(--accent-text)] font-semibold whitespace-pre-wrap">
                            {s.output || '—'}
                          </div>
                        </div>
                      </div>
                      {s.explanation && (
                        <p className="text-[11px] text-[var(--text-secondary)] italic pt-1 border-t border-[var(--border)]">
                          Giải thích: {s.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     MODE 2: GITHUB ISSUES-STYLE PROBLEM LIST VIEW
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 font-sans">
      {/* GitHub Subhead */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Ngân hàng bài tập
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Quản lý danh sách đề bài, bộ testcase và cấu hình kiểm thử.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreateNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors cursor-pointer w-fit shadow-xs border border-[var(--border)]/20"
        >
          <MorphIcon icon={PlusData} size={14} /> Soạn bài mới
        </button>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-md text-xs font-medium flex items-center justify-between border ${
            notice.type === 'success'
              ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/20'
              : 'bg-red-500/10 text-[var(--danger)] border-red-500/20'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            <MorphIcon icon={XData} size={14} />
          </button>
        </div>
      )}

      {/* GitHub Issue Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <MorphIcon icon={SearchData} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên bài, slug hoặc thẻ chủ đề..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da]"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          {(['ALL', 'Easy', 'Medium', 'Hard'] as const).map((diff) => {
            const isSel = diffFilter === diff;
            const label = diff === 'ALL' ? 'Tất cả' : diff === 'Easy' ? 'Dễ' : diff === 'Medium' ? 'Trung bình' : 'Khó';
            return (
              <button
                key={diff}
                type="button"
                onClick={() => setDiffFilter(diff)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border)] font-semibold shadow-xs'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]/60'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* GitHub Box Table */}
      <div className="border border-[var(--border)] rounded-md bg-[var(--bg-secondary)] overflow-hidden shadow-xs">
        <div className="bg-[var(--bg-tertiary)]/75 px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
          <span>{filteredProblems.length} bài tập</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-[var(--bg-primary)] animate-pulse" />
            ))}
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-3">
            <p>Không tìm thấy bài tập nào phù hợp.</p>
            <button
              type="button"
              onClick={startCreateNew}
              className="px-3.5 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
            >
              + Soạn bài tập đầu tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredProblems.map((p) => {
              const count = testcaseCounts[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 hover:bg-[var(--bg-tertiary)]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEdit(p, 'statement')}
                        className="font-semibold text-xs text-[var(--text-primary)] hover:text-[#0969da] dark:hover:text-[#58a6ff] transition-colors cursor-pointer text-left"
                      >
                        {p.title}
                      </button>

                      {/* Difficulty Label */}
                      <span className="text-[10px] px-2 py-0.2 rounded-full font-mono border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                        {p.difficulty === 'Easy' ? 'Dễ' : p.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                      </span>

                      {/* Visibility Label */}
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${
                          p.is_public
                            ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/30'
                            : 'bg-zinc-500/10 text-[var(--text-muted)] border border-zinc-500/20'
                        }`}
                      >
                        {p.is_public ? 'public' : 'private'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                      <span>/{p.slug}</span>
                      <span>·</span>
                      <span>{p.time_limit_ms}ms</span>
                      <span>·</span>
                      <span>{p.memory_limit_mb}MB</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => startEdit(p, 'testcases')}
                        className="text-[var(--text-secondary)] hover:text-[#0969da] dark:hover:text-[#58a6ff] hover:underline cursor-pointer"
                      >
                        {count > 0 ? `${count} tests` : 'chưa có test'}
                      </button>
                    </div>

                    {p.tags && p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p.tags.map((t, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.2 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] font-normal"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <Link
                      to={`/problems/${p.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors"
                      title="Xem trang làm bài"
                    >
                      <MorphIcon icon={ExternalLinkData} size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(p, 'statement')}
                      className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
                      title="Chỉnh sửa bài tập"
                    >
                      <MorphIcon icon={EditData} size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProblem(p.id, p.title)}
                      className="p-1.5 rounded-md text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Xóa bài tập"
                    >
                      <MorphIcon icon={Trash2Data} size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
