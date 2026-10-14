import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { getSettings, saveSettings } from '../../../lib/api';

const inputCls =
  'w-full bg-white border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors';
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
    <form onSubmit={saveSettingsNow} className="bg-white p-5 rounded-xl border border-[var(--border)] space-y-4">
      <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
        <Settings className="w-4 h-4 text-[var(--accent-text)]" /> System Configuration
      </h2>
      {notice && <span className="text-[11px] text-[var(--accent-text)] font-bold">{notice}</span>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <label className={labelCls}>Vip chấm thời gian mặc định (ms)</label>
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
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Save className="w-4 h-4" /> {saving ? 'Đang Lưu...' : 'Lưu Cấu Hình'}
      </button>
    </form>
  );
}

