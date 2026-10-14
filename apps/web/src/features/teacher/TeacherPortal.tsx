import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  LayoutDashboard,
  Trophy,
  ListTree,
  Lock,
  Megaphone,
  ArrowLeft,
  LogIn,
} from 'lucide-react';
import { getUserPermissions, type AppUser } from '../../lib/api';
import AdminOverviewTab from '../admin/tabs/AdminOverviewTab';
import AdminProblemsTab from '../admin/tabs/AdminProblemsTab';
import AdminContestsTab from '../admin/tabs/AdminContestsTab';
import AdminAnnouncementsTab from '../admin/tabs/AdminAnnouncementsTab';
import TeacherClassroomsTab from './tabs/TeacherClassroomsTab';

type TeacherTab = 'overview' | 'classrooms' | 'problems' | 'create' | 'contests' | 'announcements';

interface TeacherPortalProps {
  user: AppUser | null;
  onOpenAuth: () => void;
}

export default function TeacherPortal({ user, onOpenAuth }: TeacherPortalProps) {
  const [activeTab, setActiveTab] = useState<TeacherTab>('classrooms');
  const [problemMode, setProblemMode] = useState<'list' | 'create'>('list');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permLoaded, setPermLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setPermLoaded(true);
      return;
    }
    if (user.role === 'admin') {
      setPermissions([
        'problems.manage',
        'testcases.manage',
        'contests.manage',
        'announcements.manage',
        'submissions.view_all',
      ]);
      setPermLoaded(true);
      return;
    }
    getUserPermissions(user.id).then((perms) => {
      setPermissions(perms);
      setPermLoaded(true);
    });
  }, [user]);

  const can = (perm: string) => user?.role === 'admin' || permissions.includes(perm);

  const canAccessTab = (tab: TeacherTab): boolean => {
    switch (tab) {
      case 'overview':
      case 'classrooms':
        return true;
      case 'problems':
      case 'create':
        return can('problems.manage');
      case 'contests':
        return can('contests.manage');
      case 'announcements':
        return can('announcements.manage');
      default:
        return false;
    }
  };

  useEffect(() => {
    if (permLoaded && !canAccessTab(activeTab)) {
      if (can('problems.manage')) setActiveTab('problems');
      else if (can('contests.manage')) setActiveTab('contests');
      else setActiveTab('overview');
    }
  }, [permLoaded, permissions]);

  const handleTabChange = (tab: TeacherTab) => {
    if (!canAccessTab(tab)) return;
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

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <GraduationCap className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-lg font-black text-[var(--text-primary)]">Cổng Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Vui lòng đăng nhập bằng tài khoản Giáo viên để truy cập không gian soạn đề và quản lý kỳ thi.
        </p>
        <button
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
        >
          <LogIn className="w-4 h-4" /> Đăng Nhập Ngay
        </button>
      </div>
    );
  }

  const isAllowed = user.role === 'teacher' || user.role === 'admin' || permissions.length > 0;

  if (permLoaded && !isAllowed) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <Lock className="w-7 h-7 text-[var(--danger)]" />
        </div>
        <h1 className="text-lg font-black text-[var(--text-primary)]">Chưa Được Cấp Quyền Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Tài khoản hiện tại (<b className="text-[var(--text-primary)]">{user.username}</b>) đang là tài khoản học sinh.
          Vui lòng liên hệ Quản trị viên để được nâng cấp quyền Giáo viên.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text-primary)] text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Về Trang Chủ Học Sinh
          </Link>
        </div>
      </div>
    );
  }

  const menuBtn = (tab: TeacherTab, icon: React.ReactNode, text: string, isSpecialActive = false) => {
    const isActive = isSpecialActive || (activeTab === tab && (tab !== 'problems' || problemMode === 'list'));
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
          isActive
            ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] font-bold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        {icon} {text}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* LEFT: Sidebar */}
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-20 rounded-2xl bg-white border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="py-5 text-center border-b border-[var(--border)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <GraduationCap className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-sm font-black text-[var(--text-primary)]">Cổng Giáo Viên</p>
          <p className="text-[11px] text-[var(--text-muted)] font-mono">Teacher Workspace</p>
        </div>

        <nav className="p-2 space-y-0.5 text-xs font-bold">
          {menuBtn('overview', <LayoutDashboard className="w-4 h-4" />, 'Tổng Quan')}

          <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
            Lớp Học
          </p>
          {menuBtn('classrooms', <GraduationCap className="w-4 h-4" />, 'Quản Lý Lớp Học')}

          {can('problems.manage') && (
            <>
              <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                Bài Tập
              </p>
              {menuBtn('problems', <ListTree className="w-4 h-4" />, 'Danh Sách Bài Tập', activeTab === 'problems' && problemMode === 'list')}
              {menuBtn('create', <Plus className="w-4 h-4" />, 'Tạo Bài Tập Mới', activeTab === 'problems' && problemMode === 'create')}
            </>
          )}

          {can('contests.manage') && (
            <>
              <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                Kỳ Thi & Kiểm Tra
              </p>
              {menuBtn('contests', <Trophy className="w-4 h-4" />, 'Danh Sách Kỳ Thi')}
            </>
          )}

          {can('announcements.manage') && (
            <>
              <p className="px-3 pt-3 pb-1 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                Thông Báo
              </p>
              {menuBtn('announcements', <Megaphone className="w-4 h-4" />, 'Bảng Thông Báo')}
            </>
          )}

          <div className="pt-3 mt-3 border-t border-[var(--border)]">
            <Link
              to="/"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Về Trang Học Sinh
            </Link>
          </div>
        </nav>
      </aside>

      {/* RIGHT: Content */}
      <div className="flex-1 min-w-0 w-full space-y-5">
        <div className="bg-white p-5 rounded-2xl border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
              <GraduationCap className="w-3.5 h-3.5" /> Không Gian Giáo Viên
            </div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">Trung Tâm Giảng Dạy & Lớp Học</h1>
            <p className="text-[var(--text-secondary)] text-xs">
              Mở lớp học · Quản lý học sinh · Giao bài tập & xem tiến độ trực tiếp
            </p>
          </div>

          {can('problems.manage') && (
            <button
              onClick={() => handleTabChange('create')}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs flex items-center gap-1.5 transition-colors w-fit shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tạo Bài Tập Mới
            </button>
          )}
        </div>

        {activeTab === 'overview' && <AdminOverviewTab />}
        {activeTab === 'classrooms' && <TeacherClassroomsTab />}
        {activeTab === 'problems' && can('problems.manage') && (
          <AdminProblemsTab
            mode={problemMode}
            onModeChange={(m) => setProblemMode(m)}
          />
        )}
        {activeTab === 'contests' && can('contests.manage') && <AdminContestsTab />}
        {activeTab === 'announcements' && can('announcements.manage') && <AdminAnnouncementsTab />}
      </div>
    </div>
  );
}

