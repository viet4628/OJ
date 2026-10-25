import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Eye, X, Code, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getSubmissions, getSubmission, getUserPermissions, rejudgeSubmission, supabase, type Submission, type AppUser } from '../../lib/api';

const PAGE_SIZE = 25;

export default function Submissions({ user }: { user: AppUser | null }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [mineOnly, setMineOnly] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [canRejudge, setCanRejudge] = useState(false);
  const [managedContestId, setManagedContestId] = useState<string | null>(null);
  const canManageSelectedContest = !selectedSubmission?.contest_id || user?.role === 'admin' || managedContestId === selectedSubmission.contest_id;
  const [rejudging, setRejudging] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCanRejudge(user?.role === 'admin');
    if (user && user.role !== 'admin') getUserPermissions(user.id).then(perms => {
      if (!cancelled) setCanRejudge(perms.includes('submissions.view_all') && (perms.includes('problems.manage') || perms.includes('contests.manage')));
    });
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);
  useEffect(() => {
    let cancelled = false;
    setManagedContestId(null);
    const contestId = selectedSubmission?.contest_id;
    if (contestId && user?.role !== 'admin') {
      supabase.rpc('can_manage_contest', { p_contest_id: contestId })
        .then(({ data, error }) => { if (!cancelled) setManagedContestId(!error && data === true ? contestId : null); });
    }
    return () => { cancelled = true; };
  }, [selectedSubmission?.id, user?.id, user?.role]);
  const handleRejudge = async () => {
    if (!selectedSubmission || !canRejudge || !canManageSelectedContest || rejudging || !window.confirm('Chấm lại bài này theo bộ testcase hiện tại? Kết quả và xếp hạng sẽ được cập nhật.')) return;
    setRejudging(true);
    setActionError(null);
    try {
      await rejudgeSubmission(selectedSubmission.id);
      setSelectedSubmission(null);
      setActionNotice('Đã đưa bài nộp vào hàng đợi chấm lại.');
      await loadSubmissions({ status: statusFilter, mine: mineOnly, page });
    } catch (err: any) { setActionError(err.message || 'Chấm lại thất bại'); }
    finally { setRejudging(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadSubmissions = async (opts?: { status?: string; mine?: boolean; page?: number }) => {
    setLoadError(false);
    try {
      const res = await getSubmissions({
        status: opts?.status,
        mine: opts?.mine,
        page: opts?.page ?? 0,
        pageSize: PAGE_SIZE,
      });
      setSubmissions(res.rows);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  useEffect(() => {
    if (!selectedSubmission) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSubmission(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSubmission]);

  useEffect(() => {
    const subscription = supabase
      .channel('public:submissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        async (payload) => {
          if (payload.new.is_run) return;
          if (page !== 0) return;
          if (mineOnly) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || payload.new.user_id !== user.id) return;
          }
          if (statusFilter !== 'ALL' && payload.new.status !== statusFilter) return;
          const { data } = await supabase
            .from('submissions')
            .select('*, problems(title, slug), profiles:profiles_public(full_name, email)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setSubmissions((prev) => [data as Submission, ...prev].slice(0, PAGE_SIZE));
            setTotal((t) => t + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [mineOnly, page, statusFilter]);

  const filteredSubmissions = submissions.filter((s) => {
    const matchesLang = langFilter === 'ALL' || s.language === langFilter;
    return matchesLang;
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSubmissions({ status: statusFilter, mine: mineOnly, page }).finally(() => setIsRefreshing(false));
  };

  const handleMineToggle = () => {
    const next = !mineOnly;
    setMineOnly(next);
    setPage(0);
    setIsLoading(true);
    loadSubmissions({ status: statusFilter, mine: next, page: 0 });
  };

  const handleStatusChange = (next: string) => {
    setStatusFilter(next);
    setPage(0);
    setIsLoading(true);
    loadSubmissions({ status: next, mine: mineOnly, page: 0 });
  };

  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, p));
    setPage(clamped);
    setIsLoading(true);
    loadSubmissions({ status: statusFilter, mine: mineOnly, page: clamped });
  };

  const openSubmission = async (sub: Submission) => {
    const full = await getSubmission(sub.id);
    if (full) setSelectedSubmission(full);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusBadge = (status: string) => {
    if (status === 'ACCEPTED') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
         ACCEPTED
      </span>;
    }
    if (status === 'WRONG_ANSWER') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-red-50 text-red-700 border border-red-200">
         WRONG ANSWER
      </span>;
    }
    if (status === 'TIME_LIMIT_EXCEEDED') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
         TLE
      </span>;
    }
    if (status === 'COMPILE_ERROR') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-red-50 text-red-700 border border-red-200">
         COMPILE ERROR
      </span>;
    }
    if (status === 'RUNTIME_ERROR') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
         RUNTIME ERROR
      </span>;
    }
    if (status === 'MEMORY_LIMIT_EXCEEDED') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
         MLE
      </span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {status === 'JUDGING' ? 'ĐANG CHẤM' : 'ĐANG CHỜ'}
    </span>;
  };

  return (
    <div className="space-y-5">
      {actionNotice && <p role="status" className="text-xs text-[var(--accent-text)]">{actionNotice}</p>}
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
             Nhật Ký Nộp Bài Realtime (Submissions)
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">Theo dõi thời gian thực các bài nộp từ toàn bộ thí sinh trên hệ thống</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold font-code">
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} /> Realtime Active
          </div>

          {/* Mine / All Toggle */}
          <div
            className={`flex items-center rounded-lg border font-bold text-[10px] overflow-hidden cursor-pointer transition-colors ${
              mineOnly
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-text)]'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)]'
            }`}
            onClick={handleMineToggle}
            title="Chỉ hiển thị bài nộp của tôi"
            role="switch"
            aria-checked={mineOnly}
          >
            <span className="px-2.5 py-1.5">CỦA TÔI</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="WRONG_ANSWER">WRONG_ANSWER</option>
            <option value="TIME_LIMIT_EXCEEDED">TIME_LIMIT_EXCEEDED</option>
            <option value="COMPILE_ERROR">COMPILE_ERROR</option>
            <option value="RUNTIME_ERROR">RUNTIME_ERROR</option>
          </select>

          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Ngôn ngữ</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
          </select>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-all shadow-sm cursor-pointer"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-[var(--bg-primary)] rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-secondary)] font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải danh sách bài nộp...
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-xs text-red-600 font-semibold">
            Không thể tải danh sách bài nộp. Vui lòng thử lại.
            <button onClick={handleRefresh} className="block mx-auto mt-3 px-4 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer">
              Tải lại
            </button>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
            {mineOnly ? 'Bạn chưa có bài nộp nào trên hệ thống.' : 'Chưa có bài nộp nào. Hãy là người đầu tiên nộp bài!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Giờ Nộp (When)</th>
                  <th className="px-5 py-3.5">Mã Nộp</th>
                  <th className="px-5 py-3.5">Tên Bài Tập</th>
                  <th className="px-5 py-3.5">Tác Giả</th>
                  <th className="px-5 py-3.5">Ngôn Ngữ</th>
                  <th className="px-5 py-3.5">Kết Quả Chấm</th>
                  <th className="px-5 py-3.5">Thời Gian</th>
                  <th className="px-5 py-3.5">Bộ Nhớ</th>
                  <th className="px-5 py-3.5 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-code">
                {filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[var(--bg-secondary)]/80 transition-colors">
                    <td className="px-5 py-4 text-[var(--text-secondary)] font-code whitespace-nowrap">{formatTime(sub.created_at)}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] font-bold">{sub.id.slice(0, 12)}</td>
                    <td className="px-5 py-4 font-bold text-[var(--text-primary)] font-sans text-xs">
                      <Link
                        to={`/problems/${sub.problems?.slug}?sub=${sub.id}`}
                        state={{ code: sub.code, language: sub.language, submissionId: sub.id }}
                        className="hover:text-[var(--accent-text)] transition-colors"
                      >
                        {sub.problems?.title || 'Bài tập'}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-sans text-[var(--accent-text)] font-bold">
                      {sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] uppercase font-bold text-[10px] border border-[var(--border)]">
                        {sub.language}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-sans font-bold">{statusBadge(sub.status)}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{sub.time_used_ms} ms</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{sub.memory_used_mb} MB</td>
                    <td className="px-5 py-4 text-right font-sans">
                      <button
                        onClick={() => openSubmission(sub)}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer"
                        title="Xem mã nguồn & thông số"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !loadError && filteredSubmissions.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
            <span className="font-code">
              Tổng {total.toLocaleString('vi-VN')} bài nộp · Trang {page + 1}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0 || isRefreshing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1 || isRefreshing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sau <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QingdaoU Style Submission Code Inspector Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedSubmission(null)}>
          <div role="dialog" aria-modal="true" aria-label="Chi tiết bài nộp" className="bg-[var(--bg-primary)] rounded-2xl max-w-2xl w-full p-6 border border-[var(--border)] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            {actionError && <p role="alert" className="text-xs text-[var(--danger)]">{actionError}</p>}
            {canRejudge && canManageSelectedContest && <button onClick={handleRejudge} disabled={rejudging || ['PENDING','JUDGING'].includes(selectedSubmission.status)} className="text-xs border border-[var(--border)] rounded px-3 py-1.5 disabled:opacity-50">{rejudging ? 'Đang yêu cầu...' : 'Chấm lại'}</button>}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--text-primary)]">Chi Tiết Bài Nộp #{selectedSubmission.id.slice(0, 12)}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{selectedSubmission.problems?.title} • {selectedSubmission.profiles?.full_name || selectedSubmission.profiles?.email?.split('@')[0]}</p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-code">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block font-sans">Kết quả</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedSubmission.status}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block font-sans">Thời gian chạy</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedSubmission.time_used_ms} ms</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] block font-sans">Bộ nhớ dùng</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedSubmission.memory_used_mb} MB</span>
              </div>
            </div>

            {selectedSubmission.error_log && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-code">
                <span className="font-bold block mb-1">Error Log:</span>
                <pre className="whitespace-pre-wrap">{selectedSubmission.error_log}</pre>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                 Mã nguồn đã nộp ({selectedSubmission.language}):
              </label>
              <pre className="bg-[var(--bg-editor)] text-[var(--text-primary)] p-4 rounded-xl font-code text-xs overflow-x-auto overflow-y-auto max-h-64 border border-[var(--border)]">
                {selectedSubmission.code || '// Không có mã nguồn'}
              </pre>
            </div>

            {selectedSubmission.problems?.slug && (
              <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]">
                <Link
                  to={`/problems/${selectedSubmission.problems.slug}?sub=${selectedSubmission.id}`}
                  state={{
                    code: selectedSubmission.code,
                    language: selectedSubmission.language,
                    submissionId: selectedSubmission.id,
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Mở bài làm trong Editor</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
