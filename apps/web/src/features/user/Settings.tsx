import { useRef, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import RewardCollection from './settings/RewardCollection';
import {
  changePassword, updateMyProfile, uploadAvatar, type AppUser,
} from '../../lib/api';

interface SettingsProps {
  user: AppUser | null;
  onOpenAuth: () => void;
  onProfileSaved: () => void;
}

export default function Settings({ user, onOpenAuth, onProfileSaved }: SettingsProps) {
  const [fullName, setFullName] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="py-24 text-center space-y-4">

        <p className="text-xs text-[var(--text-secondary)]">Bạn cần đăng nhập để cài đặt tài khoản</p>
        <button
          onClick={onOpenAuth}
          className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer"
        >
          Đăng Nhập Ngay
        </button>
      </div>
    );
  }

  const inputCls =
    'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
  const labelCls = 'text-xs font-semibold text-[var(--text-secondary)]';

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setProfileError(null);
    setProfileNotice(null);
    const up = await uploadAvatar(file);
    if (!up.ok || !up.url) {
      setProfileError(up.error || 'Tải ảnh lên thất bại');
      setAvatarUploading(false);
      return;
    }
    const saved = await updateMyProfile({ avatar_url: up.url });
    if (!saved.ok) {
      setProfileError(saved.error || 'Lưu ảnh đại diện thất bại');
      setAvatarUploading(false);
      return;
    }
    setAvatarUrl(up.url);
    setProfileNotice('Đã cập nhật ảnh đại diện');
    setAvatarUploading(false);
    onProfileSaved();
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    const res = await updateMyProfile({ full_name: fullName.trim() });
    setProfileSaving(false);
    if (!res.ok) {
      setProfileError(res.error || 'Lưu thất bại');
      return;
    }
    setProfileNotice('Đã lưu thông tin hồ sơ');
    onProfileSaved();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);
    if (password.length < 6) {
      setPwError('Mật khẩu tối thiểu 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setPwError('Hai mật khẩu không khớp');
      return;
    }
    setPwSaving(true);
    const res = await changePassword(password);
    setPwSaving(false);
    if (!res.ok) {
      setPwError(res.error || 'Đổi mật khẩu thất bại');
      return;
    }
    setPwNotice('Đã đổi mật khẩu thành công');
    setPassword('');
    setConfirm('');
  };

  const username = user?.username;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
           Cài Đặt Tài Khoản
        </h1>
        <p className="text-[var(--text-secondary)] text-xs mt-1">Quản lý hồ sơ cá nhân và bảo mật tài khoản</p>
      </div>

      {/* PROFILE SECTION */}
      <form onSubmit={handleSaveProfile} className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
           Hồ Sơ Cá Nhân
        </h2>

        {profileNotice && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-[var(--accent-text)] font-semibold animate-fade-in">
             {profileNotice}
          </div>
        )}
        {profileError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger font-semibold animate-fade-in">
             {profileError}
          </div>
        )}

        <div className="space-y-4">
          {/* Avatar upload */}
          <div>
            <label className={labelCls}>Ảnh đại diện (Avatar)</label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-16 h-16 rounded-full bg-accent/10 text-[var(--accent-text)] border border-accent/20 flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (username || user?.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  id="avatar-input"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarPick}
                  className="hidden"
                />
                <label
                  htmlFor="avatar-input"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
                >

                  {avatarUploading ? 'Đang tải lên...' : 'Đổi ảnh đại diện'}
                </label>
                <p className="text-[11px] text-[var(--text-muted)]">PNG, JPG, WEBP tối đa 2MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tên hiển thị</label>
            <input aria-label="Tên hiển thị"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={profileSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {profileSaving ? 'Đang Lưu...' : 'Lưu Hồ Sơ'}
          </button>
        </div>
      </form>

      {/* SECURITY SECTION */}
      <RewardCollection userId={user.id} />

      <form onSubmit={handleChangePassword} className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
           Bảo Mật — Đổi Mật Khẩu
        </h2>

        {pwNotice && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-[var(--accent-text)] font-semibold animate-fade-in">
             {pwNotice}
          </div>
        )}
        {pwError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger font-semibold animate-fade-in">
             {pwError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelCls}>Mật Khẩu Mới</label>
            <input aria-label="Mật Khẩu Mới"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Nhập Lại Mật Khẩu</label>
            <input aria-label="Nhập Lại Mật Khẩu"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={pwSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {pwSaving ? 'Đang Lưu...' : 'Cập Nhật Mật Khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}
