import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, Clock, Search, Loader2, Lock, ChevronRight } from 'lucide-react';
import { getContests, type Contest } from '../../lib/api';

const STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: { label: 'Đang diễn ra', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse-glow' },
  NOT_STARTED: { label: 'Sắp diễn ra', className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  ENDED: { label: 'Đã kết thúc', className: 'bg-slate-50 text-slate-500 border-[var(--border)]', dot: 'bg-slate-400' },
};

export default function Contests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ruleFilter, setRuleFilter] = useState<string>('ALL');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setContests(await getContests());
      } catch (err) {
        console.error('Failed to load contests:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredContests = contests.filter(c => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesRule = ruleFilter === 'ALL' || c.rule_type === ruleFilter;
    const matchesKeyword = c.title.toLowerCase().includes(keyword.toLowerCase());
    return matchesStatus && matchesRule && matchesKeyword;
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDuration = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours} giờ${minutes > 0 ? ` ${minutes} phút` : ''}` : `${minutes} phút`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
            <Trophy className="w-5 h-5 text-amber-500" /> Đấu Trường Contest Trực Tuyến
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">Kỳ thi lập trình thi đấu theo tiêu chuẩn quốc tế ACM/ICPC & OI subtask</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Tất cả thể thức</option>
            <option value="ACM">ACM</option>
            <option value="OI">OI</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNDERWAY">Đang diễn ra</option>
            <option value="NOT_STARTED">Sắp diễn ra</option>
            <option value="ENDED">Đã kết thúc</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Keyword..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* QingdaoU Style Contest List (ol#contest-list) */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-[var(--text-secondary)] font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải danh sách contest...
          </div>
        ) : filteredContests.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-secondary)] py-10">
            {contests.length === 0 ? 'Chưa có contest nào được tạo (No contest)' : 'Không có contest phù hợp (No contest)'}
          </p>
        ) : (
          <ol className="divide-y divide-[var(--border)]">
            {filteredContests.map((c) => {
              const meta = STATUS_META[c.status];
              return (
                <li key={c.id} className="px-6 py-5 flex flex-wrap items-center gap-4 hover:bg-[var(--bg-secondary)]/50 transition-colors">
                  {/* Trophy Icon (like FE Cup.png) */}
                  <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-amber-500" />
                  </div>

                  <Link to={`/contests/${c.id}`} className="flex-1 min-w-0 block">
                    <p className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="hover:text-[var(--accent-text)] hover:border-b hover:border-[var(--accent-text)] transition-colors">
                        {c.title}
                      </span>
                      {!c.is_public && (
                        <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </p>

                    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-[var(--text-secondary)] font-code">
                      <li className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)]" /> {formatTime(c.start_time)}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" /> {getDuration(c.start_time, c.end_time)}
                      </li>
                      <li>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 font-bold text-[10px]">
                          {c.rule_type}
                        </span>
                      </li>
                    </ul>
                  </Link>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${meta.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label.toUpperCase()}
                    </span>
                    <Link
                      to={`/contests/${c.id}`}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
                    >
                      {c.status === 'UNDERWAY' ? 'Vào Đấu Trường' : c.status === 'NOT_STARTED' ? 'Xem Chi Tiết' : 'Xem Kết Quả'} <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}