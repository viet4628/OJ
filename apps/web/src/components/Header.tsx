import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MorphIcon from './MorphIcon';
import {
  Code2 as Code2Data,
  Search as SearchData,
  ChevronDown as ChevronDownData,
  User as UserData,
  LogOut as LogOutData,
  Settings as SettingsData,
  ShieldCheck as ShieldCheckData,
  GraduationCap as GraduationCapData,
  Sun as SunData,
  Moon as MoonData,
} from 'lucide';
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
    <header className="sticky top-0 z-40 bg-[var(--bg-secondary)] border-b border-[var(--border)] px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="w-full h-14 flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        {/* Left: Brand Logo + Nav Bar */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar md:overflow-visible">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 rounded-md bg-[var(--text-primary)] text-[var(--bg-primary)] flex items-center justify-center font-bold transition-all shadow-xs">
              <MorphIcon icon={Code2Data} size={15} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              CodeJudge
            </span>
          </Link>

          {/* Navigation Items (GitHub style text links) */}
          <nav className="flex items-center gap-1 shrink-0 text-xs">
            <Link
              to="/"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname === '/'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Trang Chủ
            </Link>

            <Link
              to="/problems"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname.startsWith('/problems')
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Bài Tập
            </Link>

            <Link
              to="/contests"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname.startsWith('/contests')
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Kỳ Thi
            </Link>

            <Link
              to="/classes"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname.startsWith('/classes')
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Lớp Học
            </Link>

            <Link
              to="/submissions"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname.startsWith('/submissions')
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Nhật Ký
            </Link>

            {/* Rank Submenu */}
            <div
              className="relative"
              onMouseEnter={() => setIsRankMenuOpen(true)}
              onMouseLeave={() => setIsRankMenuOpen(false)}
            >
              <button
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                  location.pathname.startsWith('/ranklist')
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
                }`}
              >
                <span>Xếp Hạng</span>
                <MorphIcon icon={ChevronDownData} size={12} className="opacity-70" />
              </button>
              {isRankMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-lg p-1 z-50">
                  <Link
                    to="/ranklist?type=ACM"
                    className="block px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded-md transition-colors"
                  >
                    ACM Ranklist
                  </Link>
                  <Link
                    to="/ranklist?type=OI"
                    className="block px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded-md transition-colors"
                  >
                    OI Subtask Ranklist
                  </Link>
                </div>
              )}
            </div>

            {/* Hướng Dẫn */}
            <Link
              to="/about"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                location.pathname.startsWith('/about')
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium'
              }`}
            >
              Hướng Dẫn
            </Link>
          </nav>
        </div>

        {/* Right: Search, Theme Toggle & Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {/* GitHub-style Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-between w-40 sm:w-56 bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer"
            title="Tìm kiếm (⌘K)"
          >
            <div className="flex items-center gap-1.5 truncate">
              <MorphIcon icon={SearchData} size={14} className="shrink-0" />
              <span className="truncate">Tìm kiếm...</span>
            </div>
            <kbd className="hidden sm:inline border border-[var(--border)] rounded px-1.5 py-0.2 text-[10px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-7 h-7 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title={isDark ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'}
            aria-label="Toggle Theme"
          >
            <MorphIcon
              icon={isDark ? SunData : MoonData}
              size={14}
              spring="snappy"
              className={isDark ? 'text-amber-400' : 'text-slate-600'}
            />
          </button>

          {isAuthLoading ? (
            <div className="w-16 h-7 rounded-md bg-[var(--bg-tertiary)] animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)]">
                {user.rating} AC
              </span>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfileOpen(!isProfileOpen);
                  }}
                  className="flex items-center gap-1.5 p-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors border border-transparent hover:border-[var(--border)] cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-primary)]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <MorphIcon icon={ChevronDownData} size={12} className="text-[var(--text-muted)]" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-1.5 w-52 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-xl p-1 z-50">
                    <div className="px-2.5 py-2 border-b border-[var(--border)] mb-1">
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.username}</div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{user.rating} bài đã giải</div>
                    </div>

                    {user.role === 'teacher' && (
                      <Link
                        to="/teacher"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium transition-colors"
                      >
                        <MorphIcon icon={GraduationCapData} size={14} className="text-[var(--accent-text)]" />
                        <span>Cổng Giáo Viên</span>
                      </Link>
                    )}

                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] font-medium transition-colors"
                      >
                        <MorphIcon icon={ShieldCheckData} size={14} className="text-[var(--accent-text)]" />
                        <span>Quản Trị Admin</span>
                      </Link>
                    )}

                    <Link
                      to={`/users/${user.id}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-medium transition-colors"
                    >
                      <MorphIcon icon={UserData} size={14} /> Hồ Sơ Cá Nhân
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] font-medium transition-colors"
                    >
                      <MorphIcon icon={SettingsData} size={14} /> Cài Đặt
                    </Link>

                    <div className="border-t border-[var(--border)] my-1" />

                    <button
                      onClick={onLogout}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[var(--danger)] hover:bg-[var(--bg-tertiary)] font-medium transition-colors cursor-pointer text-left"
                    >
                      <MorphIcon icon={LogOutData} size={14} /> Đăng Xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAuth}
                className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-xs transition-colors cursor-pointer"
              >
                Đăng Nhập
              </button>
              <button
                onClick={onOpenAuth}
                className="px-2.5 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
              >
                Đăng Ký
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
