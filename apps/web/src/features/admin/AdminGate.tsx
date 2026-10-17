import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  Code2 as Code2Data,
  LogIn as LogInData,
  Lock as LockData,
  ArrowLeft as ArrowLeftData,
} from 'lucide';
import { supabase } from '../../lib/supabase';
import Admin from './Admin';

export default function AdminGate() {
  const [phase, setPhase] = useState<'loading' | 'anon' | 'forbidden' | 'ok'>('loading');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPhase('anon');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role === 'admin') {
      setCurrentUserId(user.id);
      setPhase('ok');
    } else {
      setPhase('forbidden');
    }
  };

  useEffect(() => {
    checkRole();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      await checkRole();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[var(--text-secondary)]">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  if (phase === 'ok') return <Admin userId={currentUserId} />;

  return (
    <div className="flex items-center justify-center p-4 min-h-[70vh]">
      <div className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-5 space-y-4 shadow-sm">
        <div className="text-center space-y-1.5">
          <div className="w-10 h-10 mx-auto rounded-md bg-[var(--accent)] text-white flex items-center justify-center shadow-xs">
            <MorphIcon icon={Code2Data} size={20} />
          </div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Quản Trị CodeJudge</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {phase === 'forbidden'
              ? 'Tài khoản này không có quyền quản trị hệ thống'
              : 'Chỉ dành cho Quản trị viên. Đăng nhập để tiếp tục.'}
          </p>
        </div>

        {phase === 'forbidden' && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] font-medium">
            <MorphIcon icon={LockData} size={14} className="shrink-0 mt-0.5" />
            Tài khoản của bạn không phải admin. Giáo viên vui lòng sử dụng Cổng Giáo Viên trên trang chủ.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Mật Khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] font-medium animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <MorphIcon icon={LogInData} size={14} /> {busy ? 'Đang Đăng Nhập...' : 'Đăng Nhập'}
          </button>

          {phase === 'forbidden' && (
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                setPhase('anon');
              }}
              className="w-full text-center text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Đăng xuất và thử tài khoản khác
            </button>
          )}
        </form>

        <div className="pt-2 text-center border-t border-[var(--border)]">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <MorphIcon icon={ArrowLeftData} size={13} /> Về Trang Chủ Học Sinh
          </Link>
        </div>
      </div>
    </div>
  );
}