import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { GraduationCap as GraduationCapData, KeyRound as KeyRoundData, X as XData, Save as SaveData } from 'lucide';
import {
  getProfiles,
  setAccountSuspension,
  getAdminAuditLog,
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
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof getAdminAuditLog>> | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditMore, setAuditMore] = useState(false);
  const loadAudit = async (page = 0) => {
    setAuditBusy(true);
    setError(null);
    try {
      const rows = await getAdminAuditLog(page);
      setAudit(previous => page === 0 ? rows : [...(previous || []), ...rows]);
      setAuditPage(page);
      setAuditMore(rows.length === 50);
    } catch (err: any) { setError(err.message || 'Không tải được nhật ký'); }
    finally { setAuditBusy(false); }
  };

  // RBAC Permission Modal State
  const [permUser, setPermUser] = useState<Profile | null>(null);
  const [permCodes, setPermCodes] = useState<string[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  const fetchUsers = () => {
    let cancelled = false;
    setLoading(true);
    getProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không thể tải danh sách người dùng');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return fetchUsers();
  }, []);

  const handleToggleRole = async (target: Profile) => {
    if (target.id === myUserId) {
      alert('Không thể tự thay đổi vai trò của chính mình.');
      return;
    }
    const nextRole: 'user' | 'teacher' = target.role === 'teacher' ? 'user' : 'teacher';
    const actionName = nextRole === 'teacher' ? 'nâng lên Giáo Viên' : 'hạ xuống Học Sinh';
    if (!window.confirm(`Xác nhận ${actionName} cho tài khoản "${target.full_name || target.email}"?`)) {
      return;
    }
    setBusyUserId(target.id);
    try {
      await updateProfileRole(target.id, nextRole);
      setNotice(`Đã đổi vai trò của "${target.full_name || target.email}" thành ${nextRole === 'teacher' ? 'Giáo Viên' : 'Học Sinh'}.`);
      fetchUsers();
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Thao tác thất bại');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleSuspension = async (target: Profile) => {
    const reason = window.prompt(`Lý do ${target.is_suspended ? 'mở khóa' : 'khóa'} tài khoản "${target.full_name || target.email}" (1–500 ký tự):`);
    if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 500) { setError('Lý do cần có từ 1 đến 500 ký tự.'); return; }
    setBusyUserId(target.id);
    setError(null);
    try {
      const result = await setAccountSuspension(target.id, !target.is_suspended, reason.trim());
      setProfiles(rows => rows.map(row => row.id === target.id ? { ...row, is_suspended: !target.is_suspended } : row));
      setNotice(target.is_suspended ? 'Đã mở khóa tài khoản.' : `Đã khóa tài khoản, thu hồi ${result.revoked_sessions || 0} phiên đăng nhập.`);
    } catch (err: any) { setError(err.message || 'Không cập nhật được trạng thái tài khoản'); }
    finally { setBusyUserId(null); }
  };

  const openPermModal = async (u: Profile) => {
    setPermUser(u);
    setPermLoading(true);
    setPermError(null);
    try {
      const perms = await getUserPermissions(u.id);
      setPermCodes(perms);
    } catch {
      setPermError('Không thể tải quyền của người dùng');
    } finally {
      setPermLoading(false);
    }
  };

  const togglePerm = (code: string) => {
    setPermCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const savePerms = async () => {
    if (!permUser) return;
    setPermSaving(true);
    setPermError(null);
    try {
      await setUserPermissions(permUser.id, permCodes);
      setNotice(`Đã cập nhật ${permCodes.length} quyền cho ${permUser.full_name || permUser.email}`);
      setPermUser(null);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setPermError(err.message || 'Lỗi khi lưu phân quyền');
    } finally {
      setPermSaving(false);
    }
  };

  const visibleProfiles = profiles;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
             Quản Lý Người Dùng
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Đổi vai trò Học Sinh ⇄ Giáo Viên, hoặc mở Phân Quyền để cấp quyền chi tiết.
          </p>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] font-mono">{profiles.length} người dùng</span>
      </div>

      {notice && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--accent-text)] font-medium">
           {notice}
        </div>
      )}
      {error && (
        <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-[var(--danger)] font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-[var(--bg-primary)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
              <tr>
                <th className="px-3 py-2">Người Dùng</th>
                <th className="px-3 py-2">Vai Trò</th>
                <th className="px-3 py-2">Tham Gia</th>
                <th className="px-3 py-2 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visibleProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[10px] font-mono text-[var(--accent-text)] shrink-0">
                        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">{p.full_name || 'Chưa đặt tên'}</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] truncate">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                        p.role === 'admin'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)]'
                          : p.role === 'teacher'
                          ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border-[var(--accent)]/30'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {p.role === 'admin' ? (
                        <>
                           ADMIN
                        </>
                      ) : p.role === 'teacher' ? (
                        <>
                           GIÁO VIÊN
                        </>
                      ) : (
                        <>
                           HỌC SINH
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)] font-mono text-[11px]">
                    {new Date(p.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.role === 'admin' ? (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Quản DB</span>
                      ) : (
                        <>
                          <button onClick={() => handleSuspension(p)} disabled={busyUserId === p.id || p.id === myUserId} className="px-2 py-0.5 rounded border border-[var(--border)] text-xs disabled:opacity-50">
                            {p.is_suspended ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          </button>
                          <button
                            onClick={() => openPermModal(p)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            <MorphIcon icon={KeyRoundData} size={11} className="text-[var(--accent-text)]" /> Phân Quyền
                          </button>
                          <button
                            onClick={() => handleToggleRole(p)}
                            disabled={busyUserId === p.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                              p.role === 'teacher'
                                ? 'bg-red-500/10 text-[var(--danger)] border-red-500/20 hover:bg-red-500/20'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                          >
                            <MorphIcon icon={GraduationCapData} size={11} />
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
      <section className="space-y-3 border-t border-[var(--border)] pt-3">
        <button disabled={auditBusy} onClick={() => loadAudit()} className="border border-[var(--border)] rounded px-3 py-1.5 text-xs disabled:opacity-50">Xem nhật ký quản trị</button>
        {audit && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Người thực hiện</th><th>Đối tượng</th><th>Lý do / kết quả trước</th></tr></thead><tbody>
          {audit.map(row => <tr key={row.id} className="border-t border-[var(--border)]">
            <td className="p-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString('vi-VN')}</td>
            <td className="p-2">{({ 'account.suspend': 'Khóa tài khoản', 'account.restore': 'Mở khóa', 'submission.rejudge': 'Chấm lại', 'profile.role': 'Đổi vai trò', 'permissions.change': 'Đổi quyền' } as Record<string, string>)[row.action] || 'Thao tác quản trị'}</td>
            <td className="p-2 font-mono" title={row.actor_id || ''}>{row.actor_id?.slice(0, 8) || 'Hệ thống'}</td>
            <td className="p-2 font-mono" title={row.target_id || ''}>{row.target_id?.slice(0, 8)}</td>
            <td className="p-2">{String(row.payload.reason || row.payload.previous_status || '')}</td>
          </tr>)}
        </tbody></table>{audit.length === 0 && <p className="py-3 text-xs">Chưa có nhật ký.</p>}</div>}
        {auditMore && <button disabled={auditBusy} onClick={() => loadAudit(auditPage + 1)} className="border border-[var(--border)] rounded px-3 py-1.5 text-xs">Tải thêm nhật ký</button>}
      </section>
      {permUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setPermUser(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] shadow-2xl p-4 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div>
                <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                   Phân Quyền
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{permUser.full_name || permUser.email}</p>
              </div>
              <button
                onClick={() => setPermUser(null)}
                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <MorphIcon icon={XData} size={16} />
              </button>
            </div>

            {permLoading ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-9 rounded-md bg-[var(--bg-primary)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group} className="space-y-1">
                    <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{group}</p>
                    {PERMISSION_DEFS.filter((d) => d.group === group).map((d) => (
                      <label
                        key={d.code}
                        className="flex items-center gap-2 p-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]"
                      >
                        <input
                          type="checkbox"
                          checked={permCodes.includes(d.code)}
                          onChange={() => togglePerm(d.code)}
                          className="accent-[var(--accent)]"
                        />
                        {d.label}
                        <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)]">{d.code}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {permError && (
              <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-[11px] font-medium">{permError}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--border)]">
              <button
                onClick={() => setPermUser(null)}
                className="px-3 py-1.5 rounded-md bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs font-medium border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={savePerms}
                disabled={permSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <MorphIcon icon={SaveData} size={14} /> {permSaving ? 'Đang Lưu...' : 'Lưu Quyền'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
