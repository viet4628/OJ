import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useLocation, Link } from 'react-router-dom';
import DynamicMonacoEditor from '@monaco-editor/react';
import {
  ChevronLeft,
  Clock,
  Database,
  Play,
  Send,
  RefreshCw,
  Trophy,
  RotateCcw,
} from 'lucide-react';
import MorphIcon from '../../components/MorphIcon';
import { Sun as SunData, Moon as MoonData } from 'lucide';
import { type SidebarTab } from '../../components/Sidebar';
import {
  getProblemBySlug,
  createSubmission,
  getSubmission,
  getProblemSubmissions,
  runProblemCode,
  getProblemRank,
  supabase,
  type Problem,
  type Submission,
} from '../../lib/api';
import {
  STARTER_CODES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../constants/languages';
import { useTheme } from '../../lib/theme';
import ProblemLeftPane from './problem/ProblemLeftPane';
import ProblemTestPanel from './problem/ProblemTestPanel';

interface ProblemDetailProps {
  user: { id?: string; username: string; rating: number } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export default function ProblemDetail({ user, onOpenAuth }: ProblemDetailProps) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navState = location.state as { code?: string; language?: SupportedLanguage; submissionId?: string } | null;
  const { isDark, toggleTheme } = useTheme();

  const [problem, setProblem] = useState<Problem | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(true);
  const [historySubs, setHistorySubs] = useState<any[]>([]);
  const [rankRows, setRankRows] = useState<any[]>([]);
  const [hasResolvedInitialCode, setHasResolvedInitialCode] = useState<boolean>(() => Boolean(navState?.code));
  const [language, setLanguage] = useState<SupportedLanguage>(() => navState?.language || 'cpp');
  const [code, setCode] = useState<string>(() => navState?.code || '');
  const [loadedSubInfo, setLoadedSubInfo] = useState<{ id: string; status: string; createdAt?: string } | null>(() => {
    if (navState?.submissionId) {
      return { id: navState.submissionId, status: 'ACCEPTED' };
    }
    return null;
  });
  const codeCache = useRef<Record<string, string>>({
    cpp: navState?.language === 'cpp' && navState.code ? navState.code : STARTER_CODES.cpp,
    python: navState?.language === 'python' && navState.code ? navState.code : STARTER_CODES.python,
    rust: navState?.language === 'rust' && navState.code ? navState.code : STARTER_CODES.rust,
  });
  const [activeLeftTab, setActiveLeftTab] = useState<SidebarTab>('description');
  const [descFontSize, setDescFontSize] = useState<number>(13);
  const [editorFontSize, setEditorFontSize] = useState<number>(13);

  // Horizontal resizable split-pane (between left description pane and right editor)
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(42);
  const [isHorizResizing, setIsHorizResizing] = useState(false);
  const horizDragState = useRef<{ startX: number; startLeftWidth: number; containerWidth: number } | null>(null);
  const pendingLeftWidth = useRef<number | null>(null);
  const horizRafId = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flushHoriz = () => {
      horizRafId.current = 0;
      if (pendingLeftWidth.current != null) {
        setLeftWidthPercent(pendingLeftWidth.current);
        pendingLeftWidth.current = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const d = horizDragState.current;
      if (!d) return;
      e.preventDefault();
      const deltaX = e.clientX - d.startX;
      const deltaPercent = (deltaX / d.containerWidth) * 100;
      const nextPercent = Math.min(75, Math.max(20, d.startLeftWidth + deltaPercent));
      pendingLeftWidth.current = nextPercent;
      if (!horizRafId.current) horizRafId.current = requestAnimationFrame(flushHoriz);
    };

    const onMouseUp = () => {
      if (!horizDragState.current) return;
      horizDragState.current = null;
      setIsHorizResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (horizRafId.current) cancelAnimationFrame(horizRafId.current);
    };
  }, []);

  // Vertical resizable test panel (at bottom of right pane)
  const [testPanelOpen, setTestPanelOpen] = useState(true);
  const [testPanelHeight, setTestPanelHeight] = useState(200);
  const editorRef = useRef<any>(null);

  const vertDragState = useRef<{ startY: number; startH: number; maxH: number } | null>(null);
  const pendingVertHeight = useRef<number | null>(null);
  const vertRafId = useRef(0);
  const [isVertResizing, setIsVertResizing] = useState(false);

  useEffect(() => {
    const flushVert = () => {
      vertRafId.current = 0;
      if (pendingVertHeight.current != null) {
        setTestPanelHeight(pendingVertHeight.current);
        pendingVertHeight.current = null;
      }
    };

    const onMove = (e: MouseEvent) => {
      const d = vertDragState.current;
      if (!d) return;
      e.preventDefault();
      pendingVertHeight.current = Math.min(d.maxH, Math.max(120, d.startH + (d.startY - e.clientY)));
      if (!vertRafId.current) vertRafId.current = requestAnimationFrame(flushVert);
    };

    const stop = () => {
      if (!vertDragState.current) return;
      vertDragState.current = null;
      setIsVertResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
      if (vertRafId.current) cancelAnimationFrame(vertRafId.current);
    };
  }, []);

  // Keyboard shortcuts: Ctrl+Enter (run), Ctrl+Shift+Enter (submit)
  const submitRef = useRef<() => void>(() => {});
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) submitRef.current();
        else runRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeTestTab, setActiveTestTab] = useState(1);
  const [customInput, setCustomInput] = useState('');
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<'ready' | 'judging' | 'done'>('ready');
  const resultRef = useRef<HTMLDivElement>(null);

  const sampleTestcases = (problem?.samples || []).map((s, idx) => ({
    id: idx + 1,
    name: `Kiểm thử ${idx + 1}`,
    input: s.input,
    expected: s.output,
  }));

  const activeSample = sampleTestcases.find((t) => t.id === activeTestTab);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setIsProblemLoading(true);
      setProblem(null);
      if (!navState?.code) {
        setHasResolvedInitialCode(false);
        setLoadedSubInfo(null);
      }
      const p = await getProblemBySlug(slug);
      setProblem(p);
      if (p) {
        setActiveTestTab(1);
        const [problemSubs, top] = await Promise.all([
          getProblemSubmissions(p.id, 10),
          getProblemRank(p.id),
        ]);
        setHistorySubs(problemSubs);
        setRankRows(top);

        // If code was already provided synchronously via navigation state, keep it
        if (navState?.code) {
          setIsProblemLoading(false);
          setHasResolvedInitialCode(true);
          return;
        }

        // Load previously written / submitted code:
        const subIdFromUrl = searchParams.get('sub');
        let restored = false;

        // 1. If explicit ?sub= is in query
        if (subIdFromUrl) {
          const sub = await getSubmission(subIdFromUrl);
          if (sub && sub.code) {
            const subLang = (sub.language as SupportedLanguage) || 'cpp';
            codeCache.current[subLang] = sub.code;
            setLanguage(subLang);
            setCode(sub.code);
            setLoadedSubInfo({ id: sub.id, status: sub.status, createdAt: sub.created_at });
            restored = true;
          }
        }

        // 2. If not restored, check user's past submissions for this problem
        if (!restored) {
          const effectiveUserId = user?.id || (await supabase.auth.getUser()).data.user?.id;
          if (effectiveUserId) {
            const { data: mySubs } = await supabase
              .from('submissions')
              .select('id, language, code, status, created_at')
              .eq('problem_id', p.id)
              .eq('user_id', effectiveUserId)
              .eq('is_run', false)
              .order('created_at', { ascending: false })
              .limit(10);

            if (mySubs && mySubs.length > 0) {
              for (const s of mySubs) {
                if (s.code && s.language && !codeCache.current[s.language]) {
                  codeCache.current[s.language] = s.code;
                }
              }
              const bestSub = mySubs.find((s) => s.status === 'ACCEPTED') || mySubs[0];
              if (bestSub && bestSub.code) {
                const subLang = (bestSub.language as SupportedLanguage) || 'cpp';
                codeCache.current[subLang] = bestSub.code;
                setLanguage(subLang);
                setCode(bestSub.code);
                setLoadedSubInfo({ id: bestSub.id, status: bestSub.status, createdAt: bestSub.created_at });
                restored = true;
              }
            }
          }
        }

        if (!restored) {
          setCode(codeCache.current[language] || STARTER_CODES[language] || '');
        }
        setHasResolvedInitialCode(true);
      }
      setIsProblemLoading(false);
    })();
  }, [slug, searchParams.get('sub')]);

  useEffect(() => {
    if (!problem) return;
    const channel = supabase
      .channel(`problems-${problem.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `problem_id=eq.${problem.id}` },
        async (payload) => {
          const sub = await getSubmission(payload.new.id as string);
          if (sub && !sub.is_run) {
            setHistorySubs((prev) => {
              const exists = prev.some((x) => x.id === sub.id);
              return exists ? prev.map((x) => (x.id === sub.id ? sub : x)) : [sub, ...prev].slice(0, 10);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [problem?.id]);

  useEffect(() => {
    if (systemStatus === 'done') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [systemStatus]);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleTabKey = (setter: (v: string) => void) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setter(el.value.slice(0, start) + '\t' + el.value.slice(end));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 1;
    });
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    codeCache.current[language] = code;
    setLanguage(newLang);
    const nextCode = codeCache.current[newLang] ?? (STARTER_CODES[newLang] || '');
    setCode(nextCode);
  };

  const handleResetCode = () => {
    const starter = STARTER_CODES[language] || '';
    setCode(starter);
    codeCache.current[language] = starter;
    setLoadedSubInfo(null);
  };

  const handleSelectSubmission = (sub: any) => {
    if (!sub?.code) return;
    const subLang = (sub.language as SupportedLanguage) || language;
    codeCache.current[subLang] = sub.code;
    setLanguage(subLang);
    setCode(sub.code);
    setLoadedSubInfo({ id: sub.id, status: sub.status, createdAt: sub.created_at });
  };

  const isBusy = isRunning || isSubmitting;

  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current !== null) clearTimeout(pollRef.current);
    };
  }, []);

  const pollSubmission = (submissionId: string): Promise<Submission | null> =>
    new Promise((resolve) => {
      let attempts = 0;
      const poll = () => {
        if (!mountedRef.current) return resolve(null);
        getSubmission(submissionId)
          .then((sub) => {
            if (!mountedRef.current) return resolve(null);
            if (sub && !['PENDING', 'JUDGING'].includes(sub.status)) {
              return resolve(sub);
            }
            attempts++;
            if (attempts < 30) {
              const delay = attempts < 5 ? 400 : 800;
              pollRef.current = window.setTimeout(poll, delay);
            } else {
              resolve(null);
            }
          })
          .catch((err) => {
            console.error('[ProblemDetail] pollSubmission error:', err);
            attempts++;
            if (attempts < 30) {
              pollRef.current = window.setTimeout(poll, 800);
            } else {
              resolve(null);
            }
          });
      };
      // Run first poll after 200ms
      pollRef.current = window.setTimeout(poll, 200);
    });

  const handleRun = async () => {
    if (!problem || isBusy) return;
    setSubmissionError(null);
    setIsRunning(true);
    setSystemStatus('judging');
    setRunOutput(null);
    setSubmissionResult(null);
    setTestPanelOpen(true);

    const input = activeTestTab === -1 ? customInput : (activeSample?.input || '');
    const res = await runProblemCode({ problem_id: problem.id, language, code, input });
    if (!res.ok || !res.id) {
      setSubmissionError(res.error || 'Chạy thử thất bại');
      setIsRunning(false);
      setSystemStatus('done');
      return;
    }

    const sub = await pollSubmission(res.id);
    if (sub) {
      const tc = (sub.details as any[])?.[0];
      if (sub.status === 'COMPILE_ERROR') {
        setSubmissionError(sub.error_log || 'Lỗi biên dịch');
      } else if (
        ['RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'SYSTEM_ERROR'].includes(sub.status)
      ) {
        setSubmissionError(tc?.error || sub.status);
      }
      setRunOutput(tc?.output ?? '');
    } else {
      setSubmissionError('Hệ thống đang xử lý bài nộp, bạn có thể xem lại kết quả trong lịch sử nộp bài');
    }
    setIsRunning(false);
    setSystemStatus('done');
  };

  const handleSubmit = async () => {
    if (!problem || isBusy) return;
    setSubmissionError(null);
    setIsSubmitting(true);
    setSystemStatus('judging');
    setTestPanelOpen(true);
    setSubmissionResult({ status: 'PENDING', passedCount: 0, totalCount: 0, timeMs: 0, memoryMb: 0, testcases: [] });

    const res = await createSubmission({ problem_id: problem.id, language, code });
    if (!res.ok || !res.id) {
      setSubmissionError(res.error || 'Nộp bài thất bại');
      setSubmissionResult({ status: 'ERROR', passedCount: 0, totalCount: 0, timeMs: 0, memoryMb: 0, testcases: [] });
      setSystemStatus('done');
      setIsSubmitting(false);
      return;
    }

    const sub = await pollSubmission(res.id);
    if (sub) {
      setSubmissionResult({
        status: sub.status,
        passedCount: (sub.details as any[])?.filter((d) => d.status === 'ACCEPTED').length || 0,
        totalCount: (sub.details as any[])?.length || 0,
        timeMs: sub.time_used_ms,
        memoryMb: sub.memory_used_mb,
        testcases: (sub.details as any[]).map((d, idx) => ({
          id: idx + 1,
          name: `Testcase #${idx + 1}${d.is_sample ? ' (Mẫu)' : ''}`,
          isSample: !!d.is_sample,
          status: d.status,
          timeMs: d.time_ms,
          memoryMb: d.memory_mb,
        })),
        errorLog: sub.error_log,
      });
    } else {
      setSubmissionResult({
        status: 'PENDING',
        passedCount: 0,
        totalCount: 0,
        timeMs: 0,
        memoryMb: 0,
        testcases: [],
        note: 'Hệ thống đang xử lý bài nộp, bạn có thể xem lại kết quả trong lịch sử nộp bài',
      });
    }
    setSystemStatus('done');
    setIsSubmitting(false);
  };

  submitRef.current = handleSubmit;
  runRef.current = handleRun;

  const difficultyLabel = problem?.difficulty === 'Easy' ? 'DỄ' : problem?.difficulty === 'Medium' ? 'VỪA' : 'KHÓ';
  const difficultyColor =
    problem?.difficulty === 'Easy'
      ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/30'
      : problem?.difficulty === 'Medium'
      ? 'bg-amber-500/10 text-[#9A6700] dark:text-[#D29922] border-amber-500/20'
      : 'bg-red-500/10 text-[#CF222E] dark:text-[#F85149] border-red-500/20';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* 1. TOP SINGLE HEADER BAR */}
      <header className="h-11 shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border)] px-3 flex items-center justify-between text-xs select-none transition-colors duration-150">
        <div className="flex items-center gap-2.5">
          <Link
            to="/problems"
            className="p-1 rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Quay lại danh sách bài tập"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-[var(--text-primary)] text-xs tracking-tight">
              {isProblemLoading ? 'Đang tải...' : problem ? problem.title : 'Không tìm thấy bài tập'}
            </h1>
            {problem && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border ${difficultyColor}`}>
                {difficultyLabel}
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-[var(--text-secondary)] font-mono pl-2.5 border-l border-[var(--border)]">
            <span className="flex items-center gap-1" title="Giới hạn thời gian">
              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" /> {(problem?.time_limit_ms || 1000) / 1000}s
            </span>
            <span className="flex items-center gap-1" title="Giới hạn bộ nhớ">
              <Database className="w-3.5 h-3.5 text-[var(--text-muted)]" /> {problem?.memory_limit_mb || 256}MB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer flex items-center justify-center"
            title={isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối (Dark mode)'}
            aria-label="Toggle Theme"
          >
            <MorphIcon
              icon={isDark ? SunData : MoonData}
              size={14}
              spring="snappy"
              className={isDark ? 'text-amber-400' : 'text-slate-700'}
            />
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-secondary)]">
                <Trophy className="w-3 h-3 text-[var(--text-muted)]" />
                <span>{user.rating} AC</span>
              </div>
              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border)]">
                <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white font-bold flex items-center justify-center text-[10px]">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-xs text-[var(--text-primary)] hidden md:inline">{user.username}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1 rounded-md bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer shadow-xs"
            >
              Đăng Nhập
            </button>
          )}
        </div>
      </header>

      {/* 2. WORKSPACE CONTAINER */}
      <div ref={workspaceRef} className="flex flex-1 overflow-hidden">
        {/* Left Sidebar & Left Description Pane with Dynamic Width */}
        <ProblemLeftPane
          problem={problem}
          slug={slug}
          isProblemLoading={isProblemLoading}
          activeLeftTab={activeLeftTab}
          onTabChange={setActiveLeftTab}
          descFontSize={descFontSize}
          onDescFontSizeChange={setDescFontSize}
          rankRows={rankRows}
          historySubs={historySubs}
          sampleTestcases={sampleTestcases}
          copiedId={copiedId}
          onCopy={handleCopy}
          widthPercent={leftWidthPercent}
          onSelectSubmission={handleSelectSubmission}
        />

        {/* Horizontal Resizer between Left Pane and Right Editor */}
        <div
          onMouseDown={(e) => {
            if (!workspaceRef.current) return;
            const containerWidth = workspaceRef.current.clientWidth;
            horizDragState.current = {
              startX: e.clientX,
              startLeftWidth: leftWidthPercent,
              containerWidth,
            };
            setIsHorizResizing(true);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
          }}
          onDoubleClick={() => setLeftWidthPercent(42)}
          className="group relative w-2 shrink-0 cursor-col-resize select-none bg-[var(--bg-secondary)] hover:bg-[var(--accent)]/20 transition-colors flex items-center justify-center"
          title="Kéo để chỉnh độ rộng · Double-click để khôi phục mặc định (42%)"
        >
          <div
            className={`absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 transition-colors duration-150 ${
              isHorizResizing ? 'bg-[var(--accent)]' : 'bg-[var(--border)] group-hover:bg-[var(--accent)]'
            }`}
          />
          <div className="z-10 flex flex-col gap-1 p-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-0.5 h-1 bg-[var(--text-muted)] rounded-full" />
            <div className="w-0.5 h-1 bg-[var(--text-muted)] rounded-full" />
            <div className="w-0.5 h-1 bg-[var(--text-muted)] rounded-full" />
          </div>
        </div>

        {/* Right Code Editor & Test Pane */}
        <div className="flex-1 flex flex-col bg-[var(--bg-primary)] overflow-hidden min-w-0">
          {/* Top Editor Toolbar */}
          <div className="h-10 shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] px-3 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as any)}
                className="bg-[var(--bg-primary)] border border-[var(--border)] text-xs rounded-md px-2.5 py-1 text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent)] cursor-pointer transition-colors shadow-xs"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleResetCode}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer shadow-xs"
                title="Đặt lại mẫu code ban đầu"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Đặt lại mẫu
              </button>

              {loadedSubInfo && (
                <span
                  className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[11px] font-mono text-[var(--text-secondary)] shadow-xs"
                  title={`Khôi phục từ bài nộp #${loadedSubInfo.id.slice(0, 8)} (${loadedSubInfo.status})`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${loadedSubInfo.status === 'ACCEPTED' ? 'bg-[var(--accent)]' : 'bg-amber-500'}`} />
                  <span>Code bài nộp ({loadedSubInfo.status === 'ACCEPTED' ? 'AC' : loadedSubInfo.status})</span>
                </span>
              )}

              <span
                className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg-primary)] font-mono text-[10px] text-[var(--text-muted)]"
                title="Cỡ chữ code — Ctrl + lăn chuột trong editor để đổi"
              >
                {editorFontSize}px
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRun}
                disabled={isBusy || !problem}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                ) : (
                  <Play className="w-3 h-3 fill-current text-[var(--text-secondary)]" />
                )}
                {isRunning ? 'Đang chạy thử...' : 'Chạy thử'}
              </button>

              <button
                onClick={handleSubmit}
                disabled={isBusy || !problem}
                className="flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isSubmitting ? 'Đang chấm bài...' : 'Nộp bài'}
              </button>
            </div>
          </div>

          {/* Monaco Editor Container — Automatically adapts vs-dark / light */}
          <div className="flex-1 overflow-hidden bg-[#1e1e1e] relative">
            {!hasResolvedInitialCode && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)] z-10 text-xs font-mono text-[var(--text-muted)] gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-text)]" />
                <span>Đang nạp bài làm...</span>
              </div>
            )}
            <DynamicMonacoEditor
              height="100%"
              language={SUPPORTED_LANGUAGES.find((l) => l.value === language)?.monaco || 'cpp'}
              theme={isDark ? 'vs-dark' : 'light'}
              value={code}
              onChange={(value) => {
                const next = value || '';
                setCode(next);
                codeCache.current[language] = next;
              }}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                editor.onDidChangeConfiguration((e) => {
                  if (e.hasChanged(monaco.editor.EditorOption.fontSize)) {
                    const px = editor.getOption(monaco.editor.EditorOption.fontSize);
                    setEditorFontSize(Math.min(24, Math.max(10, Number(px) || 13)));
                  }
                });
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                  submitRef.current();
                });
              }}
              options={{
                fontSize: editorFontSize,
                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                smoothScrolling: true,
                mouseWheelZoom: true,
              }}
            />
          </div>

          {/* Resizer */}
          <div
            onMouseDown={(e) => {
              vertDragState.current = {
                startY: e.clientY,
                startH: testPanelHeight,
                maxH: Math.max(320, Math.round(window.innerHeight * 0.7)),
              };
              setIsVertResizing(true);
              document.body.style.userSelect = 'none';
              document.body.style.cursor = 'row-resize';
            }}
            onDoubleClick={() => setTestPanelHeight(260)}
            className="group relative h-2 shrink-0 cursor-row-resize select-none bg-[var(--bg-secondary)]"
            title="Kéo để đổi chiều cao · Double-click để reset"
          >
            <div
              className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-colors duration-150 ${
                isVertResizing
                  ? 'bg-[var(--accent)]'
                  : 'bg-transparent group-hover:bg-[var(--accent)]/40'
              }`}
            />
          </div>

          {/* Testcase Panel */}
          <ProblemTestPanel
            testPanelOpen={testPanelOpen}
            testPanelHeight={testPanelHeight}
            isResizing={isVertResizing}
            onToggleOpen={() => setTestPanelOpen((o) => !o)}
            sampleTestcases={sampleTestcases}
            activeTestTab={activeTestTab}
            setActiveTestTab={setActiveTestTab}
            customInput={customInput}
            setCustomInput={setCustomInput}
            handleTabKey={handleTabKey}
            submissionError={submissionError}
            user={user}
            onOpenAuth={onOpenAuth}
            isRunning={isRunning}
            runOutput={runOutput}
            activeSample={activeSample}
            submissionResult={submissionResult}
            resultRef={resultRef}
            systemStatus={systemStatus}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
