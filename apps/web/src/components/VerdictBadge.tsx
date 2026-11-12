import { Loader2 } from 'lucide-react';

// One verdict palette for the whole app: the accent for AC, status tokens for
// failures. Unknown states show their raw name instead of looking "pending".
const DANGER = 'text-danger bg-danger/10 border-danger/30';
const WARNING = 'text-warning bg-warning/10 border-warning/30';

const VERDICTS: Record<string, { short: string; long: string; tone: string }> = {
  ACCEPTED: { short: 'AC', long: 'Accepted', tone: 'text-[var(--accent-text)] bg-accent/10 border-accent/30' },
  WRONG_ANSWER: { short: 'WA', long: 'Wrong Answer', tone: DANGER },
  COMPILE_ERROR: { short: 'CE', long: 'Compile Error', tone: DANGER },
  RUNTIME_ERROR: { short: 'RE', long: 'Runtime Error', tone: DANGER },
  TIME_LIMIT_EXCEEDED: { short: 'TLE', long: 'Time Limit Exceeded', tone: WARNING },
  MEMORY_LIMIT_EXCEEDED: { short: 'MLE', long: 'Memory Limit Exceeded', tone: WARNING },
  SYSTEM_ERROR: { short: 'SE', long: 'Lỗi hệ thống', tone: DANGER },
};

const IN_PROGRESS: Record<string, string> = { PENDING: 'Đang chờ', JUDGING: 'Đang chấm' };

const BASE = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold';

export default function VerdictBadge({ status, long = false }: { status: string; long?: boolean }) {
  const verdict = VERDICTS[status];
  if (verdict) {
    return <span title={verdict.long} className={`${BASE} ${verdict.tone}`}>{long ? verdict.long : verdict.short}</span>;
  }
  const progress = IN_PROGRESS[status];
  return (
    <span className={`${BASE} text-[var(--text-secondary)] bg-tertiary border-[var(--border)]`}>
      {progress && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {progress ?? status}
    </span>
  );
}
