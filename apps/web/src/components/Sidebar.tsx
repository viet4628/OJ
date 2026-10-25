import MorphIcon from './MorphIcon';
import { FileText as FileTextData, Trophy as TrophyData, History as HistoryData } from 'lucide';

type SidebarTab = 'description' | 'ranking' | 'history';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

const TABS: { id: SidebarTab; icon: any; label: string }[] = [
  { id: 'description', icon: FileTextData, label: 'Mô tả bài toán' },
  { id: 'ranking', icon: TrophyData, label: 'Bảng xếp hạng' },
  { id: 'history', icon: HistoryData, label: 'Lịch sử nộp bài' },
];

export type { SidebarTab };

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-11 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col items-center py-2.5 gap-1.5 select-none z-10 overflow-visible">
      {TABS.map(({ id, icon, label }) => {
        const isActive = activeTab === id;
        return (
          <div key={id} className="relative group">
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onFocus={(e) => e.target.blur()}
              onClick={() => onTabChange(id)}
              title={label}
              aria-current={isActive ? 'true' : undefined}
              className={`
                relative w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer
                ${isActive
                  ? 'text-[var(--accent-text)] bg-[var(--accent)]/10 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-[-5px] top-1.5 bottom-1.5 w-[2px] rounded-r-sm bg-[var(--accent)]" />
              )}
              <MorphIcon icon={icon} size={16} />
            </button>

            {/* Clean Popup Tooltip */}
            <div className="absolute left-11 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] text-[10px] font-medium rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {label}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
