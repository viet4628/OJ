import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import { Calendar as CalendarData, Clock as ClockData, Loader2 as Loader2Data, Lock as LockData, ChevronRight as ChevronRightData, Search as SearchData } from 'lucide';
import { getContests, type Contest } from '../../lib/api';
import { CONTEST_STATUS_META } from '../../components/contestStatus';

export default function Contests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ruleFilter, setRuleFilter] = useState<string>('ALL');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setContests(await getContests());
      } catch (err) {
        setLoadError('Không tải được kỳ thi. Vui lòng tải lại trang.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredContests = contests.filter((c) => {
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
    <div className="space-y-4">
      {loadError && <p role="alert" className="text-sm text-[var(--danger)]">{loadError}</p>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-secondary)] p-4 sm:p-5 rounded-md border border-[var(--border)] shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Kỳ thi lập trình trực tuyến
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            Đấu trường thi đấu theo thể thức ACM/ICPC và OI, xếp hạng và cập nhật điểm số theo thời gian thực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Lọc theo thể thức"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
          >
            <option value="ALL">Mọi thể thức</option>
            <option value="ACM">ACM/ICPC</option>
            <option value="OI">OI Subtask</option>
          </select>

          <div className="relative">
            <MorphIcon
              icon={SearchData}
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input aria-label="Tìm kỳ thi"
              type="text"
              placeholder="Tìm kỳ thi..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-36 sm:w-48 transition-colors shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Progsity Style Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {[
          { id: 'ALL', label: 'Tất cả kỳ thi' },
          { id: 'UNDERWAY', label: 'Đang diễn ra' },
          { id: 'NOT_STARTED', label: 'Sắp diễn ra' },
          { id: 'ENDED', label: 'Đã kết thúc' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold border border-[var(--border)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GitHub Box Style Contest List */}
      <div className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--text-secondary)]">
            <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải danh sách contest...
          </div>
        ) : filteredContests.length === 0 ? (
          <p className="text-center text-xs text-[var(--text-secondary)] py-10">
            {contests.length === 0 ? 'Chưa có kỳ thi nào được tạo' : 'Không có kỳ thi phù hợp với bộ lọc'}
          </p>
        ) : (
          <ol className="divide-y divide-[var(--border)]">
            {filteredContests.map((c) => {
              const meta = CONTEST_STATUS_META[c.status];
              return (
                <li key={c.id} className="p-4 flex flex-wrap items-center gap-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                  <Link to={`/contests/${c.id}`} className="flex-1 min-w-0 block">
                    <p className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 hover:text-[var(--accent-text)] transition-colors">
                      <span className="truncate">{c.title}</span>
                      {!c.is_public && (
                        <MorphIcon icon={LockData} size={12} className="text-[var(--text-muted)] shrink-0" />
                      )}
                    </p>

                    <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1 text-[11px] text-[var(--text-muted)] font-mono">
                      <li className="flex items-center gap-1">
                        <MorphIcon icon={CalendarData} size={11} /> {formatTime(c.start_time)}
                      </li>
                      <li className="flex items-center gap-1">
                        <MorphIcon icon={ClockData} size={11} /> {getDuration(c.start_time, c.end_time)}
                      </li>
                      <li>
                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)] text-[10px]">
                          {c.rule_type}
                        </span>
                      </li>
                    </ul>
                  </Link>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono ${meta.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label.toUpperCase()}
                    </span>
                    <Link
                      to={`/contests/${c.id}`}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shadow-xs cursor-pointer ${
                        c.status === 'UNDERWAY'
                          ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border border-[rgba(27,31,36,0.15)]'
                          : c.status === 'NOT_STARTED'
                          ? 'bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--accent-text)] border border-accent/40'
                          : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                      }`}
                    >
                      {c.status === 'UNDERWAY' ? 'Vào Thi' : c.status === 'NOT_STARTED' ? 'Chi Tiết' : 'Kết Quả'} <MorphIcon icon={ChevronRightData} size={12} />
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
