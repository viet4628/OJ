import { useEffect, useState } from 'react';
import { getStats } from '../../../lib/api';

export default function AdminOverviewTab() {
  const [stats, setStats] = useState({ problems: 0, submissions: 0, profiles: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Tổng Số Bài Tập', value: loading ? '—' : stats.problems, note: 'Công khai', color: 'text-[var(--accent-text)]' },
    { label: 'Lượt Chấm Bài', value: loading ? '—' : stats.submissions, note: 'Tổng submissions', color: 'text-sky-700' },
    { label: 'Tài Khoản Người Dùng', value: loading ? '—' : stats.profiles, note: 'Profiles', color: 'text-[var(--accent-text)]' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statCards.map((s) => (
        <div key={s.label} className="bg-white p-4 rounded-xl space-y-1.5 border border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)] font-semibold">{s.label}</span>
          <div className="text-2xl font-black text-[var(--text-primary)]">{s.value}</div>
          <span className={`text-[11px] font-bold ${s.color}`}>{s.note}</span>
        </div>
      ))}
    </div>
  );
}

