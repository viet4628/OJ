import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  ArrowLeft as ArrowLeftData,
  LogIn as LogInData,
  GraduationCap as GraduationCapData,
  LayoutDashboard as LayoutDashboardData,
  School as SchoolData,
  BookOpen as BookOpenData,
  Compass as CompassData,
  Trophy as TrophyData,
  Send as SendData,
  ShieldCheck as ShieldCheckData,
  ShieldAlert as ShieldAlertData,
} from 'lucide';
import { getUserPermissions, type AppUser, type Classroom } from '../../lib/api';
import AdminProblemsTab from '../admin/tabs/AdminProblemsTab';
import AdminContestsTab from '../admin/tabs/AdminContestsTab';
import AdminSubmissionsTab from '../admin/tabs/AdminSubmissionsTab';
import TeacherClassroomsTab from './tabs/TeacherClassroomsTab';
import LearningTracksTab from './tabs/LearningTracksTab';
import TeacherOverviewTab from './tabs/TeacherOverviewTab';

export type TeacherTab =
  | 'overview'
  | 'classrooms'
  | 'problems'
  | 'tracks'
  | 'contests'
  | 'submissions';

const TEACHER_TAB_ICONS: Record<TeacherTab, any> = {
  overview: LayoutDashboardData,
  classrooms: SchoolData,
  problems: BookOpenData,
  tracks: CompassData,
  contests: TrophyData,
  submissions: SendData,
};

interface TeacherPortalProps {
  user: AppUser | null;
  onOpenAuth: () => void;
}

export default function TeacherPortal({ user, onOpenAuth }: TeacherPortalProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Parse active tab from URL path /teacher/:tab or fallback
  const subpath = location.pathname.replace(/^\/teacher\/?/, '').split('/')[0];
  const validTabs: TeacherTab[] = [
    'overview',
    'classrooms',
    'problems',
    'tracks',
    'contests',
    'submissions',
  ];
  const currentTab: TeacherTab = validTabs.includes(subpath as TeacherTab)
    ? (subpath as TeacherTab)
    : (validTabs.includes(searchParams.get('tab') as TeacherTab)
        ? (searchParams.get('tab') as TeacherTab)
        : 'overview');

  const [activeTab, setActiveTab] = useState<TeacherTab>(currentTab);
  const [problemMode, setProblemMode] = useState<'list' | 'create'>(
    searchParams.get('mode') === 'create' ? 'create' : 'list'
  );
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permLoaded, setPermLoaded] = useState(false);

  // Sync state if URL subpath changes
  useEffect(() => {
    if (validTabs.includes(subpath as TeacherTab)) {
      setActiveTab(subpath as TeacherTab);
    } else if (location.pathname === '/teacher' || location.pathname === '/teacher/') {
      setActiveTab('overview');
    }
  }, [location.pathname, subpath]);

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
      case 'tracks':
        return can('problems.manage');
      case 'contests':
        return can('contests.manage');
      case 'submissions':
        return can('submissions.view_all');
      default:
        return false;
    }
  };

  useEffect(() => {
    if (permLoaded && !canAccessTab(activeTab)) {
      if (can('problems.manage')) handleTabChange('problems');
      else if (can('contests.manage')) handleTabChange('contests');
      else handleTabChange('classrooms');
    }
  }, [permLoaded, permissions]);

  const handleTabChange = (tab: TeacherTab, mode?: 'list' | 'create') => {
    if (!canAccessTab(tab)) return;
    setActiveTab(tab);
    if (tab === 'problems') {
      const targetMode = mode || 'list';
      setProblemMode(targetMode);
      navigate(targetMode === 'create' ? '/teacher/problems?mode=create' : '/teacher/problems');
    } else if (tab === 'overview') {
      navigate('/teacher');
    } else {
      navigate(`/teacher/${tab}`);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-8 text-center space-y-3 shadow-xs">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 border border-accent/25 text-[var(--accent-text)] mb-1">
          <MorphIcon icon={GraduationCapData} size={20} />
        </div>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Cổng Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Vui lòng đăng nhập bằng tài khoản Giáo viên để truy cập không gian soạn đề và quản lý kỳ thi.
        </p>
        <div className="pt-2">
          <button
            onClick={onOpenAuth}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
          >
            <MorphIcon icon={LogInData} size={14} /> Đăng Nhập Ngay
          </button>
        </div>
      </div>
    );
  }

  const isAllowed = user.role === 'teacher' || user.role === 'admin' || permissions.length > 0;

  if (permLoaded && !isAllowed) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-8 text-center space-y-3 shadow-xs">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-danger/10 border border-danger/25 text-[var(--danger)] mb-1">
          <MorphIcon icon={ShieldAlertData} size={20} />
        </div>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Chưa Được Cấp Quyền Giáo Viên</h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Tài khoản hiện tại (<b className="text-[var(--text-primary)] font-mono">{user.username}</b>) đang là tài khoản học sinh.
          Vui lòng liên hệ Quản trị viên để được nâng cấp quyền Giáo viên.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border)] transition-colors cursor-pointer"
          >
            <MorphIcon icon={ArrowLeftData} size={13} /> Về Trang Chủ Học Sinh
          </Link>
        </div>
      </div>
    );
  }

  const menuBtn = (tab: TeacherTab, text: string, isSpecialActive = false) => {
    const isActive = isSpecialActive || (activeTab === tab && (tab !== 'problems' || problemMode === 'list'));
    const IconComponent = TEACHER_TAB_ICONS[tab];
    return (
      <button
        onClick={() => handleTabChange(tab)}
        className={`w-auto shrink-0 lg:w-full whitespace-nowrap flex items-center justify-between px-2.5 py-2 rounded-md transition-all cursor-pointer text-xs ${
          isActive
            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold shadow-xs'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-medium'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <MorphIcon
            icon={IconComponent}
            size={14}
            className={isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}
          />
          <span>{text}</span>
        </div>
        {isActive && <div className="hidden lg:block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6">
      {/* LEFT: Sidebar Navigation */}
      <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-6 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] overflow-hidden">
        {/* Brand header */}
        <div className="p-3.5 border-b border-[var(--border)] flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent/10 border border-accent/25 flex items-center justify-center text-[var(--accent-text)]">
              <MorphIcon icon={GraduationCapData} size={14} />
            </div>
            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Teacher Workspace</p>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {user.role === 'admin' ? 'Admin' : 'Giáo viên'}
          </span>
        </div>

        <nav aria-label="Điều hướng giáo viên" className="p-2 flex lg:block items-center gap-1 lg:space-y-3 overflow-x-auto text-xs">
          {/* Section: Overview */}
          <div className="space-y-0.5">
            <p className="hidden lg:block px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Tổng Quan
            </p>
            {menuBtn('overview', 'Bảng Điều Khiển')}
          </div>

          {/* Section: Classrooms */}
          <div className="space-y-0.5">
            <p className="hidden lg:block px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Giảng Dạy & Lớp Học
            </p>
            {menuBtn('classrooms', 'Quản Lý Lớp Học')}
          </div>

          {can('problems.manage') && (
            <div className="space-y-0.5">
              <p className="hidden lg:block px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Bài Tập & Lộ Trình
              </p>
              {menuBtn('problems', 'Ngân Hàng Bài Tập', activeTab === 'problems' && problemMode === 'list')}
              {menuBtn('tracks', 'Lộ Trình Luyện Tập')}
            </div>
          )}

          {can('contests.manage') && (
            <div className="space-y-0.5">
              <p className="hidden lg:block px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Kỳ Thi & Kiểm Tra
              </p>
              {menuBtn('contests', 'Danh Sách Kỳ Thi')}
            </div>
          )}

          {can('submissions.view_all') && (
            <div className="space-y-0.5">
              <p className="hidden lg:block px-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Giám Sát Bài Làm
              </p>
              {menuBtn('submissions', 'Nhật Ký Bài Nộp')}
            </div>
          )}

          <div className="hidden lg:block pt-2 border-t border-[var(--border)] space-y-1">
            {user.role === 'admin' && (
              <Link
                to="/admin"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[var(--accent-text)] bg-accent/5 hover:bg-accent/10 border border-accent/20 transition-colors text-xs font-medium"
              >
                <MorphIcon icon={ShieldCheckData} size={14} /> Chuyển sang Admin Console
              </Link>
            )}

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
        {activeTab === 'overview' && (
          <TeacherOverviewTab
            onNavigateTab={handleTabChange}
            onSelectClassroom={(c) => {
              setSelectedClassroom(c);
              handleTabChange('classrooms');
            }}
            teacherName={user.username}
          />
        )}
        {activeTab === 'classrooms' && (
          <TeacherClassroomsTab initialClass={selectedClassroom} />
        )}
        {activeTab === 'problems' && can('problems.manage') && (
          <AdminProblemsTab
            mode={problemMode}
            onModeChange={(m) => {
              setProblemMode(m);
              navigate(m === 'create' ? '/teacher/problems?mode=create' : '/teacher/problems');
            }}
            userId={user.id}
            isAdmin={user.role === 'admin'}
          />
        )}
        {activeTab === 'tracks' && can('problems.manage') && (
          <LearningTracksTab userId={user.id} isAdmin={user.role === 'admin'} />
        )}
        {activeTab === 'contests' && can('contests.manage') && (
          <AdminContestsTab userId={user.id} isAdmin={user.role === 'admin'} />
        )}
        {activeTab === 'submissions' && can('submissions.view_all') && (
          <AdminSubmissionsTab canRejudge={can('problems.manage') || can('contests.manage')} />
        )}
      </div>
    </div>
  );
}
