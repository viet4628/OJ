import { FileText, Trophy, History, MessageCircle, Lightbulb } from 'lucide-react';

type SidebarTab = 'description' | 'ranking' | 'history' | 'discussion' | 'visualize';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

const TABS: { id: SidebarTab; icon: typeof FileText; label: string }[] = [
  { id: 'description', icon: FileText, label: 'Mô tả bài toán' },
  { id: 'ranking', icon: Trophy, label: 'Bảng xếp hạng' },
  { id: 'history', icon: History, label: 'Lịch sử nộp bài' },
  { id: 'discussion', icon: MessageCircle, label: 'Thảo luận' },
  { id: 'visualize', icon: Lightbulb, label: 'Trực quan hoá' },
];

export type { SidebarTab };

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-12 shrink-0 bg-white border-r border-[var(--border)] flex flex-col items-center py-3 gap-2 select-none z-10">
      {TABS.map(({ id, icon: Icon, label }) => {
        const isActive = activeTab === id;
        return (
          <div key={id} className="relative group">
            <button
              onClick={() => onTabChange(id)}
              title={label}
              aria-current={isActive ? 'true' : undefined}
              className={`
                relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150
                ${isActive
                  ? 'text-[var(--accent-text)] bg-[var(--accent)]/10 font-bold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-[-6px] top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--accent)]" />
              )}
              {/* Icon-only, NO text underneath! */}
              <Icon className="w-5 h-5 stroke-[2]" />
            </button>

            {/* Clean Popup Tooltip */}
            <div className="absolute left-12 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-semibold rounded-md shadow-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {label}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
