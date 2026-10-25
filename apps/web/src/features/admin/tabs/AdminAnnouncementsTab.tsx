import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { Trash2 as Trash2Data } from 'lucide';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from '../../../lib/api';

const inputCls =
  'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors';
const labelCls = 'text-xs font-semibold text-[var(--text-secondary)]';

export default function AdminAnnouncementsTab() {
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [annForm, setAnnForm] = useState({ tag: 'HỆ THỐNG', title: '', content: '', is_public: true });
  const [annSaving, setAnnSaving] = useState(false);
  const [annNotice, setAnnNotice] = useState<string | null>(null);
  const [annError, setAnnError] = useState<string | null>(null);

  const fetchAnns = () => {
    let cancelled = false;
    getAnnouncements().then((l) => {
      if (!cancelled) setAnns(l);
    });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return fetchAnns();
  }, []);

  const saveAnn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnSaving(true);
    setAnnError(null);
    const res = await createAnnouncement({
      tag: annForm.tag,
      title: annForm.title,
      content: annForm.content,
      author: 'Ban Quản Trị',
      is_public: annForm.is_public,
    });
    setAnnSaving(false);
    if (!res.ok) {
      setAnnError(res.error || 'Lỗi khi tạo thông báo');
      return;
    }
    setAnnNotice('Đã đăng thông báo thành công');
    setAnnForm({ tag: 'HỆ THỐNG', title: '', content: '', is_public: true });
    fetchAnns();
    setTimeout(() => setAnnNotice(null), 3000);
  };

  const handleDeleteAnn = async (id: string, title: string) => {
    if (!window.confirm(`Xác nhận xóa thông báo "${title}"?`)) return;
    const res = await deleteAnnouncement(id);
    if (res.ok) setAnns((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
           Quản Lý Thông Báo
        </h3>
        {annNotice && <span className="text-[11px] text-[var(--accent-text)] font-mono">{annNotice}</span>}
      </div>

      <form onSubmit={saveAnn} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)]">
        <div className="space-y-1">
          <label className={labelCls}>Nhãn (Tag)</label>
          <input
            type="text"
            value={annForm.tag}
            onChange={(e) => setAnnForm({ ...annForm, tag: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Tiêu Đề *</label>
          <input
            type="text"
            required
            value={annForm.title}
            onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
            placeholder="Bảo trì hệ thống"
            className={inputCls}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelCls}>Nội Dung *</label>
          <textarea
            rows={3}
            required
            value={annForm.content}
            onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
            className={`${inputCls} resize-y`}
          />
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={annForm.is_public}
              onChange={(e) => setAnnForm({ ...annForm, is_public: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Công khai cho học sinh
          </label>
          <button
            type="submit"
            disabled={annSaving}
            className="ml-auto px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {annSaving ? 'Đang Đăng...' : 'Đăng Thông Báo'}
          </button>
        </div>
        {annError && <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-[var(--danger)] text-[11px] font-medium md:col-span-2">{annError}</div>}
      </form>

      <div className="space-y-2">
        {anns.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.2 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] text-[10px] font-mono border border-[var(--accent)]/20">
                  {a.tag}
                </span>
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{a.title}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-1">{a.content}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {new Date(a.created_at).toLocaleDateString('vi-VN')}
              </span>
              <button
                onClick={() => handleDeleteAnn(a.id, a.title)}
                className="p-1 rounded text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Xóa thông báo"
              >
                <MorphIcon icon={Trash2Data} size={14} />
              </button>
            </div>
          </div>
        ))}
        {anns.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-4">Chưa có thông báo nào.</p>}
      </div>
    </div>
  );
}
