import { useEffect, useState } from 'react';
import { getStats, getJudgeServers, type JudgeServer } from '../../../lib/api';

export default function AdminOverviewTab() {
  const [stats, setStats] = useState({ problems: 0, submissions: 0, profiles: 0 });
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<JudgeServer[]>([]);
  const [heartbeatError, setHeartbeatError] = useState('');
  const [checkedAt, setCheckedAt] = useState(Date.now());

  useEffect(() => {
    let active = true;
    const refresh = () => getJudgeServers().then((rows) => {
      if (active) { setServers(rows); setHeartbeatError(''); setCheckedAt(Date.now()); }
    }).catch(() => { if (active) setHeartbeatError('Không tải được heartbeat. Kiểm tra schema và quyền DB.'); });
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Bài tập', value: stats.problems },
    { label: 'Bài nộp', value: stats.submissions },
    { label: 'Tài khoản', value: stats.profiles },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Tổng quan</h1>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map(s => <div key={s.label} className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)]">
          <dt className="text-xs text-[var(--text-secondary)]">{s.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{loading ? '—' : s.value}</dd>
        </div>)}
      </dl>
      {/* System Services Status */}
      <div className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] space-y-3">
        <div className="pb-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">Máy chấm bài</h3>
          <p className="text-[11px] text-[var(--text-secondary)]">Tình trạng kết nối và hàng đợi hiện tại</p>
        </div>

        {heartbeatError && <p className="text-xs text-[var(--danger)]">{heartbeatError}</p>}
        {!heartbeatError && servers.length === 0 && <p className="text-xs text-[var(--text-secondary)]">Chưa nhận heartbeat từ worker.</p>}
        {servers.map((server) => {
          const online = server.ready && checkedAt - new Date(server.last_seen_at).getTime() < 30000;
          return (
            <div key={server.id} className="text-xs p-3 border border-[var(--border)] rounded-md space-y-1">
              <p className="font-medium">{server.id}: {online ? 'Đang hoạt động' : 'Không sẵn sàng hoặc mất heartbeat'}</p>
              <p className="text-[var(--text-secondary)]">{server.mode} · Chờ: {server.queued} · Đang chấm: {server.processing}</p>
              <p className="text-[var(--text-muted)]">Heartbeat: {new Date(server.last_seen_at).toLocaleString('vi-VN')}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
