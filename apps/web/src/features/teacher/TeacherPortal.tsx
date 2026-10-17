import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  GraduationCap as GraduationCapData,
  Plus as PlusData,
  LayoutDashboard as LayoutDashboardData,
  Trophy as TrophyData,
  ListTree as ListTreeData,
  Lock as LockData,
  Megaphone as MegaphoneData,
  ArrowLeft as ArrowLeftData,
  LogIn as LogInData,
} from 'lucide';
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
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center">
          <MorphIcon icon={GraduationCapData} size={24} className="text-[var(--text-secondary)]" />
        </div>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Cổng Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Vui lòng đăng nhập bằng tài khoản Giáo viên để truy cập không gian soạn đề và quản lý kỳ thi.
        </p>
        <button
          onClick={onOpenAuth}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
        >
          <MorphIcon icon={LogInData} size={16} /> Đăng Nhập Ngay
        </button>
      </div>
    );
  }

  const isAllowed = user.role === 'teacher' || user.role === 'admin' || permissions.length > 0;

  if (permLoaded && !isAllowed) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center">
          <MorphIcon icon={LockData} size={24} className="text-[var(--danger)]" />
        </div>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Chưa Được Cấp Quyền Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Tài khoản hiện tại (<b className="text-[var(--text-primary)]">{user.username}</b>) đang là tài khoản học sinh.
          Vui lòng liên hệ Quản trị viên để được nâng cấp quyền Giáo viên.
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

  const menuBtn = (tab: TeacherTab, iconData: any, text: string, isSpecialActive = false) => {
    const isActive = isSpecialActive || (activeTab === tab && (tab !== 'problems' || problemMode === 'list'));
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer text-xs ${
          isActive
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-normal'
        }`}
      >
        <MorphIcon icon={iconData} size={14} className="shrink-0" /> {text}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* LEFT: Sidebar */}
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-20 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border)] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <MorphIcon icon={GraduationCapData} size={16} className="text-[var(--accent-text)]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Cổng Giáo Viên</p>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">Teacher Workspace</p>
          </div>
        </div>

        <nav className="p-2 space-y-0.5 text-xs">
          {menuBtn('overview', LayoutDashboardData, 'Tổng Quan')}

          <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Lớp Học
          </p>
          {menuBtn('classrooms', GraduationCapData, 'Quản Lý Lớp Học')}

          {can('problems.manage') && (
            <>
              <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Bài Tập
              </p>
              {menuBtn('problems', ListTreeData, 'Danh Sách Bài Tập', activeTab === 'problems' && problemMode === 'list')}
              {menuBtn('create', PlusData, 'Tạo Bài Tập Mới', activeTab === 'problems' && problemMode === 'create')}
            </>
          )}

          {can('contests.manage') && (
            <>
              <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Kỳ Thi & Kiểm Tra
              </p>
              {menuBtn('contests', TrophyData, 'Danh Sách Kỳ Thi')}
            </>
          )}

          {can('announcements.manage') && (
            <>
              <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Thông Báo
              </p>
              {menuBtn('announcements', MegaphoneData, 'Bảng Thông Báo')}
            </>
          )}

          <div className="pt-2 mt-2 border-t border-[var(--border)]">
            <Link
              to="/"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-xs font-medium"
            >
              <MorphIcon icon={ArrowLeftData} size={14} /> Về Trang Học Sinh
            </Link>
          </div>
        </nav>
      </aside>

      {/* RIGHT: Content */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        <div className="bg-[var(--bg-secondary)] px-4 py-3 rounded-md border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">Trung Tâm Giảng Dạy & Lớp Học</h1>
            <p className="text-[var(--text-secondary)] text-xs">
              Mở lớp học · Quản lý học sinh · Giao bài tập & xem tiến độ trực tiếp
            </p>
          </div>

          {can('problems.manage') && (
            <button
              onClick={() => handleTabChange('create')}
              className="px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs flex items-center gap-1.5 transition-colors w-fit border border-[rgba(27,31,36,0.15)] shadow-xs cursor-pointer"
            >
              <MorphIcon icon={PlusData} size={14} /> Tạo Bài Tập Mới
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
