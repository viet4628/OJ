import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import { ArrowLeft as ArrowLeftData, LogIn as LogInData } from 'lucide';
import { getUserPermissions, type AppUser } from '../../lib/api';
import AdminProblemsTab from '../admin/tabs/AdminProblemsTab';
import AdminContestsTab from '../admin/tabs/AdminContestsTab';
import AdminAnnouncementsTab from '../admin/tabs/AdminAnnouncementsTab';
import TeacherClassroomsTab from './tabs/TeacherClassroomsTab';
import LearningTracksTab from './tabs/LearningTracksTab';

type TeacherTab = 'classrooms' | 'problems' | 'tracks' | 'contests' | 'announcements';

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
      case 'classrooms':
        return true;
      case 'problems':
      case 'tracks':
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
      else setActiveTab('classrooms');
    }
  }, [permLoaded, permissions]);

  const handleTabChange = (tab: TeacherTab) => {
    if (!canAccessTab(tab)) return;
    if (tab === 'problems') {
      setProblemMode('list');
      setActiveTab('problems');
    } else {
      setActiveTab(tab);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-8 text-center space-y-4">

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

  const menuBtn = (tab: TeacherTab, text: string, isSpecialActive = false) => {
    const isActive = isSpecialActive || (activeTab === tab && (tab !== 'problems' || problemMode === 'list'));
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-auto shrink-0 lg:w-full whitespace-nowrap flex items-center gap-2 px-2.5 py-3 lg:py-1.5 rounded-md transition-colors cursor-pointer text-xs ${
          isActive
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-normal'
        }`}
      >
        {text}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* LEFT: Sidebar */}
      <aside className="w-full lg:w-56 shrink-0 lg:sticky lg:top-20 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border)] flex items-center gap-2.5">

          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Cổng Giáo Viên</p>

          </div>
        </div>

        <nav aria-label="Điều hướng giáo viên" className="p-2 flex lg:block items-center gap-1 lg:space-y-0.5 overflow-x-auto text-xs">

          <p className="hidden lg:block px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Lớp Học
          </p>
          {menuBtn('classrooms', 'Quản Lý Lớp Học')}

          {can('problems.manage') && (
            <>
              <p className="hidden lg:block px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Bài Tập
              </p>
              {menuBtn('problems', 'Danh Sách Bài Tập', activeTab === 'problems' && problemMode === 'list')}
              {menuBtn('tracks', 'Lộ Trình Luyện Tập')}
            </>
          )}

          {can('contests.manage') && (
            <>
              <p className="hidden lg:block px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Kỳ Thi & Kiểm Tra
              </p>
              {menuBtn('contests', 'Danh Sách Kỳ Thi')}
            </>
          )}

          {can('announcements.manage') && (
            <>
              <p className="hidden lg:block px-2.5 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Thông Báo
              </p>
              {menuBtn('announcements', 'Bảng Thông Báo')}
            </>
          )}

          <div className="hidden lg:block pt-2 mt-2 border-t border-[var(--border)]">
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
        {activeTab === 'classrooms' && <>
        <div className="bg-[var(--bg-secondary)] px-4 py-3 rounded-md border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">Trung Tâm Giảng Dạy & Lớp Học</h1>
            <p className="text-[var(--text-secondary)] text-xs">
              Mở lớp học · Quản lý học sinh · Giao bài tập & xem tiến độ trực tiếp
            </p>
          </div>


        </div>

          <TeacherClassroomsTab />
        </>}
        {activeTab === 'problems' && can('problems.manage') && (
          <AdminProblemsTab
            mode={problemMode}
            onModeChange={(m) => setProblemMode(m)}
            userId={user.id}
            isAdmin={user.role === 'admin'}
          />
        )}
        {activeTab === 'tracks' && can('problems.manage') && <LearningTracksTab userId={user.id} isAdmin={user.role === 'admin'} />}
        {activeTab === 'contests' && can('contests.manage') && <AdminContestsTab userId={user.id} isAdmin={user.role === 'admin'} />}
        {activeTab === 'announcements' && can('announcements.manage') && <AdminAnnouncementsTab />}
      </div>
    </div>
  );
}
