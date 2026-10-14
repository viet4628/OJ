import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Code2,
  LogIn,
  Search,
  ChevronDown,
  User,
  LogOut,
  Trophy,
  Home as HomeIcon,
  Grid,
  BarChart2,
  HelpCircle,
  History,
  Settings,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import MorphIcon from './MorphIcon';
import { Sun as SunData, Moon as MoonData } from 'lucide';
import { useTheme } from '../lib/theme';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenAuth: () => void;
  user: { id: string; username: string; rating: number; role?: 'user' | 'teacher' | 'admin' } | null;
  onLogout: () => void;
  isAuthLoading?: boolean;
}

export default function Header({ onOpenSearch, onOpenAuth, user, onLogout, isAuthLoading }: HeaderProps) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRankMenuOpen, setIsRankMenuOpen] = useState(false);

  useEffect(() => {
    setIsProfileOpen(false);
    setIsRankMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = () => {
      setIsProfileOpen(false);
      setIsRankMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 shadow-sm transition-colors duration-150">
      <div className="w-full h-14 flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        {/* Left: Brand Logo + Nav Bar */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar md:overflow-visible">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center font-black group-hover:bg-[var(--accent-hover)] transition-all shadow-sm">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-[var(--text-primary)] leading-none">
                CodeJudge
              </span>
              <span className="text-[10px] text-[var(--accent-text)] font-bold font-mono tracking-wider uppercase mt-0.5">
                VN ONLINE JUDGE
              </span>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="flex items-center gap-1 shrink-0 text-xs font-bold text-[var(--text-secondary)]">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname === '/'
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <HomeIcon className="w-4 h-4" /> Trang Chủ
            </Link>

            <Link
              to="/problems"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname.startsWith('/problems')
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Grid className="w-4 h-4" /> Bài Tập
            </Link>

            <Link
              to="/contests"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname.startsWith('/contests')
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" /> Kỳ Thi (Contest)
            </Link>

            <Link
              to="/classes"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname.startsWith('/classes')
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-500" /> Lớp Học
            </Link>

            <Link
              to="/submissions"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname.startsWith('/submissions')
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <History className="w-4 h-4 text-sky-500" /> Nhật Ký Nộp Bài
            </Link>

            {/* Rank Submenu */}
            <div
              className="relative"
              onMouseEnter={() => setIsRankMenuOpen(true)}
              onMouseLeave={() => setIsRankMenuOpen(false)}
            >
              <button
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-1 px-3 py-4 border-b-2 transition-all cursor-pointer ${
                  location.pathname.startsWith('/ranklist')
                    ? 'border-[var(--accent)] text-[var(--accent-text)]'
                    : 'border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-[var(--accent-text)]" /> Xếp Hạng <ChevronDown className="w-3 h-3" />
              </button>
              {isRankMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50 animate-fade-in">
                  <Link
                    to="/ranklist?type=ACM"
                    className="block px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-text)] rounded-lg transition-colors"
                  >
                    🏆 ACM Ranklist
                  </Link>
                  <Link
                    to="/ranklist?type=OI"
                    className="block px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-text)] rounded-lg transition-colors"
                  >
                    🏅 OI Subtask Ranklist
                  </Link>
                </div>
              )}
            </div>

            {/* Hướng Dẫn (Wiki) */}
            <Link
              to="/about"
              className={`flex items-center gap-1.5 px-3 py-4 border-b-2 transition-all ${
                location.pathname.startsWith('/about')
                  ? 'border-[var(--accent)] text-[var(--accent-text)]'
                  : 'border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> Hướng Dẫn
            </Link>
          </nav>
        </div>

        {/* Right: Search, Theme Toggle & Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--border-focus)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            title="Tìm kiếm (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tìm bài tập...</span>
            <kbd className="hidden md:inline ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[10px] font-mono shadow-sm">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer flex items-center justify-center"
            title={isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối (Dark mode)'}
            aria-label="Toggle Theme"
          >
            <MorphIcon
              icon={isDark ? SunData : MoonData}
              size={16}
              spring="snappy"
              className={isDark ? 'text-amber-400' : 'text-slate-700'}
            />
          </button>

          {isAuthLoading ? (
            <div className="w-20 h-8 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono text-[var(--accent-text)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{user.rating} AC</span>
              </div>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileOpen(!isProfileOpen);
                  }}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-all border border-transparent hover:border-[var(--border)] cursor-pointer"
                >
                  <div className="w-[30px] h-[30px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-black shadow-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-xs font-bold text-[var(--text-primary)]">{user.username}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50 animate-fade-in">
                    <div className="px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] rounded-lg">
                      <div className="text-xs font-black text-[var(--text-primary)]">{user.username}</div>
                      <div className="text-[11px] text-[var(--accent-text)] font-mono font-bold flex items-center gap-1 mt-0.5">
                        <Trophy className="w-3 h-3 text-amber-500" /> {user.rating} AC Solved
                      </div>
                    </div>

                    {user.role === 'teacher' && (
                      <Link
                        to="/teacher"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold transition-colors"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Không Gian Giáo Viên</span>
                      </Link>
                    )}

                    {user.role === 'admin' && (
                      <a
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Quản Trị Admin</span>
                      </a>
                    )}

                    <Link
                      to={`/users/${user.id}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-text)] font-semibold transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Hồ Sơ Cá Nhân
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent-text)] font-semibold transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-sky-500" /> Cài Đặt Tài Khoản
                    </Link>
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-500 hover:bg-red-500/10 font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Đăng Xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-full border border-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent)]/10 font-bold text-xs transition-all cursor-pointer"
              >
                Đăng Nhập
              </button>
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Đăng Ký
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
