import { useEffect, useState } from 'react';
import { Code2, LogIn, Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getUserPermissions } from '../../lib/api';
import Admin from './Admin';

export default function AdminGate() {
  const [phase, setPhase] = useState<'loading' | 'anon' | 'forbidden' | 'ok'>('loading');
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
    setPhase(profile?.role === 'admin' ? 'ok' : 'forbidden');
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

  if (phase === 'ok') return <Admin />;

  return (
    <div className="flex items-center justify-center p-4 min-h-[70vh]">
      <div className="w-full max-w-md bg-white border border-[var(--border)] rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center shadow-sm">
            <Code2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-[var(--text-primary)]">Quản Trị CodeJudge</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {phase === 'forbidden'
              ? 'Tài khoản này không có quyền quản trị hệ thống'
              : 'Chỉ dành cho Quản trị viên. Đăng nhập để tiếp tục.'}
          </p>
        </div>

        {phase === 'forbidden' && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
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
              placeholder="teacher@example.com"
              className="w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
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
              className="w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" /> {busy ? 'Đang Đăng Nhập...' : 'Đăng Nhập'}
          </button>

          {phase === 'forbidden' && (
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                setPhase('anon');
              }}
              className="w-full text-center text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Đăng xuất và thử tài khoản khác
            </button>
          )}
        </form>

        <div className="pt-2 text-center border-t border-[var(--border)]">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Về Trang Chủ Học Sinh
          </a>
        </div>
      </div>
    </div>
  );
}