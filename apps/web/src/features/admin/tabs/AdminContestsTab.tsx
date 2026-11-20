import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import ContestProblemsEditor from '../components/ContestProblemsEditor';
import ContestRewardsEditor from '../components/ContestRewardsEditor';
import ContestRegistrationsDialog from '../components/ContestRegistrationsDialog';
import {
  Edit as EditData,
  Trash2 as Trash2Data,
  Search as SearchData,
  Plus as PlusData,
  ArrowLeft as ArrowLeftData,
} from 'lucide';
import {
  getContests,
  createContest,
  updateContest,
  deleteContest,
  type Contest,
} from '../../../lib/api';

const inputCls =
  'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors';
const emptyForm = { title: '', description: '', rule_type: 'ACM' as 'ACM' | 'OI', start_time: '', end_time: '', is_public: true, registration_required: false, freeze_at: '' };
const secondary = 'inline-flex items-center justify-center px-3 py-2 border border-[var(--border)] rounded-md text-xs hover:bg-[var(--bg-tertiary)] disabled:opacity-50';
const primary = `${secondary} bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white`;

export default function AdminContestsTab({ userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [contests, setContests] = useState<Contest[]>([]);
  const [registrationsContest, setRegistrationsContest] = useState<Contest | null>(null);
  const [contestForm, setContestForm] = useState({
    title: '',
    description: '',
    rule_type: 'ACM' as 'ACM' | 'OI',
    start_time: '',
    end_time: '',
    is_public: true,
    registration_required: false,
    freeze_at: '',
  });
  const [contestSaving, setContestSaving] = useState(false);
  const [contestNotice, setContestNotice] = useState<string | null>(null);
  const [contestError, setContestError] = useState<string | null>(null);
  const [contestEditingId, setContestEditingId] = useState<string | null>(null);

  const [problemSaving, setProblemSaving] = useState(false);

  const fetchContests = () => {
    let cancelled = false;
    setLoading(true); setLoadError('');
    getContests(isAdmin ? undefined : userId).then((l) => {
      if (!cancelled) setContests(l.filter(c => isAdmin || c.created_by === userId));
    }).catch(() => { if (!cancelled) setLoadError('Không tải được kỳ thi. Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return fetchContests();
  }, [userId, isAdmin]);

  const saveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contestSaving || problemSaving) return;
    setContestError(null);
    if (!contestForm.title.trim()) { setContestError('Tên kỳ thi không được để trống.'); return; }
    const start = new Date(contestForm.start_time).getTime();
    const end = new Date(contestForm.end_time).getTime();
    const freeze = contestForm.freeze_at ? new Date(contestForm.freeze_at).getTime() : null;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || (freeze !== null && (!Number.isFinite(freeze) || freeze < start || freeze >= end))) {
      setContestError('Thời gian kết thúc phải sau bắt đầu; mốc đóng băng phải nằm trong kỳ thi.');
      return;
    }
    setContestSaving(true);

    const payload = {
      title: contestForm.title.trim(),
      description: contestForm.description,
      rule_type: contestForm.rule_type,
      start_time: new Date(contestForm.start_time).toISOString(),
      end_time: new Date(contestForm.end_time).toISOString(),
      is_public: contestForm.is_public,
      registration_required: contestForm.registration_required,
      freeze_at: contestForm.freeze_at ? new Date(contestForm.freeze_at).toISOString() : null,
    };

    let res: { ok: boolean; error?: string; id?: string };
    if (contestEditingId) {
      res = await updateContest(contestEditingId, payload);
    } else {
      res = await createContest(payload);
    }
    setContestSaving(false);

    if (!res.ok) {
      setContestError(res.error || 'Lỗi khi lưu kỳ thi');
      return;
    }
    setContestNotice(contestEditingId ? 'Đã cập nhật kỳ thi' : 'Đã tạo kỳ thi mới');
    if (!contestEditingId && res.id) setContestEditingId(res.id);
    fetchContests();

  };

  const startEditContest = (c: Contest) => {
    if (!isAdmin && c.created_by !== userId) return;
    setEditorOpen(true);
    setContestError(null);
    setContestNotice(null);
    setContestEditingId(c.id);
    const toLocalISO = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setContestForm({
      title: c.title,
      description: c.description || '',
      rule_type: c.rule_type,
      start_time: toLocalISO(c.start_time),
      end_time: toLocalISO(c.end_time),
      is_public: c.is_public,
      registration_required: c.registration_required || false,
      freeze_at: c.freeze_at ? toLocalISO(c.freeze_at) : '',
    });
  };

  const handleDeleteContest = async (id: string, title: string) => {
    if (!window.confirm(`Xác nhận xóa kỳ thi "${title}"? Mọi bài nộp trong kỳ thi này sẽ bị xóa.`)) return;
    const res = await deleteContest(id);
    if (res.ok) setContests((prev) => prev.filter((c) => c.id !== id));
    else setContestNotice(res.error || 'Không xóa được kỳ thi.');
  };

  const filtered = contests.filter(c => c.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <div className="space-y-4 text-[var(--text-primary)]">
      {editorOpen ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {contestEditingId ? 'Chỉnh sửa kỳ thi' : 'Tạo kỳ thi mới'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Cấu hình thời gian, thể thức ACM/OI và quyền truy cập kỳ thi.
            </p>
          </div>
          <button
            type="button"
            disabled={contestSaving || problemSaving}
            onClick={() => setEditorOpen(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <MorphIcon icon={ArrowLeftData} size={13} /> Quay lại danh sách
          </button>
        </div>
        {contestNotice && <p role="status" className="text-sm text-[var(--accent)]">{contestNotice}</p>}
        <form onSubmit={saveContest} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md p-4 sm:p-5 space-y-5">
          <fieldset disabled={contestSaving || problemSaving} className="space-y-4 disabled:opacity-60">
            <legend className="font-semibold text-sm mb-3">Thông tin kỳ thi</legend>
            <label className="block text-xs space-y-1">Tên kỳ thi
              <input required maxLength={200} value={contestForm.title} onChange={e => setContestForm({ ...contestForm, title: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-xs space-y-1">Mô tả
              <textarea aria-label="Mô tả" rows={4} maxLength={20000} value={contestForm.description} onChange={e => setContestForm({ ...contestForm, description: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-xs space-y-1 max-w-sm">Thể thức
              <select aria-label="Thể thức" value={contestForm.rule_type} onChange={e => setContestForm({ ...contestForm, rule_type: e.target.value as 'ACM' | 'OI' })} className={inputCls}>
                <option value="ACM">ACM — số bài giải và thời gian phạt</option>
                <option value="OI">OI — tổng điểm cao nhất từng bài</option>
              </select>
            </label>
            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <h3 className="text-sm font-semibold">Lịch thi</h3>
              <p className="text-xs text-[var(--text-secondary)]">Múi giờ: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs space-y-1">Bắt đầu
                  <input type="datetime-local" required value={contestForm.start_time} onChange={e => setContestForm({ ...contestForm, start_time: e.target.value })} className={inputCls} />
                </label>
                <label className="block text-xs space-y-1">Kết thúc
                  <input type="datetime-local" required min={contestForm.start_time} value={contestForm.end_time} onChange={e => setContestForm({ ...contestForm, end_time: e.target.value })} className={inputCls} />
                </label>
              </div>
              <details open={contestForm.freeze_at ? true : undefined} className="text-xs">
                <summary className="cursor-pointer text-[var(--text-secondary)]">Tùy chọn bảng xếp hạng</summary>
                <label className="block mt-3 space-y-1 max-w-sm">Đóng băng bảng xếp hạng
                  <input type="datetime-local" min={contestForm.start_time} max={contestForm.end_time} value={contestForm.freeze_at} onChange={e => setContestForm({ ...contestForm, freeze_at: e.target.value })} className={inputCls} />
                </label>
                <p className="mt-1 text-[var(--text-muted)]">Để trống nếu không đóng băng. Bảng xếp hạng mở lại khi kỳ thi kết thúc.</p>
              </details>
            </div>
            <div className="border-t border-[var(--border)] pt-4 space-y-3 text-xs">
              <h3 className="text-sm font-semibold">Quyền tham gia</h3>
              <label className="flex items-center gap-2"><input type="checkbox" checked={contestForm.is_public} onChange={e => setContestForm({ ...contestForm, is_public: e.target.checked })} className="accent-[var(--accent)]" />Công khai</label>
              <p className="text-[var(--text-secondary)]">{contestForm.is_public ? 'Kỳ thi xuất hiện trong danh sách công khai.' : 'Chỉ người được mời và duyệt mới có thể tham gia.'}</p>
              {contestForm.is_public && <label className="flex items-center gap-2"><input type="checkbox" checked={contestForm.registration_required} onChange={e => setContestForm({ ...contestForm, registration_required: e.target.checked })} className="accent-[var(--accent)]" />Yêu cầu duyệt đăng ký</label>}
            </div>
          </fieldset>
          {contestError && <p role="alert" className="text-xs text-[var(--danger)]">{contestError}</p>}
          <div className="pt-3 border-t border-[var(--border)]"><button disabled={contestSaving || problemSaving} className={primary}>{contestSaving ? 'Đang lưu...' : contestEditingId ? 'Cập Nhật' : 'Lưu kỳ thi'}</button></div>
        </form>
        {contestEditingId ? <>
          <ContestProblemsEditor key={contestEditingId} contestId={contestEditingId} rule={contestForm.rule_type} disabled={contestSaving} onBusyChange={setProblemSaving} />
          <ContestRewardsEditor key={`rewards-${contestEditingId}`} contestId={contestEditingId} disabled={contestSaving}
            ended={!!contestForm.end_time && new Date(contestForm.end_time).getTime() <= Date.now()} />
        </> : <p className="text-xs text-[var(--text-secondary)]">Lưu thông tin kỳ thi để thêm bài thi và phần thưởng.</p>}
      </> : <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Quản Lý Kỳ Thi</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Tổ chức kỳ thi trực tuyến, kiểm soát đăng ký và cấu hình đề thi.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer w-fit shadow-xs border border-[rgba(27,31,36,0.15)]"
            onClick={() => {
              setContestEditingId(null);
              setContestForm(emptyForm);
              setContestError(null);
              setContestNotice(null);
              setEditorOpen(true);
            }}
          >
            <MorphIcon icon={PlusData} size={14} /> Tạo kỳ thi
          </button>
        </div>

        {contestNotice && (
          <div className="p-2.5 rounded-md bg-accent/10 border border-accent/25 text-xs text-[var(--accent-text)] font-medium">
            {contestNotice}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <MorphIcon icon={SearchData} size={13} />
          </div>
          <input
            type="text"
            aria-label="Tìm kỳ thi"
            placeholder="Tìm theo tên kỳ thi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-8`}
          />
        </div>

        {loadError && (
          <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
            {loadError} <button type="button" onClick={() => fetchContests()} className="underline ml-1 cursor-pointer">Thử lại</button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && !loadError && (
          <div className="overflow-x-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">Kỳ Thi</th>
                  <th className="px-4 py-2.5">Trạng Thái</th>
                  <th className="px-4 py-2.5">Thời Gian</th>
                  <th className="px-4 py-2.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((c) => {
                  const now = Date.now();
                  const start = new Date(c.start_time).getTime();
                  const end = new Date(c.end_time).getTime();
                  const isUnderway = now >= start && now <= end;
                  const isEnded = now > end;

                  return (
                    <tr key={c.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-xs text-[var(--text-primary)]">{c.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                          <span>{c.rule_type}</span>
                          <span>·</span>
                          <span className={c.is_public ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}>
                            {c.is_public ? 'Công khai' : 'Riêng tư'}
                          </span>
                          {c.registration_required && (
                            <>
                              <span>·</span>
                              <span className="text-[var(--accent-text)]">Yêu cầu duyệt</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                            isUnderway
                              ? 'bg-accent/10 text-[var(--accent-text)] border-accent/25'
                              : isEnded
                              ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border)]'
                          }`}
                        >
                          {isUnderway && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
                          {isUnderway ? 'Đang diễn ra' : isEnded ? 'Đã kết thúc' : 'Sắp diễn ra'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-[11px] whitespace-nowrap">
                        <p>{new Date(c.start_time).toLocaleString('vi-VN')}</p>
                        <p className="text-[var(--text-muted)]">đến {new Date(c.end_time).toLocaleString('vi-VN')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {(c.registration_required || !c.is_public) && (
                            <button
                              onClick={() => setRegistrationsContest(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
                            >
                              Duyệt đăng ký
                            </button>
                          )}
                          <button
                            aria-label="Chỉnh sửa kỳ thi"
                            title="Chỉnh sửa kỳ thi"
                            onClick={() => startEditContest(c)}
                            className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
                          >
                            <MorphIcon icon={EditData} size={14} />
                          </button>
                          <button
                            aria-label="Xóa kỳ thi"
                            title="Xóa kỳ thi"
                            onClick={() => handleDeleteContest(c.id, c.title)}
                            className="p-1.5 rounded-md text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                          >
                            <MorphIcon icon={Trash2Data} size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-[var(--text-muted)]">
                      {search ? 'Không có kỳ thi nào phù hợp với tìm kiếm.' : 'Chưa có kỳ thi nào được tạo.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </>}
      {registrationsContest && <ContestRegistrationsDialog contest={registrationsContest} onClose={() => setRegistrationsContest(null)} />}
    </div>
  );
}
