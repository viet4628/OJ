import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../../components/MorphIcon';
import {
  Server as ServerData,
  FileCode as FileCodeData,
  Send as SendData,
  Users as UsersData,
  RefreshCw as RefreshCwData,
  Plus as PlusData,
  Trophy as TrophyData,
  Bell as BellData,
  GraduationCap as GraduationCapData,
  ArrowRight as ArrowRightData,
  Eye as EyeData,
  X as XData,
  Copy as CopyData,
  Check as CheckData,
} from 'lucide';
import VerdictBadge from '../../../components/VerdictBadge';
import {
  getStats,
  getJudgeServers,
  getSubmissions,
  getSubmission,
  type JudgeServer,
  type Submission,
} from '../../../lib/api';
import { useEscapeKey } from '../../../lib/useEscapeKey';

interface AdminOverviewTabProps {
  onNavigateTab?: (tab: 'overview' | 'problems' | 'contests' | 'announcements' | 'submissions' | 'users', mode?: 'list' | 'create') => void;
}

export default function AdminOverviewTab({ onNavigateTab }: AdminOverviewTabProps) {
  const [stats, setStats] = useState({ problems: 0, submissions: 0, profiles: 0 });
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<JudgeServer[]>([]);
  const [heartbeatError, setHeartbeatError] = useState('');
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  // Recent submissions
  const [recentSubs, setRecentSubs] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEscapeKey(selectedSub !== null, () => setSelectedSub(null));

  const refreshServers = () => {
    setRefreshing(true);
    return getJudgeServers()
      .then((rows) => {
        setServers(rows);
        setHeartbeatError('');
        setCheckedAt(Date.now());
      })
      .catch(() => {
        setHeartbeatError('Không tải được heartbeat. Kiểm tra schema và quyền DB.');
      })
      .finally(() => setRefreshing(false));
  };

  const loadRecentSubmissions = () => {
    setSubsLoading(true);
    getSubmissions({ pageSize: 6 })
      .then((res) => setRecentSubs(res.rows))
      .catch((err) => console.error('Failed to load recent submissions:', err))
      .finally(() => setSubsLoading(false));
  };

  useEffect(() => {
    let active = true;
    void refreshServers();
    loadRecentSubmissions();
    const timer = setInterval(() => {
      if (active) {
        void refreshServers();
        loadRecentSubmissions();
      }
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const openSubmission = async (sub: Submission) => {
    setSelectedSub(sub);
    setDetailLoading(true);
    try {
      const full = await getSubmission(sub.id);
      if (full) setSelectedSub(full);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Ngân hàng bài tập',
      value: stats.problems,
      icon: FileCodeData,
      sub: 'Đã xuất bản & riêng tư',
      action: () => onNavigateTab?.('problems'),
    },
    {
      label: 'Lượt nộp bài',
      value: stats.submissions,
      icon: SendData,
      sub: 'Tổng bài nộp hệ thống',
      action: () => onNavigateTab?.('submissions'),
    },
    {
      label: 'Tài khoản người dùng',
      value: stats.profiles,
      icon: UsersData,
      sub: 'Học sinh & giáo viên',
      action: () => onNavigateTab?.('users'),
    },
  ];

  const hasOnlineWorker = servers.some(
    (s) => s.ready && checkedAt - new Date(s.last_seen_at).getTime() < 30000
  );

  return (
    <div className="space-y-4">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Tổng Quan Hệ Thống</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Thống kê tài nguyên, tình trạng máy chấm và hoạt động thời gian thực.
          </p>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onNavigateTab?.('problems', 'create')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={13} />
            <span>Soạn Đề Mới</span>
          </button>

          <button
            onClick={() => onNavigateTab?.('contests')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={TrophyData} size={13} />
            <span>Tạo Kỳ Thi</span>
          </button>

          <button
            onClick={() => onNavigateTab?.('announcements')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={BellData} size={13} />
            <span>Đăng Thông Báo</span>
          </button>

          <Link
            to="/teacher"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--accent-text)] text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={GraduationCapData} size={13} />
            <span>Cổng Giáo Viên</span>
          </Link>

          <button
            onClick={() => {
              void refreshServers();
              loadRecentSubmissions();
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới tình trạng hệ thống"
          >
            <MorphIcon icon={RefreshCwData} size={12} className={refreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={s.action}
            className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] shadow-xs hover:border-[var(--text-muted)] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <dt className="text-xs font-medium group-hover:text-[var(--accent-text)] transition-colors">
                {s.label}
              </dt>
              <div className="w-7 h-7 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                <MorphIcon icon={s.icon} size={14} />
              </div>
            </div>
            <dd className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {loading ? '—' : s.value.toLocaleString('vi-VN')}
            </dd>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{s.sub}</p>
          </div>
        ))}
      </dl>

      {/* Two-Column Grid: Judge Workers on Left, Live Submissions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Judge Workers Status (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <MorphIcon icon={ServerData} size={16} className="text-[var(--text-secondary)]" />
              <div>
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">Cụm Máy Chấm (Judge Workers)</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">Tình trạng kết nối và hàng đợi hiện tại</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                hasOnlineWorker
                  ? 'bg-accent/10 text-[var(--accent-text)] border-accent/25'
                  : 'bg-danger/10 text-[var(--danger)] border-danger/25'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasOnlineWorker ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--danger)]'
                }`}
              />
              {hasOnlineWorker ? 'Trực tuyến' : 'Mất kết nối'}
            </span>
          </div>

          {heartbeatError && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)]">
              {heartbeatError}
            </div>
          )}

          {!heartbeatError && servers.length === 0 && (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              Chưa nhận heartbeat từ worker daemon nào. Khởi chạy <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono">apps/judge-worker</code>.
            </div>
          )}

          {servers.map((server) => {
            const online = server.ready && checkedAt - new Date(server.last_seen_at).getTime() < 30000;
            return (
              <div
                key={server.id}
                className="p-3 border border-[var(--border)] rounded-md bg-[var(--bg-primary)] space-y-2 hover:border-[var(--text-muted)] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{server.id}</span>
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-full font-mono border ${
                        online
                          ? 'bg-accent/10 text-[var(--accent-text)] border-accent/30'
                          : 'bg-danger/10 text-[var(--danger)] border-danger/30'
                      }`}
                    >
                      {online ? 'Sẵn sàng' : 'Mất kết nối'}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    Heartbeat: {new Date(server.last_seen_at).toLocaleTimeString('vi-VN')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[10px]">
                    Mode: {server.mode}
                  </span>
                  <span>
                    Hàng đợi: <strong className="text-[var(--text-primary)]">{server.queued}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Đang chấm: <strong className="text-[var(--text-primary)]">{server.processing}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Recent Submissions Monitor (6 cols) */}
        <div className="lg:col-span-6 bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <MorphIcon icon={SendData} size={16} className="text-[var(--accent-text)]" />
              <div>
                <h2 className="text-xs font-semibold text-[var(--text-primary)]">Bài Nộp Mới Nhất</h2>
                <p className="text-[11px] text-[var(--text-secondary)]">Hoạt động nộp bài và kết quả chấm hệ thống</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.('submissions')}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline font-medium cursor-pointer"
            >
              <span>Xem tất cả</span>
              <MorphIcon icon={ArrowRightData} size={12} />
            </button>
          </div>

          {subsLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-11 rounded bg-[var(--bg-primary)] animate-pulse" />
              ))}
            </div>
          ) : recentSubs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
              Chưa có lượt nộp bài nào trên hệ thống.
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentSubs.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => openSubmission(sub)}
                  className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 font-sans">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {sub.problems?.title || 'Bài tập'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                      <span>{sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}</span>
                      <span>·</span>
                      <span className="font-mono uppercase text-[10px]">{sub.language}</span>
                      {typeof sub.time_used_ms === 'number' && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[10px]">{sub.time_used_ms} ms</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <VerdictBadge status={sub.status} />
                    <button
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Xem bài làm"
                    >
                      <MorphIcon icon={EyeData} size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Code Inspector Modal */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedSub(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết bài nộp"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2.5">
                <VerdictBadge status={selectedSub.status} long />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedSub.problems?.title || 'Bài tập'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    Người nộp: {selectedSub.profiles?.full_name || selectedSub.profiles?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <MorphIcon icon={XData} size={15} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Ngôn ngữ</div>
                  <div className="font-semibold text-[var(--text-primary)] uppercase mt-0.5">{selectedSub.language}</div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Thời gian</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSub.time_used_ms === 'number' ? `${selectedSub.time_used_ms} ms` : '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Bộ nhớ</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSub.memory_used_mb === 'number' ? `${selectedSub.memory_used_mb} MB` : '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Mã nguồn bài nộp</span>
                  <button
                    onClick={() => {
                      if (!selectedSub.code) return;
                      navigator.clipboard.writeText(selectedSub.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    <MorphIcon icon={copiedCode ? CheckData : CopyData} size={11} />
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>

                {detailLoading ? (
                  <div className="h-40 rounded bg-[var(--bg-primary)] border border-[var(--border)] animate-pulse" />
                ) : (
                  <pre className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto max-h-72 leading-relaxed">
                    <code>{selectedSub.code || '// Không tìm thấy nội dung mã nguồn'}</code>
                  </pre>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border)] flex justify-end bg-surface/50">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
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
