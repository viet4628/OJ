import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  Code2 as Code2Data,
  Send as SendData,
  Users as UsersData,
  Plus as PlusData,
  Trophy as TrophyData,
  UserCheck as UserCheckData,
  Megaphone as MegaphoneData,
  Settings as SettingsData,
  Server as ServerData,
  Database as DatabaseData,
  ShieldCheck as ShieldCheckData,
  Cpu as CpuData,
  ArrowRight as ArrowRightData,
} from 'lucide';
import { getStats } from '../../../lib/api';

interface AdminOverviewTabProps {
  onNavigateTab?: (tab: 'problems' | 'contests' | 'users' | 'announcements' | 'settings', mode?: 'list' | 'create') => void;
}

export default function AdminOverviewTab({ onNavigateTab }: AdminOverviewTabProps) {
  const [stats, setStats] = useState({ problems: 0, submissions: 0, profiles: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: 'Tổng Số Bài Tập',
      value: loading ? '—' : stats.problems,
      note: 'Ngân hàng bài tập',
      icon: Code2Data,
      tab: 'problems' as const,
    },
    {
      label: 'Lượt Chấm Bài',
      value: loading ? '—' : stats.submissions,
      note: 'Tổng bài nộp hệ thống',
      icon: SendData,
      tab: null,
    },
    {
      label: 'Tài Khoản Người Dùng',
      value: loading ? '—' : stats.profiles,
      note: 'Học sinh & Giáo viên',
      icon: UsersData,
      tab: 'users' as const,
    },
  ];

  const quickActions = [
    {
      title: 'Soạn Bài Tập Mới',
      desc: 'Thêm bài lập trình, đặt time limit & testcases',
      icon: PlusData,
      onClick: () => onNavigateTab?.('problems', 'create'),
    },
    {
      title: 'Tạo Kỳ Thi Trực Tuyến',
      desc: 'Tổ chức kỳ thi mới (thể thức ACM hoặc OI)',
      icon: TrophyData,
      onClick: () => onNavigateTab?.('contests'),
    },
    {
      title: 'Quản Lý & Phân Quyền',
      desc: 'Nâng quyền Giáo viên và cấp quyền RBAC',
      icon: UserCheckData,
      onClick: () => onNavigateTab?.('users'),
    },
    {
      title: 'Đăng Thông Báo',
      desc: 'Phát thông báo hệ thống và tin tức quan trọng',
      icon: MegaphoneData,
      onClick: () => onNavigateTab?.('announcements'),
    },
  ];

  const systemServices = [
    {
      name: 'Judging Worker Daemon',
      spec: 'Node.js 22 + CasesProvider gRPC (:50052)',
      status: 'Sẵn sàng chấm',
      icon: CpuData,
    },
    {
      name: 'Sandboxing Engine',
      spec: 'Rust rsjudge / Bubblewrap (cgroups & rlimits)',
      status: 'Cách ly an toàn',
      icon: ServerData,
    },
    {
      name: 'Cơ Sở Dữ Liệu PostgreSQL',
      spec: 'PostgreSQL 15 + RLS Security Definer',
      status: 'RBAC Active',
      icon: DatabaseData,
    },
    {
      name: 'Bộ Lưu Trữ Testcases Ẩn',
      spec: 'Supabase Private Storage Bucket',
      status: 'Bảo mật tuyệt đối',
      icon: ShieldCheckData,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 3 Main Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={() => s.tab && onNavigateTab?.(s.tab)}
            className={`bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] flex items-center justify-between gap-3 transition-colors ${
              s.tab ? 'hover:border-[var(--text-muted)] cursor-pointer group' : ''
            }`}
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs text-[var(--text-secondary)] font-medium">{s.label}</span>
              <div className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                {s.value}
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-mono text-[var(--text-muted)]">{s.note}</span>
                {s.tab && (
                  <MorphIcon icon={ArrowRightData} size={11} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
            <div className="w-9 h-9 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--accent-text)]">
              <MorphIcon icon={s.icon} size={16} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Shortcuts */}
      <div className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div className="space-y-0.5">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Lối Tắt Thao Tác Nhanh</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">Các tác vụ điều hành thường dùng dành cho Quản trị viên</p>
          </div>
          <button
            onClick={() => onNavigateTab?.('settings')}
            className="text-xs font-medium text-[var(--accent-text)] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <MorphIcon icon={SettingsData} size={12} /> Cấu hình hệ thống
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {quickActions.map((qa) => (
            <button
              key={qa.title}
              onClick={qa.onClick}
              className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] text-left transition-colors group cursor-pointer flex flex-col justify-between h-full space-y-2"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                  <MorphIcon icon={qa.icon} size={14} />
                </div>
                <MorphIcon icon={ArrowRightData} size={12} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">{qa.title}</h4>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{qa.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* System Services Status */}
      <div className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] space-y-3">
        <div className="pb-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">Trạng Thái Dịch Vụ Cốt Lõi</h3>
          <p className="text-[11px] text-[var(--text-secondary)]">Kiểm tra kết nối và tính sẵn sàng của kiến trúc chấm thi</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {systemServices.map((srv) => (
            <div
              key={srv.name}
              className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--accent-text)]">
                  <MorphIcon icon={srv.icon} size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{srv.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{srv.spec}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.2 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-text)] text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <span>{srv.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
