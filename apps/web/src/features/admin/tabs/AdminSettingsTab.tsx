import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { Settings as SettingsData, Save as SaveData } from 'lucide';
import { getSettings, saveSettings } from '../../../lib/api';

const inputCls =
  'w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#0969da] focus:ring-1 focus:ring-[#0969da] transition-colors';
const labelCls = 'text-xs font-semibold text-[var(--text-secondary)]';

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const saveSettingsNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await saveSettings(settings);
    setSaving(false);
    setNotice(res.ok ? 'Đã lưu cấu hình' : res.error || 'Lưu thất bại');
  };

  return (
    <form onSubmit={saveSettingsNow} className="bg-[var(--bg-secondary)] p-4 rounded-md border border-[var(--border)] space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <h2 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <MorphIcon icon={SettingsData} size={14} className="text-[var(--accent-text)]" /> Cấu Hình Hệ Thống
        </h2>
        {notice && <span className="text-[11px] text-[var(--accent-text)] font-mono">{notice}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelCls}>Tên Website</label>
          <input
            type="text"
            value={settings.site_name || ''}
            onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Slogan / Mô Tả Website</label>
          <input
            type="text"
            value={settings.site_desc || ''}
            onChange={(e) => setSettings({ ...settings, site_desc: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Thời gian chấm mặc định (ms)</label>
          <input
            type="number"
            value={settings.default_time_ms || ''}
            onChange={(e) => setSettings({ ...settings, default_time_ms: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Bộ nhớ mặc định (MB)</label>
          <input
            type="number"
            value={settings.default_memory_mb || ''}
            onChange={(e) => setSettings({ ...settings, default_memory_mb: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelCls}>Footer</label>
          <input
            type="text"
            value={settings.footer || ''}
            onChange={(e) => setSettings({ ...settings, footer: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
      >
        <MorphIcon icon={SaveData} size={14} /> {saving ? 'Đang Lưu...' : 'Lưu Cấu Hình'}
      </button>
    </form>
  );
}
