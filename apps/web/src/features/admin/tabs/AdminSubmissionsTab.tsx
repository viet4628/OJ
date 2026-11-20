import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../../components/MorphIcon';
import {
  RefreshCw as RefreshCwData,
  Eye as EyeData,
  X as XData,
  Copy as CopyData,
  Check as CheckData,
  ChevronLeft as ChevronLeftData,
  ChevronRight as ChevronRightData,
  Search as SearchData,
  RotateCcw as RotateCcwData,
} from 'lucide';
import VerdictBadge from '../../../components/VerdictBadge';
import {
  getSubmissions,
  getSubmission,
  rejudgeSubmission,
  supabase,
  type Submission,
} from '../../../lib/api';
import { useEscapeKey } from '../../../lib/useEscapeKey';

const PAGE_SIZE = 25;

interface AdminSubmissionsTabProps {
  canRejudge?: boolean;
}

export default function AdminSubmissionsTab({ canRejudge = true }: AdminSubmissionsTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [langFilter, setLangFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejudging, setRejudging] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEscapeKey(selectedSubmission !== null, () => setSelectedSubmission(null));

  const loadSubmissions = async (opts?: { status?: string; page?: number }) => {
    setIsRefreshing(true);
    try {
      const res = await getSubmissions({
        status: opts?.status ?? statusFilter,
        page: opts?.page ?? page,
        pageSize: PAGE_SIZE,
      });
      setSubmissions(res.rows);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSubmissions({ status: statusFilter, page });
  }, [statusFilter, page]);

  // Auto-refresh timer every 10 seconds if autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadSubmissions({ status: statusFilter, page });
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter, page]);

  // Realtime subscription for incoming submissions
  useEffect(() => {
    const channel = supabase
      .channel('admin:submissions_monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => {
          if (payload.new.is_run) return;
          if (page === 0) {
            loadSubmissions({ status: statusFilter, page: 0 });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [page, statusFilter]);

  const openSubmission = async (sub: Submission) => {
    setSelectedSubmission(sub);
    setDetailLoading(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const full = await getSubmission(sub.id);
      if (full) setSelectedSubmission(full);
    } catch (err) {
      console.error('Failed to load full submission details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRejudge = async () => {
    if (!selectedSubmission || rejudging) return;
    if (!window.confirm('Chấm lại bài nộp này? Trạng thái sẽ chuyển về PENDING và chấm lại với bộ test hiện tại.')) return;
    setRejudging(true);
    setActionError(null);
    try {
      await rejudgeSubmission(selectedSubmission.id);
      setActionNotice('Đã đưa bài nộp vào hàng đợi chấm lại thành công.');
      await loadSubmissions({ status: statusFilter, page });
      const updated = await getSubmission(selectedSubmission.id);
      if (updated) setSelectedSubmission(updated);
    } catch (err: any) {
      setActionError(err.message || 'Chấm lại thất bại');
    } finally {
      setRejudging(false);
    }
  };

  const handleCopyCode = () => {
    if (!selectedSubmission?.code) return;
    navigator.clipboard.writeText(selectedSubmission.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredSubmissions = submissions.filter((s) => {
    if (langFilter !== 'ALL' && s.language !== langFilter) return false;
    if (!query) return true;
    const author = (s.profiles?.full_name || s.profiles?.email || '').toLowerCase();
    const prob = (s.problems?.title || '').toLowerCase();
    const id = s.id.toLowerCase();
    return author.includes(query) || prob.includes(query) || id.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-4 shadow-xs">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Giám Sát & Nhật Ký Bài Nộp
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Theo dõi tiến trình chấm thời gian thực, kiểm tra mã nguồn và kích hoạt chấm lại.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
            />
            <span>Tự động làm mới</span>
          </label>

          <button
            onClick={() => loadSubmissions()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <MorphIcon icon={RefreshCwData} size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <MorphIcon icon={SearchData} size={13} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo học sinh, bài tập hoặc mã..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACCEPTED">ACCEPTED (AC)</option>
            <option value="WRONG_ANSWER">WRONG_ANSWER (WA)</option>
            <option value="TIME_LIMIT_EXCEEDED">TIME_LIMIT_EXCEEDED (TLE)</option>
            <option value="MEMORY_LIMIT_EXCEEDED">MEMORY_LIMIT_EXCEEDED (MLE)</option>
            <option value="COMPILE_ERROR">COMPILE_ERROR (CE)</option>
            <option value="RUNTIME_ERROR">RUNTIME_ERROR (RE)</option>
            <option value="PENDING">PENDING (Chờ chấm)</option>
            <option value="JUDGING">JUDGING (Đang chấm)</option>
          </select>

          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Tất cả ngôn ngữ</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
            <option value="java">Java</option>
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-[var(--bg-primary)] animate-pulse" />
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="py-12 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
          Không tìm thấy bài nộp nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
              <tr>
                <th className="px-3 py-2">Thời Gian</th>
                <th className="px-3 py-2">Mã Nộp</th>
                <th className="px-3 py-2">Bài Tập</th>
                <th className="px-3 py-2">Học Sinh</th>
                <th className="px-3 py-2">Ngôn Ngữ</th>
                <th className="px-3 py-2">Trạng Thái</th>
                <th className="px-3 py-2">Thời Gian</th>
                <th className="px-3 py-2">Bộ Nhớ</th>
                <th className="px-3 py-2 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap text-[11px]">
                    {formatTime(sub.created_at)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)] text-[11px]">
                    {sub.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 font-sans font-medium text-[var(--text-primary)]">
                    <Link
                      to={`/problems/${sub.problems?.slug || ''}`}
                      className="hover:text-[var(--accent-text)] transition-colors truncate block max-w-[200px]"
                      title={sub.problems?.title}
                    >
                      {sub.problems?.title || 'Bài tập'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-sans text-[var(--text-secondary)]">
                    <span className="truncate block max-w-[140px]" title={sub.profiles?.email}>
                      {sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[10px] uppercase text-[var(--text-secondary)]">
                      {sub.language}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-sans">
                    <VerdictBadge status={sub.status} long />
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)] text-[11px]">
                    {typeof sub.time_used_ms === 'number' ? `${sub.time_used_ms} ms` : '—'}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)] text-[11px]">
                    {typeof sub.memory_used_mb === 'number' ? `${sub.memory_used_mb} MB` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-sans">
                    <button
                      onClick={() => openSubmission(sub)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs"
                      title="Xem chi tiết mã nguồn"
                    >
                      <MorphIcon icon={EyeData} size={13} />
                      <span className="hidden sm:inline">Chi tiết</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredSubmissions.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <span>
            Tổng {total.toLocaleString('vi-VN')} bài nộp · Trang {page + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isRefreshing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MorphIcon icon={ChevronLeftData} size={13} /> Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isRefreshing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sau <MorphIcon icon={ChevronRightData} size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Code & Verdict Details Modal */}
      {selectedSubmission && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết bài nộp"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2.5">
                <VerdictBadge status={selectedSubmission.status} long />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Bài nộp #{selectedSubmission.id.slice(0, 12)}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    {selectedSubmission.problems?.title || 'Bài tập'} · {selectedSubmission.profiles?.full_name || selectedSubmission.profiles?.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canRejudge && (
                  <button
                    onClick={handleRejudge}
                    disabled={rejudging || ['PENDING', 'JUDGING'].includes(selectedSubmission.status)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                    title="Chấm lại bài nộp này"
                  >
                    <MorphIcon icon={RotateCcwData} size={12} className={rejudging ? 'animate-spin' : ''} />
                    <span>{rejudging ? 'Đang chấm...' : 'Chấm lại'}</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                >
                  <MorphIcon icon={XData} size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto space-y-4">
              {actionNotice && (
                <div className="p-2.5 rounded-md bg-accent/10 border border-accent/25 text-xs text-[var(--accent-text)] font-medium">
                  {actionNotice}
                </div>
              )}
              {actionError && (
                <div className="p-2.5 rounded-md bg-danger/10 border border-danger/25 text-xs text-[var(--danger)] font-medium">
                  {actionError}
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Ngôn ngữ</div>
                  <div className="font-semibold text-[var(--text-primary)] uppercase mt-0.5">{selectedSubmission.language}</div>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Thời gian chạy</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSubmission.time_used_ms === 'number' ? `${selectedSubmission.time_used_ms} ms` : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Bộ nhớ sử dụng</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSubmission.memory_used_mb === 'number' ? `${selectedSubmission.memory_used_mb} MB` : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Thời điểm nộp</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5 text-[11px]">
                    {formatTime(selectedSubmission.created_at)}
                  </div>
                </div>
              </div>

              {/* Source Code Inspector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Mã Nguồn Đã Nộp</span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    <MorphIcon icon={copiedCode ? CheckData : CopyData} size={12} />
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>

                {detailLoading ? (
                  <div className="h-48 rounded bg-[var(--bg-primary)] border border-[var(--border)] animate-pulse" />
                ) : (
                  <pre className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto max-h-80 leading-relaxed">
                    <code>{selectedSubmission.code || '// Không tìm thấy nội dung mã nguồn'}</code>
                  </pre>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[var(--border)] flex justify-end bg-surface/50">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
