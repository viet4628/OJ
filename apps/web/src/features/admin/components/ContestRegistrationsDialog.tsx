import { useEffect, useRef, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { X as XData, UserCheck as UserCheckData, UserX as UserXData, UserPlus as UserPlusData } from 'lucide';
import { getContestRegistrations, reviewContestRegistration, type Contest } from '../../../lib/api';

export default function ContestRegistrationsDialog({ contest, onClose }: { contest: Contest; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getContestRegistrations>>>([]);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    getContestRegistrations(contest.id)
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contest.id]);

  const review = async (id: string, approved: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await reviewContestRegistration(contest.id, id.trim(), approved);
      setRows(await getContestRegistrations(contest.id));
      setUserId('');
    } catch (err: any) {
      setError(err.message || 'Không cập nhật được đăng ký');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="registrations-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      className="w-[calc(100%_-_2rem)] max-w-2xl max-h-[85vh] rounded-md p-5 border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] backdrop:bg-black/60 shadow-2xl space-y-4"
    >
      <div className="flex justify-between items-center pb-2.5 border-b border-[var(--border)]">
        <div>
          <h2 id="registrations-title" className="text-sm font-semibold text-[var(--text-primary)]">
            Duyệt Đăng Ký Dự Thi
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {contest.title} · Với kỳ thi riêng tư, mời học sinh bằng ID tài khoản.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => dialog.current?.close()}
          className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
          title="Đóng"
        >
          <MorphIcon icon={XData} size={16} />
        </button>
      </div>

      {error && (
        <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
          {error}
        </div>
      )}

      {/* Invite Form */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void review(userId, true);
        }}
        className="flex flex-col sm:flex-row items-end gap-2 p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-xs"
      >
        <label className="flex-1 w-full space-y-1">
          <span className="font-semibold text-[var(--text-secondary)]">Mời trực tiếp bằng ID học sinh</span>
          <input
            required
            placeholder="Nhập UUID học sinh..."
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] font-mono transition-colors"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !userId.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
        >
          <MorphIcon icon={UserPlusData} size={13} /> Mời tham gia
        </button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="space-y-2 py-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-[var(--bg-primary)] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
          Chưa có học sinh nào đăng ký tham gia kỳ thi này.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)] rounded-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
              <tr>
                <th className="px-3 py-2">Học Sinh</th>
                <th className="px-3 py-2 text-center">Trạng Thái</th>
                <th className="px-3 py-2 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.user_id} className="hover:bg-[var(--bg-primary)] transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--text-primary)]">{row.profile?.full_name || 'Chưa đặt tên'}</p>
                    <p className="font-mono text-[10px] text-[var(--text-muted)]">{row.user_id}</p>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                        row.status === 'APPROVED'
                          ? 'bg-accent/10 text-[var(--accent-text)] border-accent/25'
                          : row.status === 'PENDING'
                          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)]'
                          : 'bg-danger/10 text-[var(--danger)] border-danger/25'
                      }`}
                    >
                      {row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        disabled={busy || row.status === 'APPROVED'}
                        onClick={() => review(row.user_id, true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-accent/30 bg-accent/10 text-[var(--accent-text)] hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <MorphIcon icon={UserCheckData} size={11} /> Duyệt
                      </button>
                      <button
                        disabled={busy || row.status === 'REJECTED'}
                        onClick={() => review(row.user_id, false)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-danger/20 bg-danger/10 text-[var(--danger)] hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <MorphIcon icon={UserXData} size={11} /> Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </dialog>
  );
}
