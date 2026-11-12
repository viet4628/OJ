import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import { ArrowLeft as ArrowLeftData, LogOut as LogOutData } from 'lucide';
import { supabase } from '../../lib/supabase';
import AdminOverviewTab from './tabs/AdminOverviewTab';
import AdminUsersTab from './tabs/AdminUsersTab';
import AdminProblemsTab from './tabs/AdminProblemsTab';
import AdminContestsTab from './tabs/AdminContestsTab';
import AdminAnnouncementsTab from './tabs/AdminAnnouncementsTab';

export type TabName = 'overview' | 'problems' | 'contests' | 'announcements' | 'users';

interface AdminProps {
  userId?: string | null;
}

export default function Admin({ userId }: AdminProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [authChecked, setAuthChecked] = useState(Boolean(userId));
  const [isAdmin, setIsAdmin] = useState(Boolean(userId));
  const [myUserId, setMyUserId] = useState<string | null>(userId || null);

  // Parse active tab from URL path /admin/:tab or fallback
  const subpath = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const validTabs: TabName[] = ['overview', 'problems', 'contests', 'announcements', 'users'];
  const activeTab: TabName = validTabs.includes(subpath as TabName)
    ? (subpath as TabName)
    : (validTabs.includes(searchParams.get('tab') as TabName) ? (searchParams.get('tab') as TabName) : 'overview');

  const problemMode: 'list' | 'create' = searchParams.get('mode') === 'create' ? 'create' : 'list';

  useEffect(() => {
    if (userId) {
      setMyUserId(userId);
      setIsAdmin(true);
      setAuthChecked(true);
      return;
    }
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
  }, [userId]);

  const handleTabChange = (tab: TabName, mode?: 'list' | 'create') => {
    if (tab === 'problems') {
      const targetMode = mode || 'list';
      navigate(targetMode === 'create' ? '/admin/problems?mode=create' : '/admin/problems');
    } else if (tab === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tab}`);
    }
  };

  const handleProblemModeChange = (mode: 'list' | 'create') => {
    navigate(mode === 'create' ? '/admin/problems?mode=create' : '/admin/problems');
  };

  const menuBtn = (tab: TabName, text: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors cursor-pointer text-xs ${
          isActive
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-normal'
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{text}</span>
        </div>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </button>
    );
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[var(--text-secondary)] font-medium">
        <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mr-2" />
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-6 text-center space-y-4">

        <h1 className="text-base font-semibold text-[var(--text-primary)]">Không Có Quyền Quản Trị</h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Khu vực quản trị chỉ dành cho tài khoản có vai trò <b className="text-[var(--text-primary)]">admin</b>.
          Giáo viên vui lòng truy cập Cổng Giáo Viên để soạn đề và quản lý bài nộp.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border)] transition-colors"
          >
            <MorphIcon icon={ArrowLeftData} size={14} /> Về Trang Chủ Học Sinh
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* LEFT: Sidebar Navigation */}
      <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-6 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden">
        {/* Brand header */}
        <div className="p-3 border-b border-[var(--border)] flex items-center gap-2.5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Quản trị</p>
        </div>

        {/* Navigation Groups */}
        <nav className="p-2 space-y-3">
          {/* Section: Overview */}
          <div className="space-y-0.5">
            <p className="px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Tổng Quan
            </p>
            {menuBtn('overview', 'Bảng Điều Khiển')}
          </div>

          {/* Section: Content Management */}
          <div className="space-y-0.5">
            <p className="px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Quản Lý Nội Dung
            </p>
            {menuBtn('problems', 'Ngân Hàng Bài Tập')}
            {menuBtn('contests', 'Kỳ Thi Trực Tuyến')}
            {menuBtn('announcements', 'Thông Báo Hệ Thống')}
          </div>

          {/* Section: System & RBAC */}
          <div className="space-y-0.5">
            <p className="px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Hệ Thống & Phân Quyền
            </p>
            {menuBtn('users', 'Người Dùng & Phân Quyền')}
          </div>

          {/* Bottom Portal Switch & Sign Out */}
          <div className="pt-2 border-t border-[var(--border)] space-y-0.5">
            <Link
              to="/"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <MorphIcon icon={ArrowLeftData} size={14} className="shrink-0" />
              <span>Về Trang Học Sinh</span>
            </Link>

            <button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
              <MorphIcon icon={LogOutData} size={14} /> Đăng Xuất
            </button>
          </div>
        </nav>
      </aside>

      {/* RIGHT: Content Area */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        {/* Tab Panels */}
        {activeTab === 'overview' && (
          <AdminOverviewTab />
        )}
        {activeTab === 'users' && <AdminUsersTab myUserId={myUserId} />}
        {activeTab === 'problems' && (
          <AdminProblemsTab
            mode={problemMode}
            onModeChange={handleProblemModeChange}
            userId={myUserId!}
            isAdmin
          />
        )}
        {activeTab === 'contests' && <AdminContestsTab userId={myUserId!} isAdmin />}
        {activeTab === 'announcements' && <AdminAnnouncementsTab />}
      </div>
    </div>
  );
}
