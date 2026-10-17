import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DynamicMonacoEditor from '@monaco-editor/react';
import {
  ChevronLeft, Clock, Database, Send, RefreshCw, Check, X, CheckCircle2, XCircle,
  Loader2, Lock, Trophy, Timer, Copy, CircleDashed,
} from 'lucide-react';
import MorphIcon from '../../components/MorphIcon';
import { Sun as SunData, Moon as MoonData, Copy as CopyData, Check as CheckData } from 'lucide';
import Markdown from '../../components/Markdown';
import {
  getContest, getContestProblems, createContestSubmission, getSubmission,
  getMyContestSubmissions, supabase,
  type Contest,
} from '../../lib/api';
import { STARTER_CODES, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../constants/languages';
import { useTheme } from '../../lib/theme';

export default function ContestProblem({ user, onOpenAuth }: { user: { username: string; rating: number } | null; onOpenAuth: () => void }) {
  const { isDark, toggleTheme } = useTheme();
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const [contest, setContest] = useState<any>(null);
  const [problem, setProblem] = useState<any>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<SupportedLanguage>('cpp');
  const [code, setCode] = useState(STARTER_CODES.cpp);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!id || !pid) return;
    (async () => {
      setLoading(true);
      const [c, rows] = await Promise.all([getContest(id), getContestProblems(id)]);
      setContest(c);
      setProblem(rows.find((r) => r.problem_id === pid)?.problems || null);
      setMySubs(await getMyContestSubmissions(id));
      setLoading(false);
    })();
  }, [id, pid]);

  useEffect(() => {
    setCode(STARTER_CODES[language] || '');
  }, [language]);

  const status = contest ? (Date.now() < new Date(contest.start_time).getTime() ? 'NOT_STARTED' : Date.now() >= new Date(contest.end_time).getTime() ? 'ENDED' : 'UNDERWAY') : null;
  const canSubmit = status === 'UNDERWAY' && !isSubmitting;

  const samples = useMemo<{ id: number; input: string; expected: string }[]>(() => (problem?.samples || []).map((s: any, idx: number) => ({ id: idx + 1, input: s.input, expected: s.output })), [problem]);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const handleSubmit = async () => {
    if (!id || !pid || !problem || status !== 'UNDERWAY') return;
    if (!user) {
      setSubmissionError('Bạn cần đăng nhập để nộp bài');
      onOpenAuth();
      return;
    }
    setSubmissionError(null);
    setIsSubmitting(true);
    setSubmissionResult({ status: 'PENDING', passedCount: 0, totalCount: 0, timeMs: 0, memoryMb: 0, testcases: [] });

    const res = await createContestSubmission({ contest_id: id, problem_id: pid, language, code });
    if (!res.ok || !res.id) {
      setSubmissionError(res.error || 'Nộp bài thất bại');
      setSubmissionResult({ status: 'ERROR', passedCount: 0, totalCount: 0, timeMs: 0, memoryMb: 0, testcases: [] });
      setIsSubmitting(false);
      return;
    }

    const submissionId = res.id;
    let attempts = 0;
    const poll = async () => {
      const sub = await getSubmission(submissionId);
      if (sub && !['PENDING', 'JUDGING'].includes(sub.status)) {
        setSubmissionResult({
          status: sub.status,
          passedCount: (sub.details as any[])?.filter((d) => d.status === 'ACCEPTED').length || 0,
          totalCount: (sub.details as any[])?.length || 0,
          timeMs: sub.time_used_ms,
          memoryMb: sub.memory_used_mb,
          errorLog: sub.error_log,
          testcases: (sub.details as any[]).map((d, idx) => ({ id: idx + 1, status: d.status, timeMs: d.time_ms, memoryMb: d.memory_mb })),
        });
        setIsSubmitting(false);
        setMySubs(await getMyContestSubmissions(id!));
        return;
      }
      attempts++;
      if (attempts < 40) setTimeout(poll, 1500);
      else {
        setSubmissionResult({ status: 'PENDING', passedCount: 0, totalCount: 0, timeMs: 0, memoryMb: 0, testcases: [], note: 'Hệ thống đang xử lý bài nộp — bạn có thể xem lại kết quả trong lịch sử nộp bài' });
        setIsSubmitting(false);
      }
    };
    poll();
  };
  submitRef.current = handleSubmit;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-xs text-[var(--text-secondary)] font-bold bg-[var(--bg-primary)]">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải bài tập...
      </div>
    );
  }

  if (!contest || !problem) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)]">
        <p>Không tìm thấy bài tập trong kỳ thi</p>
        <Link to={id ? `/contests/${id}` : '/contests'} className="text-[var(--accent-text)] font-bold">← Về kỳ thi</Link>
      </div>
    );
  }

  const banner =
    status === 'NOT_STARTED'
      ? { cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400', icon: <Lock className="w-4 h-4" />, text: `Kỳ thi chưa bắt đầu — đề mở lúc ${new Date(contest.start_time).toLocaleString('vi-VN')}. Bạn có thể xem đề nhưng chưa nộp bài.` }
      : status === 'ENDED'
        ? { cls: 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]', icon: <Clock className="w-4 h-4" />, text: 'Kỳ thi đã kết thúc — không thể nộp bài thêm.' }
        : null;

  const statusBadge = (s: string) => {
    if (s === 'ACCEPTED') return <span className="font-bold text-[var(--accent-text)]">ACCEPTED</span>;
    if (s === 'COMPILE_ERROR' || s === 'RUNTIME_ERROR' || s === 'WRONG_ANSWER') return <span className="font-bold text-red-600 dark:text-red-400">{s}</span>;
    if (s === 'TIME_LIMIT_EXCEEDED') return <span className="font-bold text-amber-600 dark:text-amber-400">TLE</span>;
    if (s === 'MEMORY_LIMIT_EXCEEDED') return <span className="font-bold text-purple-600 dark:text-purple-400">MLE</span>;
    return <span className="font-bold text-blue-600 dark:text-blue-400">{s}</span>;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* TOP BAR */}
      <header className="h-12 shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border)] px-4 flex items-center justify-between text-xs shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/contests/${contest.id}`} className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] transition-colors cursor-pointer shrink-0" title="Về kỳ thi">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black shrink-0">CONTEST</span>
            <h1 className="font-extrabold text-[var(--text-primary)] text-sm truncate">{problem.title}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-code pl-3 border-l border-[var(--border)] shrink-0">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-sky-500" /> {problem.time_limit_ms / 1000}s</span>
            <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5 text-cyan-500" /> {problem.memory_limit_mb}MB</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center"
            title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
          >
            <MorphIcon
              icon={isDark ? SunData : MoonData}
              size={16}
              spring="snappy"
              className={isDark ? 'text-amber-400' : 'text-slate-600'}
            />
          </button>
          {user ? (
            <div className="flex items-center gap-1 text-[11px] font-bold font-code text-[var(--accent-text)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-1 rounded-md">
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> {user.rating} AC
              <span className="text-[var(--text-primary)] ml-1 hidden md:inline">{user.username}</span>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--text-primary)] font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer">Đăng Nhập</button>
          )}
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: description */}
        <div className="w-[42%] shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden">
          <div className="px-5 py-2.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">
            MÔ TẢ BÀI TOÁN
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            {banner && (
              <div className={`flex items-start gap-2 p-3 rounded-xl border font-semibold ${banner.cls}`}>
                {banner.icon} <span>{banner.text}</span>
              </div>
            )}
            <Markdown content={problem.description} />

            {problem.input_format && (
              <section>
                <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">Dữ liệu vào</h3>
                <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border)] font-code whitespace-pre-wrap">{problem.input_format}</div>
              </section>
            )}
            {problem.output_format && (
              <section>
                <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">Dữ liệu ra</h3>
                <div className="bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border)] font-code whitespace-pre-wrap">{problem.output_format}</div>
              </section>
            )}

            <section>
              <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">Ví dụ mẫu</h3>
              <div className="space-y-2">
                {samples.length === 0 && <div className="text-[var(--text-secondary)] p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">Bài chưa có testcase mẫu</div>}
                {samples.map((tc) => (
                  <div key={tc.id} className="bg-[var(--bg-secondary)] rounded-xl p-3 border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase">Test {tc.id}</span>
                      <button onClick={() => handleCopy(tc.input, tc.id)} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer">
                        <MorphIcon
                          icon={copiedId === tc.id ? CheckData : CopyData}
                          size={12}
                          spring="bouncy"
                          className={copiedId === tc.id ? 'text-[var(--accent-text)]' : ''}
                        />
                        {copiedId === tc.id ? 'Đã sao chép' : 'Input'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 font-code">
                      <div><span className="text-[10px] text-[var(--text-muted)] font-bold block mb-0.5">Input</span><div className="bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border)] font-bold whitespace-pre-wrap">{tc.input}</div></div>
                      <div><span className="text-[10px] text-[var(--text-muted)] font-bold block mb-0.5">Output</span><div className="bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border)] text-[var(--accent-text)] font-bold whitespace-pre-wrap">{tc.expected}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">Nộp bài của tôi</h3>
              {mySubs.length === 0 ? (
                <div className="text-[var(--text-secondary)] p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">Bạn chưa nộp bài cho câu này</div>
              ) : (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] font-code">
                    <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold">
                      <tr><th className="p-2.5">Kết quả</th><th className="p-2.5">Thời gian</th><th className="p-2.5">RAM</th><th className="p-2.5">Điểm</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {mySubs.slice(0, 15).map((s) => (
                        <tr key={s.id}>
                          <td className="p-2.5">{statusBadge(s.status)}</td>
                          <td className="p-2.5 text-[var(--text-secondary)]">{s.time_used_ms}ms</td>
                          <td className="p-2.5 text-[var(--text-secondary)]">{s.memory_used_mb}MB</td>
                          <td className="p-2.5 text-[var(--text-secondary)]">{s.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* RIGHT: editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-11 shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] px-4 flex items-center justify-between">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-[var(--bg-primary)] border border-[var(--border)] text-xs rounded-lg px-3 py-1 text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="cpp">C++ (GCC 12.2)</option>
              <option value="python">Python 3</option>
              <option value="rust">Rust</option>
            </select>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isSubmitting ? 'Đang chấm bài...' : 'Nộp bài'}
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-[var(--bg-editor)]">
            <DynamicMonacoEditor
              height="100%"
              language={language}
              theme={isDark ? 'vs-dark' : 'light'}
              value={code}
              onChange={(v) => setCode(v || '')}
              onMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => submitRef.current());
              }}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                smoothScrolling: true,
                mouseWheelZoom: true,
              }}
            />
          </div>

          {/* RESULT PANEL */}
          <div className="h-[200px] shrink-0 border-t border-[var(--border)] bg-[var(--bg-primary)] flex flex-col">
            <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider">
              KẾT QUẢ CHẤM BÀI
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
              {submissionError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-[11px]">⚠️ {submissionError}</div>
              )}
              {!submissionResult && !submissionError && (
                <div className="text-[var(--text-muted)] text-[11px] flex items-center gap-2">
                  <CircleDashed className="w-4 h-4" /> Nộp bài để xem kết quả chấm tự động.
                </div>
              )}
              {submissionResult && submissionResult.status !== 'ERROR' && (
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2.5 rounded-xl border font-bold ${
                    submissionResult.status === 'ACCEPTED' ? 'bg-emerald-500/10 border-emerald-500/30' : submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className={`flex items-center gap-2 ${submissionResult.status === 'ACCEPTED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      {submissionResult.status === 'ACCEPTED' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        : submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING' ? <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                        : <XCircle className="w-5 h-5 text-red-500" />}
                      <span>{submissionResult.status === 'PENDING' || submissionResult.status === 'JUDGING' ? 'Đang chấm bài...' : `Kết quả: ${submissionResult.status}`}</span>
                    </div>
                    <span className="px-3 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-code text-[11px] font-black">
                      {submissionResult.totalCount > 0 ? `${submissionResult.passedCount}/${submissionResult.totalCount} tests` : ''} ({submissionResult.timeMs}ms · {submissionResult.memoryMb}MB)
                    </span>
                  </div>
                  {submissionResult.note && <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-[11px]">{submissionResult.note}</div>}
                  {submissionResult.errorLog && <pre className="p-2.5 rounded-lg bg-[#1e1e1e] text-red-300 font-code text-[11px] overflow-x-auto">{submissionResult.errorLog}</pre>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-code text-[11px]">
                    {(submissionResult.testcases || []).map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                        <span className="font-bold text-[var(--text-primary)]">{t.name}</span>
                        <span className={`font-bold ${t.status === 'ACCEPTED' ? 'text-[var(--accent-text)]' : t.status === 'PENDING' || t.status === 'JUDGING' ? 'text-blue-600' : 'text-red-600'}`}>
                          {t.status === 'ACCEPTED' ? <><Check className="w-3.5 h-3.5" /> AC ({t.timeMs}ms)</> : t.status === 'PENDING' || t.status === 'JUDGING' ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang chấm...</> : <><XCircle className="w-3.5 h-3.5" /> {t.status}</>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}