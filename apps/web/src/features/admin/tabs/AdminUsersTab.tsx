import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  GraduationCap as GraduationCapData,
  KeyRound as KeyRoundData,
  X as XData,
  Save as SaveData,
  Search as SearchData,
  FileText as FileTextData,
} from 'lucide';
import {
  getProfiles,
  setAccountSuspension,
  getAdminAuditLog,
  updateProfileRole,
  getUserPermissions,
  setUserPermissions,
  PERMISSION_DEFS,
  type Profile,
} from '../../../lib/api';
import { useEscapeKey } from '../../../lib/useEscapeKey';

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
  const [searchQuery, setSearchQuery] = useState('');
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
  useEscapeKey(permUser !== null, () => setPermUser(null));
  const [permCodes, setPermCodes] = useState<string[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'user' | 'teacher' | 'admin' | 'suspended'>('ALL');

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

  const query = searchQuery.trim().toLowerCase();
  const userCount = profiles.filter((p) => p.role === 'user' && !p.is_suspended).length;
  const teacherCount = profiles.filter((p) => p.role === 'teacher' && !p.is_suspended).length;
  const adminCount = profiles.filter((p) => p.role === 'admin' && !p.is_suspended).length;
  const suspendedCount = profiles.filter((p) => p.is_suspended).length;

  const visibleProfiles = profiles.filter((p) => {
    if (roleFilter === 'suspended') {
      if (!p.is_suspended) return false;
    } else if (roleFilter !== 'ALL') {
      if (p.role !== roleFilter || p.is_suspended) return false;
    }
    if (!query) return true;
    return (
      (p.full_name && p.full_name.toLowerCase().includes(query)) ||
      (p.email && p.email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Quản Lý Người Dùng
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Đổi vai trò Học Sinh ⇄ Giáo Viên, hoặc mở Phân Quyền để cấp quyền chi tiết.
          </p>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-mono self-start sm:self-auto">
          {profiles.length} tài khoản
        </span>
      </div>

      {notice && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-accent/10 border border-accent/30 text-xs text-[var(--accent-text)] font-medium">
          {notice}
        </div>
      )}
      {error && (
        <div className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
          {error}
        </div>
      )}

      {/* Search and Role Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <MorphIcon icon={SearchData} size={13} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email người dùng..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'ALL', label: `Tất cả (${profiles.length})` },
            { id: 'user', label: `Học sinh (${userCount})` },
            { id: 'teacher', label: `Giáo viên (${teacherCount})` },
            { id: 'admin', label: `Admin (${adminCount})` },
            { id: 'suspended', label: `Bị khóa (${suspendedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

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
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[11px] font-mono font-semibold text-[var(--accent-text)] shrink-0">
                        {(p.full_name || p.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate flex items-center gap-1.5">
                          <span>{p.full_name || 'Chưa đặt tên'}</span>
                          {p.is_suspended && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-danger/10 text-[var(--danger)] border border-danger/20 font-mono">
                              Khóa
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--text-muted)] truncate">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                        p.role === 'admin'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)]'
                          : p.role === 'teacher'
                          ? 'bg-accent/10 text-[var(--accent-text)] border-accent/30'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {p.role === 'admin' ? 'ADMIN' : p.role === 'teacher' ? 'GIÁO VIÊN' : 'HỌC SINH'}
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
                          <button
                            onClick={() => handleSuspension(p)}
                            disabled={busyUserId === p.id || p.id === myUserId}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                              p.is_suspended
                                ? 'bg-danger/10 text-[var(--danger)] border-danger/25 hover:bg-danger/20'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                            }`}
                            title={p.is_suspended ? 'Tài khoản đang bị khóa. Bấm để mở' : 'Khóa tài khoản'}
                          >
                            {p.is_suspended ? 'Mở khóa' : 'Khóa'}
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
                                ? 'bg-danger/10 text-[var(--danger)] border-danger/20 hover:bg-danger/20'
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
              {visibleProfiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-xs text-[var(--text-muted)]">
                    {searchQuery ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Log Section */}
      <section className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MorphIcon icon={FileTextData} size={14} className="text-[var(--text-secondary)]" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Nhật Ký Quản Trị (Audit Log)</h3>
          </div>
          <button
            disabled={auditBusy}
            onClick={() => loadAudit()}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            {auditBusy ? 'Đang tải...' : audit ? 'Làm mới nhật ký' : 'Tải nhật ký quản trị'}
          </button>
        </div>

        {audit && (
          <div className="overflow-x-auto border border-[var(--border)] rounded-md">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
                <tr>
                  <th className="px-3 py-2">Thời Gian</th>
                  <th className="px-3 py-2">Thao Tác</th>
                  <th className="px-3 py-2">Người Thực Hiện</th>
                  <th className="px-3 py-2">Đối Tượng</th>
                  <th className="px-3 py-2">Chi Tiết / Lý Do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {audit.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-[var(--text-muted)] font-mono text-[11px]">
                      {new Date(row.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {({
                          'account.suspend': 'Khóa tài khoản',
                          'account.restore': 'Mở khóa',
                          'submission.rejudge': 'Chấm lại',
                          'profile.role': 'Đổi vai trò',
                          'permissions.change': 'Đổi quyền',
                        } as Record<string, string>)[row.action] || 'Thao tác quản trị'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]" title={row.actor_id || ''}>
                      {row.actor_id?.slice(0, 8) || 'Hệ thống'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[var(--text-muted)]" title={row.target_id || ''}>
                      {row.target_id?.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {String(row.payload.reason || row.payload.previous_status || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {audit.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">Chưa có bản ghi nhật ký nào.</p>
            )}
          </div>
        )}
        {auditMore && (
          <button
            disabled={auditBusy}
            onClick={() => loadAudit(auditPage + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Tải thêm nhật ký
          </button>
        )}
      </section>

      {/* Permission modal */}
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
              <div className="p-2 rounded-md bg-danger/10 border border-danger/20 text-[var(--danger)] text-[11px] font-medium">{permError}</div>
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
