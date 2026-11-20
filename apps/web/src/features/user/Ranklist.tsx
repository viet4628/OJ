import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import { Loader2 as Loader2Data, Search as SearchData, Trophy as TrophyData } from 'lucide';
import { getRanklist, type RankUser } from '../../lib/api';

export default function Ranklist() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'OI' ? 'OI' : 'ACM';
  const [rankType, setRankType] = useState<'ACM' | 'OI'>(initialType);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<RankUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => { setPage(0); }, [search, rankType]);
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      getRanklist({ page, type: rankType, search }, controller.signal).then(rows => {
        if (!controller.signal.aborted) setUsers(rows);
      }).catch(() => { if (!controller.signal.aborted) setError('Không tải được bảng xếp hạng.'); })
        .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, rankType]);

  const filteredRank = users.map((user, index) => ({ ...user, rank: page * 50 + index + 1 }));

  return (
    <div className="space-y-4">
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-secondary)] p-4 sm:p-5 rounded-md border border-[var(--border)] shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <MorphIcon icon={TrophyData} size={18} className="text-[var(--accent-text)]" />
            <span>Bảng xếp hạng cao thủ</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            Tôn vinh các lập trình viên có số lượng bài giải và điểm số cao nhất trên hệ thống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ACM / OI Toggle */}
          <div className="bg-[var(--bg-primary)] p-0.5 rounded-md border border-[var(--border)] flex items-center gap-0.5 text-xs shadow-xs">
            <button
              onClick={() => setRankType('ACM')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                rankType === 'ACM'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              ACM Rank
            </button>
            <button
              onClick={() => setRankType('OI')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                rankType === 'OI'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              OI Subtask
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <MorphIcon
              icon={SearchData}
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input aria-label="Tìm tài khoản"
              type="text"
              placeholder="Tìm tài khoản..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-36 sm:w-48 transition-colors shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards (when page 0 and no active search) */}
      {page === 0 && !search && filteredRank.length >= 3 && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Rank #2 Silver */}
          <div className="order-2 md:order-1 p-4 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center text-center relative shadow-xs">
            <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-center absolute top-3 left-3">
              #2
            </div>
            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border)] text-[var(--text-primary)] font-bold flex items-center justify-center text-sm mb-2 shadow-xs">
              {(filteredRank[1].username || 'u').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-[150px]">
              {filteredRank[1].username}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
              <span className="text-[var(--accent-text)] font-semibold">{filteredRank[1].accepted_number} AC</span>
              <span>·</span>
              <span>{rankType === 'ACM' ? `${filteredRank[1].accepted_number * 10} pts` : `${filteredRank[1].total_score} pts`}</span>
            </div>
          </div>

          {/* Rank #1 Gold */}
          <div className="order-1 md:order-2 p-4 rounded-md border-2 border-accent/40 bg-[var(--bg-secondary)] flex flex-col items-center text-center relative shadow-xs">
            <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-white font-mono text-[11px] font-bold flex items-center justify-center absolute top-3 left-3 shadow-xs">
              #1
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/15 border-2 border-[var(--accent)] text-[var(--accent-text)] font-bold flex items-center justify-center text-sm mb-2 shadow-xs">
              {(filteredRank[0].username || 'u').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-[150px]">
              {filteredRank[0].username}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
              <span className="text-[var(--accent-text)] font-semibold">{filteredRank[0].accepted_number} AC</span>
              <span>·</span>
              <span className="font-semibold">{rankType === 'ACM' ? `${filteredRank[0].accepted_number * 10} pts` : `${filteredRank[0].total_score} pts`}</span>
            </div>
          </div>

          {/* Rank #3 Bronze */}
          <div className="order-3 md:order-3 p-4 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col items-center text-center relative shadow-xs">
            <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] font-mono text-[11px] font-bold text-[var(--text-secondary)] flex items-center justify-center absolute top-3 left-3">
              #3
            </div>
            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--border)] text-[var(--text-primary)] font-bold flex items-center justify-center text-sm mb-2 shadow-xs">
              {(filteredRank[2].username || 'u').charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-[150px]">
              {filteredRank[2].username}
            </span>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
              <span className="text-[var(--accent-text)] font-semibold">{filteredRank[2].accepted_number} AC</span>
              <span>·</span>
              <span>{rankType === 'ACM' ? `${filteredRank[2].accepted_number * 10} pts` : `${filteredRank[2].total_score} pts`}</span>
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert">{error}</p>}
      {/* Leaderboard Table */}
      <div className="bg-[var(--bg-secondary)] rounded-md overflow-hidden border border-[var(--border)]">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--text-secondary)]">
            <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tải...
          </div>
        ) : filteredRank.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--text-secondary)]">Không tìm thấy tài khoản</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-tertiary/50 text-[var(--text-secondary)] border-b border-[var(--border)] font-medium text-[11px]">
                <tr>
                  <th className="px-3 py-2 w-16">Thứ Hạng</th>
                  <th className="px-3 py-2">Tài Khoản</th>
                  <th className="px-3 py-2">Số Bài Giải (AC)</th>
                  <th className="px-3 py-2">Tổng Lượt Nộp</th>
                  <th className="px-3 py-2">Tỉ Lệ Đạt</th>
                  <th className="px-3 py-2 text-right">{rankType === 'ACM' ? 'Điểm Rating' : 'Điểm OI Score'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredRank.map((u) => {
                  const acRate = u.submission_number > 0 ? ((u.accepted_number / u.submission_number) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={u.user_id} className="hover:bg-[var(--bg-primary)] transition-colors">
                      <td className="px-3 py-2 font-mono text-[var(--text-muted)]">#{u.rank}</td>
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--accent-text)] font-mono text-[9px] font-bold flex items-center justify-center">
                          {(u.username || 'u').charAt(0).toUpperCase()}
                        </div>
                        {u.username || 'user'}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-[var(--accent-text)]">{u.accepted_number}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{u.submission_number}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{acRate}%</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                        {rankType === 'ACM' ? u.accepted_number * 10 : u.total_score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <nav aria-label="Phân trang xếp hạng" className="flex justify-end items-center gap-3 text-xs">
        <button disabled={isLoading || page === 0} onClick={() => setPage(value => value - 1)} className="disabled:opacity-40">Trang trước</button>
        <span>Trang {page + 1}</span>
        <button disabled={isLoading || users.length < 50} onClick={() => setPage(value => value + 1)} className="disabled:opacity-40">Trang sau</button>
      </nav>
    </div>
  );
}
