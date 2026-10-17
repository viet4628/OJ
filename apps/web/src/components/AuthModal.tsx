import { useState, useEffect } from 'react';
import MorphIcon from './MorphIcon';
import {
  X as XData,
  LogIn as LogInData,
  Mail as MailData,
  Lock as LockData,
  User as UserData,
  Code2 as Code2Data,
  AlertCircle as AlertCircleData,
  CheckCircle2 as CheckCircle2Data,
  Loader2 as Loader2Data,
  KeyRound as KeyRoundData,
} from 'lucide';
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
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() || email.split('@')[0] },
          },
        });
        if (signUpError) throw signUpError;
        setNotice('Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.');
        setMode('login');
        return;
      }

      // mode === 'login'
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      className="flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'forgot' ? 'Đặt lại mật khẩu' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
        className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-2xl overflow-hidden p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[var(--accent)] text-white flex items-center justify-center">
              <MorphIcon icon={Code2Data} size={15} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[var(--text-primary)]">
                {mode === 'forgot' ? 'Đặt Lại Mật Khẩu' : mode === 'register' ? 'Tạo Tài Khoản' : 'Đăng Nhập'}
              </h2>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">CodeJudge VN</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] font-medium" role="alert">
            <MorphIcon icon={AlertCircleData} size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--accent-text)] font-medium" role="status">
            <MorphIcon icon={CheckCircle2Data} size={14} className="shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Tên Người Dùng</label>
              <div className="relative">
                <MorphIcon icon={UserData} size={14} className="text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="viet4628"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-[var(--text-secondary)]">Địa Chỉ Email</label>
            <div className="relative">
              <MorphIcon icon={MailData} size={14} className="text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoFocus={mode !== 'register'}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[var(--text-secondary)]">Mật Khẩu</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); setNotice(null); }}
                    className="text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <div className="relative">
                <MorphIcon icon={LockData} size={14} className="text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors"
                />
              </div>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
              <MorphIcon icon={KeyRoundData} size={13} className="shrink-0 mt-0.5 text-[var(--accent-text)]" />
              Nhập email đã đăng ký — hệ thống sẽ gửi liên kết đặt lại mật khẩu.
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <MorphIcon icon={Loader2Data} size={14} className="animate-spin" /> : mode === 'forgot' ? <MorphIcon icon={KeyRoundData} size={14} /> : <MorphIcon icon={LogInData} size={14} />}
            {isLoading ? 'Đang xử lý...' : mode === 'forgot' ? 'Gửi Email Đặt Lại' : mode === 'register' ? 'Tạo Tài Khoản' : 'Đăng Nhập'}
          </button>
        </form>

        <div className="pt-2.5 border-t border-[var(--border)] text-center text-[11px] text-[var(--text-secondary)]">
          {mode === 'forgot' ? (
            <span>
              Đã nhớ lại mật khẩu?{' '}
              <button onClick={() => { setMode('login'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-medium hover:underline cursor-pointer">
                Đăng nhập
              </button>
            </span>
          ) : mode === 'register' ? (
            <span>
              Đã có tài khoản?{' '}
              <button onClick={() => { setMode('login'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-medium hover:underline cursor-pointer">
                Đăng nhập
              </button>
            </span>
          ) : (
            <span>
              Chưa có tài khoản?{' '}
              <button onClick={() => { setMode('register'); setError(null); setNotice(null); }} className="text-[var(--accent-text)] font-medium hover:underline cursor-pointer">
                Đăng ký tài khoản mới
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}