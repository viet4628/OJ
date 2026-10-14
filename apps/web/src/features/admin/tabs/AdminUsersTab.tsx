import { useEffect, useState } from 'react';
import {
  UserRound,
  CheckCircle2,
  Lock,
  GraduationCap,
  KeyRound,
  X,
  Save,
} from 'lucide-react';
import {
  getProfiles,
  updateProfileRole,
  getUserPermissions,
  setUserPermissions,
  PERMISSION_DEFS,
  DEFAULT_TEACHER_PERMS,
  type Profile,
} from '../../../lib/api';

const PERMISSION_GROUPS = [...new Set(PERMISSION_DEFS.map((d) => d.group))];

interface AdminUsersTabProps {
  myUserId: string | null;
}

export default function AdminUsersTab({ myUserId }: AdminUsersTabProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  /* permission modal */
  const [permUser, setPermUser] = useState<Profile | null>(null);
  const [permCodes, setPermCodes] = useState<string[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProfiles()
      .then((list) => {
        if (!cancelled) setProfiles(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Không tải được danh sách');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleRole = async (p: Profile) => {
    const next: Profile['role'] = p.role === 'teacher' ? 'user' : 'teacher';
    setBusyUserId(p.id);
    setError(null);
    setNotice(null);
    try {
      await updateProfileRole(p.id, next);
      if (next === 'teacher') {
        const existing = await getUserPermissions(p.id);
        if (existing.length === 0) {
          await setUserPermissions(p.id, DEFAULT_TEACHER_PERMS);
        }
      }
      setProfiles((prev) => prev.map((u) => (u.id === p.id ? { ...u, role: next } : u)));
      setNotice(`Đã đổi vai trò "${p.full_name || p.email}" thành ${next === 'teacher' ? 'GIÁO VIÊN' : 'HỌC SINH'}`);
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật quyền');
    } finally {
      setBusyUserId(null);
    }
  };

  const openPermModal = async (p: Profile) => {
    setPermUser(p);
    setPermError(null);
    setPermLoading(true);
    setPermCodes([]);
    try {
      setPermCodes(await getUserPermissions(p.id));
    } catch (err: any) {
      setPermError(err.message);
    } finally {
      setPermLoading(false);
    }
  };

  const togglePerm = (code: string) => {
    setPermCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const savePerms = async () => {
    if (!permUser) return;
    setPermSaving(true);
    setPermError(null);
    try {
      await setUserPermissions(permUser.id, permCodes);
      setNotice(`Đã lưu phân quyền cho "${permUser.full_name || permUser.email}"`);
      setPermUser(null);
    } catch (err: any) {
      setPermError(err.message || 'Không lưu được phân quyền');
    } finally {
      setPermSaving(false);
    }
  };

  const visibleProfiles = profiles.filter((p) => p.id !== myUserId);

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <UserRound className="w-4 h-4 text-[var(--accent-text)]" /> Quản Lý Người Dùng
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Đổi vai trò Học Sinh ⇄ Giáo Viên, hoặc mở Phân Quyền để cấp quyền chi tiết (RBAC).
          </p>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-code">{profiles.length} người dùng</span>
      </div>

      {notice && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--accent-text)]" /> {notice}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold animate-fade-in">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-secondary)] uppercase text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px]">
              <tr>
                <th className="px-4 py-3">Người Dùng</th>
                <th className="px-4 py-3">Vai Trò</th>
                <th className="px-4 py-3">Tham Gia</th>
                <th className="px-4 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visibleProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[11px] font-black text-[var(--accent-text)] shrink-0">
                        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--text-primary)] truncate">{p.full_name || 'Chưa đặt tên'}</div>
                        <div className="font-code text-[11px] text-[var(--text-muted)] truncate">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.role === 'admin'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : p.role === 'teacher'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-sky-50 text-sky-700 border-sky-200'
                      }`}
                    >
                      {p.role === 'admin' ? (
                        <>
                          <Lock className="w-3 h-3" /> ADMIN
                        </>
                      ) : p.role === 'teacher' ? (
                        <>
                          <GraduationCap className="w-3 h-3" /> GIÁO VIÊN
                        </>
                      ) : (
                        <>
                          <UserRound className="w-3 h-3" /> HỌC SINH
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] font-code">
                    {new Date(p.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.role === 'admin' ? (
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold">Quản DB</span>
                      ) : (
                        <>
                          <button
                            onClick={() => openPermModal(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Phân Quyền
                          </button>
                          <button
                            onClick={() => handleToggleRole(p)}
                            disabled={busyUserId === p.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                              p.role === 'teacher'
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            {busyUserId === p.id ? 'Đang Lưu...' : p.role === 'teacher' ? 'Thu hồi → HS' : 'Cấp GV'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* permission modal */}
      {permUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setPermUser(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-[var(--border)] p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[var(--accent-text)]" /> Phân Quyền
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{permUser.full_name || permUser.email}</p>
              </div>
              <button
                onClick={() => setPermUser(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {permLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group} className="space-y-1.5">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">{group}</p>
                    {PERMISSION_DEFS.filter((d) => d.group === group).map((d) => (
                      <label
                        key={d.code}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]"
                      >
                        <input
                          type="checkbox"
                          checked={permCodes.includes(d.code)}
                          onChange={() => togglePerm(d.code)}
                          className="accent-[var(--accent)]"
                        />
                        {d.label}
                        <span className="ml-auto font-code text-[10px] text-[var(--text-muted)]">{d.code}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {permError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold">{permError}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setPermUser(null)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={savePerms}
                disabled={permSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {permSaving ? 'Đang Lưu...' : 'Lưu Quyền'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

