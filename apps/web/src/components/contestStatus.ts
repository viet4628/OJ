import type { Contest } from '../lib/api';

/** Contest status chip styles shared by every contest list and detail page. */
export const CONTEST_STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: { label: 'Đang diễn ra', className: 'bg-accent/10 text-[var(--accent-text)] border-accent/30', dot: 'bg-[var(--accent)] animate-pulse' },
  NOT_STARTED: { label: 'Sắp diễn ra', className: 'bg-tertiary text-[var(--text-secondary)] border-[var(--border)]', dot: 'bg-[var(--text-muted)]' },
  ENDED: { label: 'Đã kết thúc', className: 'bg-tertiary text-[var(--text-muted)] border-[var(--border)]', dot: 'bg-[var(--border)]' },
};
