import { useState, useEffect } from 'react';
import { X, LogIn, Mail, Lock, User, Code2, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { supabase, sendPasswordResetEmail } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);

    try {
      if (mode === 'forgot') {
        const res = await sendPasswordResetEmail(email);
        if (!res.ok) throw new Error(res.error || 'Không gửi được email');
        setNotice('Đã gửi email hướng dẫn đặt lại mật khẩu. Kiểm tra hòm thư (kể cả Spam) rồi làm theo liên kết.');
        return;
      }

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: username || email.split('@')[0] } },
        });
        if (error) throw new Error(error.message);
        if (data.session) {
          onLoginSuccess();
          onClose();
        } else {
          setError(null);
          setNotice('Đã gửi email xác nhận đến hòm thư của bạn. Vui lòng xác nhận rồi đăng nhập.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      setNotice(null);
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      className="flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'forgot' ? 'Đặt lại mật khẩu' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--text-primary)] flex items-center justify-center">
              <Code2 className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 className="text-base font-black text-[var(--text-primary)]">
                {mode === 'forgot' ? 'Đặt Lại Mật Khẩu' : mode === 'register' ? 'Tạo Tài Khoản CodeJudge' : 'Đăng Nhập CodeJudge VN'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">Supabase Auth &amp; PostgreSQL</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-semibold animate-fade-in" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold animate-fade-in" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="font-bold text-[var(--text-secondary)]">Tên Tài Khoản (Username)</label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="viet4628"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-bold text-[var(--text-secondary)]">Địa Chỉ Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus={mode !== 'register'}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <label className="font-bold text-[var(--text-secondary)]">Mật Khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setNotice(null); }}
                  className="text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-800 font-medium">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Nhập email đã đăng ký — hệ thống sẽ gửi liên kết đặt lại mật khẩu.
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'forgot' ? <KeyRound className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {isLoading ? 'Đang xử lý...' : mode === 'forgot' ? 'Gửi Email Đặt Lại' : mode === 'register' ? 'Tạo Tài Khoản Ngay' : 'Đăng Nhập'}
          </button>
        </form>

        <div className="pt-3 border-t border-[var(--border)] text-center text-xs text-[var(--text-secondary)] font-medium">
          {mode === 'forgot' ? (
            <span>
              Đã nhớ lại mật khẩu?{' '}
              <button onClick={() => { setMode('login'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-bold hover:underline">
                Về đăng nhập
              </button>
            </span>
          ) : mode === 'register' ? (
            <span>
              Đã có tài khoản?{' '}
              <button onClick={() => { setMode('login'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-bold hover:underline">
                Đăng nhập tại đây
              </button>
            </span>
          ) : (
            <span>
              Chưa có tài khoản?{' '}
              <button onClick={() => { setMode('register'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-bold hover:underline">
                Tạo tài khoản mới
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}