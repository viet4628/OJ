import { useEffect, useState } from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from '../../../lib/api';

const inputCls =
  'w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
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
      author: 'Admin',
      is_public: annForm.is_public,
    });
    setAnnSaving(false);
    if (!res.ok) {
      setAnnError(res.error || 'Lưu thất bại');
      return;
    }
    setAnnForm({ tag: 'HỆ THỐNG', title: '', content: '', is_public: true });
    setAnnNotice('Đã đăng thông báo');
    fetchAnns();
  };

  const handleDeleteAnn = async (id: string, title: string) => {
    if (!window.confirm(`Xóa thông báo "${title}"?`)) return;
    const res = await deleteAnnouncement(id);
    setAnnNotice(res.ok ? 'Đã xóa thông báo' : res.error || 'Xóa thất bại');
    if (res.ok) setAnns((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[var(--accent-text)]" /> Quản Lý Thông Báo
        </h3>
        {annNotice && <span className="text-[11px] text-[var(--accent-text)] font-bold">{annNotice}</span>}
      </div>

      <form onSubmit={saveAnn} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
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
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={annForm.is_public}
              onChange={(e) => setAnnForm({ ...annForm, is_public: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Công khai
          </label>
          <button
            type="submit"
            disabled={annSaving}
            className="ml-auto px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {annSaving ? 'Đang Đăng...' : 'Đăng Thông Báo'}
          </button>
        </div>
        {annError && <div className="p-2 rounded-lg bg-red-50 text-red-700 text-[11px] font-semibold">{annError}</div>}
      </form>

      <div className="space-y-2">
        {anns.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] text-[10px] font-bold border border-[var(--accent)]/20">
                  {a.tag}
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{a.title}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">{a.content}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-[var(--text-muted)] font-code">
                {new Date(a.created_at).toLocaleDateString('vi-VN')}
              </span>
              <button
                onClick={() => handleDeleteAnn(a.id, a.title)}
                className="p-1.5 rounded-lg bg-red-50 text-[var(--danger)] hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {anns.length === 0 && <p className="text-xs text-[var(--text-muted)] text-center py-4">Chưa có thông báo nào.</p>}
      </div>
    </div>
  );
}

