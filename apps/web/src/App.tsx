import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
const SearchModal = lazy(() => import('./components/SearchModal'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const Home = lazy(() => import('./features/user/Home'));
import Landing from './features/user/Landing';
const Problems = lazy(() => import('./features/user/Problems'));
const Learning = lazy(() => import('./features/user/Learning'));
const TrackDetail = lazy(() => import('./features/user/TrackDetail'));
const ProblemDetail = lazy(() => import('./features/user/ProblemDetail'));
const Submissions = lazy(() => import('./features/user/Submissions'));
const Ranklist = lazy(() => import('./features/user/Ranklist'));
const About = lazy(() => import('./features/user/About'));
const Contests = lazy(() => import('./features/user/Contests'));
const ContestDetail = lazy(() => import('./features/user/ContestDetail'));
const ContestProblem = lazy(() => import('./features/user/ContestProblem'));
const ResetPassword = lazy(() => import('./features/user/ResetPassword'));
const UserHome = lazy(() => import('./features/user/UserHome'));
const Settings = lazy(() => import('./features/user/Settings'));
const Classes = lazy(() => import('./features/user/Classes'));
const ClassDetail = lazy(() => import('./features/user/ClassDetail'));
const TeacherPortal = lazy(() => import('./features/teacher/TeacherPortal'));
const AdminGate = lazy(() => import('./features/admin/AdminGate'));
import { supabase, getMySubmissionCount, type AppUser } from './lib/api';

export default function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const location = useLocation();
  const isFullScreen =
    Boolean(location.pathname.match(/^\/problems\/[^/]+$/)) ||
    Boolean(location.pathname.match(/^\/contests\/[^/]+\/problems\/[^/]+$/));
  const isLanding = location.pathname === '/' && !isAuthLoading && !user;
  const isAdminArea = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  // Load current auth session from Supabase
  useEffect(() => {
    void refreshUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void refreshUser();
      else {
        setUser(null);
        setIsAuthLoading(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function refreshUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setUser(null);
      setIsAuthLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profile?.is_suspended) {
      setAccountNotice('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
      setUser(null);
      setIsAuthLoading(false);
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
    setAccountNotice(null);

    const rating = await getMySubmissionCount();
    setUser({
      id: authUser.id,
      username: profile?.full_name || authUser.email?.split('@')[0] || 'user',
      rating,
      role: profile?.role || 'user',
    });
    setIsAuthLoading(false);
  }

  // Global Keyboard Shortcut Listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleLoginSuccess = async () => {
    await refreshUser();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased font-sans">
      {accountNotice && <p role="alert" className="border-b border-[var(--border)] p-3 text-sm text-[var(--danger)]">{accountNotice}</p>}
      {/* Show global Header ONLY on standard pages. ProblemDetail has its own dedicated single top bar */}
      {!isFullScreen && !isAdminArea && (
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          user={user}
          onLogout={handleLogout}
          isAuthLoading={isAuthLoading}
        />
      )}

      <Suspense fallback={<main className="flex-1 p-6 text-sm text-[var(--text-secondary)]" role="status">Đang tải...</main>}>
      {/* Landing page cho khách chưa đăng nhập — full width */}
      {isLanding && (
        <main className="flex-1">
          <Landing onOpenAuth={() => setIsAuthOpen(true)} />
        </main>
      )}

      {/* Đang kiểm tra phiên đăng nhập ở trang chủ — tránh nhấp nháy sai trang */}
      {!isLanding && !isFullScreen && isAuthLoading && location.pathname === '/' && (
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-[3px] border-[var(--accent)] border-t-transparent animate-spin" />
        </main>
      )}

      {/* Main Content */}
      {isFullScreen ? (
        <main className="flex-1 w-full h-screen overflow-hidden">
          <Routes>
            <Route path="/problems/:slug" element={<ProblemDetail user={user} onOpenAuth={() => setIsAuthOpen(true)} onLogout={handleLogout} />} />
            <Route path="/contests/:id/problems/:pid" element={<ContestProblem user={user} onOpenAuth={() => setIsAuthOpen(true)} />} />
          </Routes>
        </main>
      ) : isAdminArea ? (
        <main className="flex-1 w-full min-h-screen bg-[var(--bg-primary)] px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/admin" element={<Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Đang tải quản trị...</div>}><AdminGate /></Suspense>} />
            <Route path="/admin/*" element={<Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Đang tải quản trị...</div>}><AdminGate /></Suspense>} />
          </Routes>
        </main>
      ) : (
        <>
          {!isLanding && !(isAuthLoading && location.pathname === '/') && (
            <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/problems" element={<Problems />} />
                <Route path="/learn" element={<Learning />} />
                <Route path="/learn/:slug" element={<TrackDetail />} />
                <Route path="/submissions" element={<Submissions user={user} />} />
                <Route path="/ranklist" element={<Ranklist />} />
                <Route path="/about" element={<About />} />
                <Route path="/contests" element={<Contests />} />
                <Route path="/contests/:id" element={<ContestDetail />} />
                <Route path="/classes" element={<Classes user={user} onOpenAuth={() => setIsAuthOpen(true)} />} />
                <Route path="/classes/:classId" element={<ClassDetail user={user} onOpenAuth={() => setIsAuthOpen(true)} />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/users/:id" element={<UserHome currentUser={user} />} />
                <Route path="/settings" element={<Settings user={user} onOpenAuth={() => setIsAuthOpen(true)} onProfileSaved={() => void refreshUser()} />} />
                <Route path="/teacher" element={<TeacherPortal user={user} onOpenAuth={() => setIsAuthOpen(true)} />} />
                <Route path="/teacher/*" element={<TeacherPortal user={user} onOpenAuth={() => setIsAuthOpen(true)} />} />
              </Routes>
            </main>
          )}
        </>
      )}

      {/* Footer — Minimal GitHub style */}
      {!isFullScreen && !isAdminArea && !isLanding && (
        <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border)] py-4 px-6 text-xs text-[var(--text-muted)]">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-[var(--text-primary)]">CodeJudge VN</span>
            <p>© 2026 CodeJudge VN</p>
          </div>
        </footer>
      )}

      {/* Modals — Only render when explicitly open */}
      {isSearchOpen && (
        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      )}
      {isAuthOpen && (
        <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={handleLoginSuccess} />
      )}
      </Suspense>
    </div>
  );
}
