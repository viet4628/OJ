import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, Lock, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { changePassword, supabase } from '../../lib/api';

export default function ResetPassword() {
  const [phase, setPhase] = useState<'checking' | 'ready' | 'done' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 10; i++) {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setPhase('ready');
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) setPhase('invalid');
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Hai mật khẩu không khớp');
      return;
    }
    setBusy(true);
    const res = await changePassword(password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Đổi mật khẩu thất bại');
      return;
    }
    setPhase('done');
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[var(--border)] rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center shadow-sm">
            <Code2 className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-black text-[var(--text-primary)]">Đặt Lại Mật Khẩu</h1>
          <p className="text-xs text-[var(--text-secondary)]">CodeJudge VN — Supabase Auth</p>
        </div>

        {phase === 'checking' && (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-secondary)] font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang xác thực liên kết đặt lại mật khẩu...
          </div>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu gửi lại email đặt lại mật khẩu.
            </div>
            <Link to="/" className="block text-center text-xs font-bold text-[var(--accent-text)] hover:underline">
              ← Về trang chủ để đăng nhập lại
            </Link>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              Đã đổi mật khẩu thành công! Giờ bạn có thể đăng nhập bằng mật khẩu mới.
            </div>
            <Link to="/" className="block text-center px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors">
              Về trang chủ
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Mật Khẩu Mới</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoFocus
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Nhập Lại Mật Khẩu</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {busy ? 'Đang Lưu...' : 'Xác Nhận Mật Khẩu Mới'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
