import { useEffect, useRef, useState } from 'react';
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
    getContestRegistrations(contest.id).then(setRows).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [contest.id]);
  const review = async (id: string, approved: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await reviewContestRegistration(contest.id, id.trim(), approved);
      setRows(await getContestRegistrations(contest.id));
      setUserId('');
    } catch (err: any) { setError(err.message || 'Không cập nhật được đăng ký'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="registrations-title" onClose={onClose}
    onCancel={event => { if (busy) event.preventDefault(); }}
    className="w-[calc(100%_-_2rem)] max-w-2xl max-h-[85vh] rounded-lg p-5 border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] backdrop:bg-black/50 space-y-4">
    <div className="flex justify-between items-center"><h2 id="registrations-title" className="font-semibold">Đăng ký dự thi</h2>
      <button disabled={busy} onClick={() => dialog.current?.close()} className="border border-[var(--border)] px-3 py-1 rounded">Đóng</button></div>
    <p className="text-xs text-[var(--text-secondary)]">{contest.title}. Với kỳ thi riêng tư, mời học sinh bằng ID tài khoản.</p>
    {error && <p role="alert" className="text-xs text-[var(--danger)]">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void review(userId, true); }} className="flex flex-wrap gap-2 text-xs">
      <label className="flex-1">ID học sinh<input required value={userId} onChange={event => setUserId(event.target.value)} className="block w-full p-2 border border-[var(--border)] rounded bg-[var(--bg-primary)]" /></label>
      <button disabled={busy || !userId.trim()} className="self-end border border-[var(--border)] rounded px-3 py-2 disabled:opacity-50">Mời tham gia</button>
    </form>
    {loading ? <p role="status">Đang tải đăng ký...</p> : rows.length === 0 ? <p className="text-xs">Chưa có đăng ký.</p> :
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Học sinh</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.user_id} className="border-t border-[var(--border)]">
          <td className="py-3">{row.profile?.full_name || row.user_id}</td><td className="text-center">{row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'PENDING' ? 'Chờ duyệt' : 'Từ chối'}</td>
          <td className="text-right space-x-2"><button disabled={busy || row.status === 'APPROVED'} onClick={() => review(row.user_id, true)}>Duyệt</button>
            <button disabled={busy || row.status === 'REJECTED'} onClick={() => review(row.user_id, false)}>Từ chối</button></td>
        </tr>)}
      </tbody></table></div>}
  </dialog>;
}
