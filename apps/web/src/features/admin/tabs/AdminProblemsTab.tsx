import React, { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../../components/MorphIcon';
import { Edit as EditData, Download as DownloadData, Trash2 as Trash2Data, Plus as PlusData, X as XData, Upload as UploadData, Eye as EyeData, ArrowLeft as ArrowLeftData, ExternalLink as ExternalLinkData, Check as CheckData, RefreshCw as RefreshCwData } from 'lucide';
import { supabase } from '../../../lib/supabase';
import {
  getAllProblems,
  getProblemEditorial,
  saveProblemBundle,
  getProblemValidation, validateProblemSolution, getSubmission,
  deleteProblem,
  type Problem,
  type Submission,
} from '../../../lib/api';
import { createZip, downloadBlob, parseZip, pairTestcases } from '../../../lib/zip';
import Markdown from '../../../components/Markdown';
import { STARTER_CODES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../../constants/languages';

const RichTextEditor = lazy(() => import('../../../components/RichTextEditor'));
const ProblemStatementEditor = lazy(() => import('../../../components/RichTextEditor').then(module => ({ default: module.ProblemStatementEditor })));

export interface ProblemForm {
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  starter_codes: Partial<Record<SupportedLanguage, string>>;
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
  storage_input?: boolean;
  storage_output?: boolean;
}

const EMPTY_FORM: ProblemForm = {
  title: '',
  slug: '',
  difficulty: 'Easy',
  description: '',
  starter_codes: {},
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
  /** Teachers manage only problems they created; admins manage all. */
  userId: string;
  isAdmin?: boolean;
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

export default function AdminProblemsTab({ mode, onModeChange, userId, isAdmin = false }: AdminProblemsTabProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search & Filter in list view
  const [searchKeyword, setSearchKeyword] = useState('');
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'Easy' | 'Medium' | 'Hard'>('ALL');
  const [testcaseCounts, setTestcaseCounts] = useState<Record<string, number>>({});

  // Studio state
  const [studioTab, setStudioTab] = useState<'statement' | 'samples' | 'testcases' | 'editorial' | 'starter'>('statement');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [problemForm, setProblemForm] = useState<ProblemForm>(EMPTY_FORM);
  const [editorial, setEditorial] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [referenceLanguage, setReferenceLanguage] = useState('cpp');
  const [validation, setValidation] = useState<Submission | null>(null);
  const [checking, setChecking] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    if (!validation || !['PENDING','JUDGING'].includes(validation.status)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await getSubmission(validation.id);
      if (cancelled) return;
      if (result) setValidation(result);
      else setValidationError('Không lấy được kết quả kiểm định. Hãy mở lại đề để kiểm tra.');
    }, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [validation]);
  const checkReference = async () => {
    if (!editingId || checking) return;
    setChecking(true);
    setValidationError(null);
    try {
      const id = await validateProblemSolution(editingId, referenceLanguage, referenceCode);
      setValidation(await getSubmission(id));
    } catch (err: any) { setValidationError(err.message || 'Không bắt đầu được kiểm định'); }
    finally { setChecking(false); }
  };
  const [autoSlug, setAutoSlug] = useState(true);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  // Staged testcases for the current problem
  const [stagedTestcases, setStagedTestcases] = useState<StagedTestcase[]>([]);
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
      const data = await getAllProblems(isAdmin ? undefined : userId);
      setProblems(data.filter((p) => isAdmin || p.created_by === userId));
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
  }, [userId, isAdmin]);

  const handleTitleChange = (val: string) => {
    setProblemForm((prev) => ({
      ...prev,
      title: val,
      slug: autoSlug ? slugifyVietnamese(val) : prev.slug,
    }));
  };

  const startCreateNew = () => {
    setEditorial('');
    setReferenceCode(''); setValidation(null); setValidationError(null);
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
    setStudioTab('statement');
    setSaveError(null);
    onModeChange('create');
  };

  const startEdit = async (p: Problem, targetTab: 'statement' | 'samples' | 'testcases' = 'statement') => {
    setEditorial('');
    setReferenceCode(''); setValidation(null); setValidationError(null);
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
      starter_codes: p.starter_codes || {},
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
    try {
      const { data: rows, error } = await supabase
        .from('testcases')
        .select('*')
        .eq('problem_id', p.id)
        .order('is_sample', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setEditorial(await getProblemEditorial(p.id) || '');
      const previousValidation = await getProblemValidation(p.id);
      setValidation(previousValidation);
      setReferenceCode(previousValidation?.code || '');
      setReferenceLanguage(previousValidation?.language || 'cpp');

      setStagedTestcases(
        (rows || []).map((r: any) => ({
          id: r.id,
          input_content: r.input_content || '',
          output_content: r.output_content || '',
          storage_input: r.input_content == null,
          storage_output: r.output_content == null,
          score: r.score ?? 10,
          is_sample: Boolean(r.is_sample),
        }))
      );
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Không tải được đề/testcase/lời giải. Chưa mở form để tránh mất dữ liệu.' });
      return;
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
    setStagedTestcases((prev) => [
      ...prev,
      {
        input_content: manualInput,
        output_content: manualOutput,
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
        setZipNotice('ZIP chưa có cặp testcase hợp lệ. Dùng 01.in với 01.out hoặc 01.ans; hoặc input00.txt với output00.txt.');
        return;
      }
      const importedCases: StagedTestcase[] = pairs.map((p) => ({
        input_content: p.input,
        output_content: p.output,
        score: 10,
        is_sample: false,
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

    if (!problemForm.description.trim()) {
      setSaveError('Vui lòng nhập mô tả đề bài.');
      return;
    }
    if (editorial.length > 200000) {
      setSaveError('Lời giải quá dài (tối đa 200.000 ký tự).');
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
      starter_codes: Object.fromEntries(Object.entries(problemForm.starter_codes).filter(([, code]) => code?.trim())),
      input_format: problemForm.input_format.trim(),
      output_format: problemForm.output_format.trim(),
      time_limit_ms: Number(problemForm.time_limit_ms) || 1000,
      memory_limit_mb: Number(problemForm.memory_limit_mb) || 256,
      tags: problemForm.tags,
      samples: cleanedSamples,
      is_public: problemForm.is_public,
    };

    try {
      await saveProblemBundle(editingId, payload, stagedTestcases.map(tc => ({
        id: tc.id, input_content: tc.storage_input ? null : tc.input_content,
        output_content: tc.storage_output ? null : tc.output_content, score: tc.score, is_sample: tc.is_sample,
      })), editorial);

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

            <span>{saveError}</span>
          </div>
        )}

        {/* GitHub UnderlineNav Tabs */}
        <nav className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto no-scrollbar">
          {[
            { id: 'statement', label: 'Đề bài & Cấu hình' },
            { id: 'samples', label: 'Ví dụ mẫu', count: problemForm.samples.length },
            { id: 'starter', label: 'Code khởi đầu' },
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

        {studioTab === 'starter' && (
          <section className="space-y-4 border border-[var(--border)] rounded-md p-4 bg-[var(--bg-secondary)]">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Code khởi đầu</h3>
              <p className="text-xs text-[var(--text-secondary)]">Học sinh nhìn thấy code này khi bắt đầu làm bài. Để trống để dùng mẫu hệ thống. Không nhập lời giải chuẩn hoặc dữ liệu testcase ẩn. Tổng các mẫu tối đa 200 KB.</p>
            </div>
            {SUPPORTED_LANGUAGES.map(({ value, label }) => (
              <details key={value} open={value === 'cpp'} className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium">Code khởi đầu {value === 'cpp' ? 'C++' : label}</summary>
                <textarea rows={12} maxLength={60000} spellCheck={false}
                  aria-label={`Code khởi đầu ${value === 'cpp' ? 'C++' : label}`}
                  value={problemForm.starter_codes[value] || ''} placeholder={STARTER_CODES[value]}
                  onChange={e => setProblemForm(prev => ({ ...prev, starter_codes: { ...prev.starter_codes, [value]: e.target.value } }))}
                  className="block w-full rounded-b-md border-t border-[var(--border)] bg-[var(--bg-primary)] p-3 font-mono text-sm leading-relaxed text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
              </details>
            ))}
          </section>
        )}

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
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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

            <Suspense fallback={<p role="status">Đang tải trình soạn thảo...</p>}>
              <ProblemStatementEditor sections={[
                { label: 'Mô tả đề bài', value: problemForm.description, onChange: description => setProblemForm(prev => ({ ...prev, description })) },
                { label: 'Dữ liệu vào', value: problemForm.input_format, onChange: input_format => setProblemForm(prev => ({ ...prev, input_format })) },
                { label: 'Dữ liệu ra', value: problemForm.output_format, onChange: output_format => setProblemForm(prev => ({ ...prev, output_format })) },
                { label: 'Ràng buộc', value: problemForm.constraints, onChange: constraints => setProblemForm(prev => ({ ...prev, constraints })) },
              ]} />
            </Suspense>
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
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Đầu ra (Output) *</label>
                        <textarea
                          rows={3}
                          value={sample.output}
                          onChange={(e) => handleSampleChange(idx, 'output', e.target.value)}
                          placeholder="Kết quả ra..."
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Giải thích</label>
                        <input
                          type="text"
                          value={sample.explanation || ''}
                          onChange={(e) => handleSampleChange(idx, 'explanation', e.target.value)}
                          placeholder="Giải thích ngắn gọn cách tính kết quả..."
                          className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-3 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
                    Mỗi testcase gồm một file đầu vào (input) và một file kết quả mong đợi (output). Nén các cặp file vào ZIP để tải lên.
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

              <section aria-label="Hướng dẫn chuẩn bị testcase" className="p-4 border-b border-[var(--border)] space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                <h4 className="font-semibold text-[var(--text-primary)]">Cách chuẩn bị file testcase</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p><strong className="text-[var(--text-primary)]">Input:</strong> đuôi <code>.in</code>. <strong className="text-[var(--text-primary)]">Output:</strong> đuôi <code>.out</code> hoặc <code>.ans</code>. Hai file phải cùng tên trước đuôi: <code>01.in</code> ghép với <code>01.out</code> hoặc <code>01.ans</code>.</p>
                    <p>Với file <code>.txt</code>, dùng cặp <code>input00.txt</code> / <code>output00.txt</code>, <code>input01.txt</code> / <code>output01.txt</code>… có cùng số thứ tự.</p>
                    <pre aria-label="Ví dụ cấu trúc ZIP" className="rounded border border-[var(--border)] bg-[var(--bg-primary)] p-3 font-mono overflow-x-auto">{'testcases.zip\n  01.in\n  01.out\n  02.in\n  02.out'}</pre>
                  </div>
                  <ul className="list-disc pl-4 space-y-2">
                    <li>Lưu nội dung dưới dạng văn bản thuần UTF-8. File input chứa dữ liệu đưa vào chương trình; file output chứa kết quả đúng cần đối chiếu.</li>
                    <li>Mỗi file tối đa 1 MiB; ZIP và tổng dữ liệu giải nén tối đa 32 MiB.</li>
                    <li>Tên file phải duy nhất trong ZIP, kể cả ở thư mục con hoặc chỉ khác chữ hoa/thường. Thiếu cặp input/output sẽ hủy toàn bộ lượt nhập.</li>
                    <li>Chương trình đọc từ đầu vào chuẩn (<code>cin</code>, <code>input()</code>) và ghi ra đầu ra chuẩn (<code>cout</code>, <code>print()</code>).</li>
                    <li>Testcase nhập từ ZIP mặc định là test ẩn. Kiểm tra điểm từng test rồi bấm <strong>Lưu thay đổi</strong> hoặc <strong>Tạo bài tập</strong> để lưu.</li>
                  </ul>
                </div>
              </section>

              {zipNotice && (
                <div role="status" className="p-3 bg-[var(--bg-primary)] border-b border-[var(--border)] text-xs font-medium text-[var(--text-primary)]">
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
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  <textarea
                    rows={2}
                    value={manualOutput}
                    onChange={(e) => setManualOutput(e.target.value)}
                    placeholder="Output mong đợi..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
              <Suspense fallback={<p role="status">Đang tải trình soạn thảo...</p>}>
                <RichTextEditor label="Lời giải" value={editorial} onChange={setEditorial} />
              </Suspense>
              <p className="text-xs text-[var(--text-secondary)]">Lưu cùng đề và testcase. Học sinh xem sau khi AC; lời giải bị khóa trong kỳ thi đang diễn ra.</p>
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <h3 className="text-sm font-semibold">Kiểm định lời giải chuẩn</h3>
                <p className="text-xs text-[var(--text-secondary)]">Chạy trên toàn bộ testcase đã lưu. Lưu lại đề sẽ làm mất hiệu lực kết quả cũ. Kiểm định không tính lịch sử luyện tập hoặc xếp hạng.</p>
                <label className="block text-xs">Ngôn ngữ kiểm định<select value={referenceLanguage} onChange={e => setReferenceLanguage(e.target.value)} className="block border border-[var(--border)] rounded p-2 bg-[var(--bg-primary)]"><option value="cpp">C++17</option><option value="python">Python 3</option><option value="rust">Rust</option></select></label>
                <label className="block text-xs">Mã nguồn kiểm định<textarea value={referenceCode} onChange={e => setReferenceCode(e.target.value)} rows={8} maxLength={100000} className="block w-full border border-[var(--border)] rounded p-3 bg-[var(--bg-primary)] font-mono" /></label>
                <button type="button" onClick={checkReference} disabled={!editingId || !referenceCode.trim() || checking || !!validation && ['PENDING','JUDGING'].includes(validation.status)} className="border border-[var(--border)] rounded px-3 py-2 text-xs disabled:opacity-50">Kiểm định lời giải</button>
                {!editingId && <p className="text-xs">Lưu đề trước khi kiểm định.</p>}
                {validationError && <p role="alert" className="text-xs text-[var(--danger)]">{validationError}</p>}
                {validation && <p role="status" className="text-xs">{validation.code !== referenceCode || validation.language !== referenceLanguage ? `Mã hiện tại chưa được kiểm định. Kết quả mã đã gửi: ${validation.status}.` : `Kiểm định: ${validation.status}${validation.status === 'ACCEPTED' ? ' — đạt toàn bộ testcase.' : ''}`}</p>}
                {validation?.error_log && <pre className="text-xs whitespace-pre-wrap">{validation.error_log}</pre>}
              </div>
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

                {problemForm.input_format && !(problemForm.description || '').toLowerCase().includes('dữ liệu vào') && !(problemForm.description || '').toLowerCase().includes('input format') && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Dữ liệu vào</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)]">
                      <Markdown content={problemForm.input_format} />
                    </div>
                  </div>
                )}

                {problemForm.output_format && !(problemForm.description || '').toLowerCase().includes('dữ liệu ra') && !(problemForm.description || '').toLowerCase().includes('output format') && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Dữ liệu ra</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)]">
                      <Markdown content={problemForm.output_format} />
                    </div>
                  </div>
                )}

                {problemForm.constraints && !(problemForm.description || '').toLowerCase().includes('ràng buộc') && !(problemForm.description || '').toLowerCase().includes('giới hạn') && !(problemForm.description || '').toLowerCase().includes('constraints') && (
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs text-[var(--text-primary)]">Ràng buộc</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)]">
                      <Markdown content={problemForm.constraints} />
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

          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên bài, slug hoặc thẻ chủ đề..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
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
