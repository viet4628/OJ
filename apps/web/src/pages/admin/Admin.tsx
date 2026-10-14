import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  LayoutDashboard,
  Settings,
  LogOut,
  Trophy,
  ListTree,
  UserRound,
  Lock,
  Megaphone,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminOverviewTab from './tabs/AdminOverviewTab';
import AdminUsersTab from './tabs/AdminUsersTab';
import AdminProblemsTab from './tabs/AdminProblemsTab';
import AdminContestsTab from './tabs/AdminContestsTab';
import AdminAnnouncementsTab from './tabs/AdminAnnouncementsTab';
import AdminSettingsTab from './tabs/AdminSettingsTab';

type TabName = 'overview' | 'problems' | 'create' | 'users' | 'contests' | 'announcements' | 'settings';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [problemMode, setProblemMode] = useState<'list' | 'create'>('list');

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMyUserId(user?.id || null);
      if (!user) {
        setAuthChecked(true);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
      setAuthChecked(true);
    })();
  }, []);

  const handleTabChange = (tab: TabName) => {
    if (tab === 'create') {
      setProblemMode('create');
      setActiveTab('problems');
    } else if (tab === 'problems') {
      setProblemMode('list');
      setActiveTab('problems');
    } else {
      setActiveTab(tab);
    }
  };

  const menuBtn = (tab: TabName, icon: React.ReactNode, text: string, isSpecialActive = false) => {
    const isActive = isSpecialActive || (activeTab === tab && (tab !== 'problems' || problemMode === 'list'));
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
          isActive
            ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] font-bold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
        }`}
      >
        {icon} {text}
      </button>
    );
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[var(--text-secondary)]">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white border border-[var(--border)] rounded-2xl p-6 text-center space-y-3 shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[var(--danger)]" />
        </div>
        <h1 className="text-base font-black text-[var(--text-primary)]">Không Có Quyền Truy Cập</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Trang quản trị chỉ dành cho tài khoản có vai trò <b className="text-[var(--text-primary)]">admin</b>.
        </p>
        <div className="pt-2">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--text-primary)] text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Về Trang Chủ Học Sinh
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-6">
      {/* LEFT: Vertical SideMenu */}
      <aside className="w-52 shrink-0 sticky top-20 rounded-2xl bg-white border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="py-5 text-center border-b border-[var(--border)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-[var(--accent-text)]" />
          </div>
          <p className="mt-2 text-xs font-black text-[var(--text-primary)]">OJ Admin</p>
          <p className="text-[10px] text-[var(--text-muted)] font-code">v1.0.0</p>
        </div>

        <nav className="p-2 space-y-0.5 text-xs font-bold">
          {menuBtn('overview', <LayoutDashboard className="w-4 h-4" />, 'Dashboard')}

          <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">General</p>
          {menuBtn('users', <UserRound className="w-4 h-4" />, 'User & Phân Quyền')}
          {menuBtn('announcements', <Megaphone className="w-4 h-4" />, 'Thông Báo')}
          {menuBtn('settings', <Settings className="w-4 h-4" />, 'System Config')}

          <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Problem</p>
          {menuBtn('problems', <ListTree className="w-4 h-4" />, 'Problem List', activeTab === 'problems' && problemMode === 'list')}
          {menuBtn('create', <Plus className="w-4 h-4" />, 'Create Problem', activeTab === 'problems' && problemMode === 'create')}

          <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Contest</p>
          {menuBtn('contests', <Trophy className="w-4 h-4" />, 'Contest List')}

          <div className="pt-2 mt-2 border-t border-[var(--border)] space-y-1">
            <a
              href="/"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Về Trang Học Sinh
            </a>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Đăng Xuất
            </button>
          </div>
        </nav>
      </aside>

      {/* RIGHT: Content */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="bg-white p-5 rounded-xl border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 text-xs font-bold font-code">
              <ShieldCheck className="w-3.5 h-3.5" /> Quản Trị Hệ Thống
            </div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">Trung Tâm Quản Lý Admin</h1>
            <p className="text-[var(--text-secondary)] text-xs">Người dùng · Phân quyền RBAC · Nội dung · Kỳ thi · Thông báo</p>
          </div>
          <button
            onClick={() => handleTabChange('create')}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs flex items-center gap-1.5 transition-colors w-fit cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo Bài Tập Mới
          </button>
        </div>

        {activeTab === 'overview' && <AdminOverviewTab />}
        {activeTab === 'users' && <AdminUsersTab myUserId={myUserId} />}
        {activeTab === 'problems' && (
          <AdminProblemsTab
            mode={problemMode}
            onModeChange={(m) => setProblemMode(m)}
          />
        )}
        {activeTab === 'contests' && <AdminContestsTab />}
        {activeTab === 'announcements' && <AdminAnnouncementsTab />}
        {activeTab === 'settings' && <AdminSettingsTab />}
      </div>
    </div>
  );
}