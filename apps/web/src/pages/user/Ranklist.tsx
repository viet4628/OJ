import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart2, Search, Trophy, Loader2 } from 'lucide-react';
import { getRanklist, type RankUser } from '../../lib/api';

export default function Ranklist() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'OI' ? 'OI' : 'ACM';
  const [rankType, setRankType] = useState<'ACM' | 'OI'>(initialType);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<RankUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUsers(await getRanklist());
      } catch (err) {
        console.error('Failed to load ranklist:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const sortedACM = [...users].sort((a, b) => b.accepted_number - a.accepted_number);
  const sortedOI = [...users].sort((a, b) => b.total_score - a.total_score);

  const currentData = rankType === 'ACM' ? sortedACM : sortedOI;
  const maxValue = Math.max(...currentData.map((u) => u.submission_number || u.total_score || 0), 1);

  const filteredRank = currentData.filter(
    (u) =>
      (u.username || '').toLowerCase().includes(search.toLowerCase())
  ).map((u, idx) => ({ ...u, rank: idx + 1 }));

  return (
    <div className="space-y-5">
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-primary)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 tracking-tight">
            <Trophy className="w-5 h-5 text-amber-500" /> Bảng Xếp Hạng Cao Thủ (Ranklist)
          </h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1">Xếp hạng lập trình viên xuất sắc nhất theo thể thức ACM & OI Subtask</p>
        </div>

        <div className="flex items-center gap-3">
          {/* ACM / OI Toggle */}
          <div className="bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border)] flex items-center gap-1 font-bold text-xs">
            <button
              onClick={() => setRankType('ACM')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                rankType === 'ACM'
                  ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-sm font-extrabold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              ACM Rank
            </button>
            <button
              onClick={() => setRankType('OI')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                rankType === 'OI'
                  ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-sm font-extrabold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              OI Subtask Rank
            </button>
          </div>

          <div className="relative shrink-0">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tài khoản..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] w-48 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* QingdaoU ECharts Style Bar Chart Panel */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[var(--accent-text)]" /> {rankType === 'ACM' ? 'ACM Ranklist Statistics' : 'OI Ranklist Statistics'}
          </h2>
          <span className="text-[10px] text-[var(--text-muted)] font-code">Top {currentData.length} users</span>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-[var(--text-secondary)] font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải dữ liệu...
            </div>
          ) : currentData.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-secondary)]">Chưa có dữ liệu xếp hạng</div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-5 text-[11px] font-bold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[var(--accent)]" /> {rankType === 'ACM' ? 'Số Bài Giải (AC)' : 'Tổng Điểm (Score)'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-sky-400" /> Tổng Lượt Nộp (Total)
                </span>
              </div>

              {/* Bar Chart */}
              <div className="overflow-x-auto">
                <div className="flex items-end justify-between gap-4 h-48 min-w-max">
                  {currentData.map((u) => {
                    const primary = rankType === 'ACM' ? u.accepted_number : u.total_score;
                    return (
                      <div key={u.user_id} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <div className="flex items-end gap-1.5 h-full max-h-32">
                          <div
                            className="w-5 sm:w-7 rounded-t-md bg-[var(--accent)]/80 hover:bg-[var(--accent)] transition-all animate-fade-in"
                            style={{ height: `${(primary / maxValue) * 100}%` }}
                            title={`${u.username}: ${primary}`}
                          />
                          <div
                            className="w-5 sm:w-7 rounded-t-md bg-sky-400/70 hover:bg-sky-400 transition-all animate-fade-in"
                            style={{ height: `${(u.submission_number / maxValue) * 100}%` }}
                            title={`${u.username}: ${u.submission_number} nộp`}
                          />
                        </div>
                        <span className="text-[10px] font-code font-bold text-[var(--text-secondary)] max-w-full truncate">
                          {u.username || 'user'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[var(--bg-primary)] rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--text-secondary)] font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải...
          </div>
        ) : filteredRank.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-secondary)]">Không tìm thấy tài khoản</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Thứ Hạng</th>
                  <th className="px-5 py-3.5">Tài Khoản</th>
                  <th className="px-5 py-3.5">Số Bài Giải (AC)</th>
                  <th className="px-5 py-3.5">Tổng Lượt Nộp</th>
                  <th className="px-5 py-3.5">Tỉ Lệ Đạt</th>
                  <th className="px-5 py-3.5 text-right">{rankType === 'ACM' ? 'Điểm Rating' : 'Điểm OI Score'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredRank.map((u) => {
                  const acRate = u.submission_number > 0 ? ((u.accepted_number / u.submission_number) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={u.user_id} className="hover:bg-[var(--bg-secondary)]/80 transition-colors">
                      <td className="px-5 py-4 font-extrabold text-[var(--text-primary)] font-code">#{u.rank}</td>
                      <td className="px-5 py-4 font-bold text-[var(--accent-text)] flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] font-mono text-[10px] font-bold flex items-center justify-center">
                          {(u.username || 'u').charAt(0).toUpperCase()}
                        </div>
                        {u.username || 'user'}
                      </td>
                      <td className="px-5 py-4 font-code font-bold text-[var(--accent-text)]">{u.accepted_number}</td>
                      <td className="px-5 py-4 font-code text-[var(--text-secondary)]">{u.submission_number}</td>
                      <td className="px-5 py-4 font-code font-bold text-sky-600 dark:text-sky-400">{acRate}%</td>
                      <td className="px-5 py-4 text-right font-code font-bold text-amber-600 dark:text-amber-400 text-sm">
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
    </div>
  );
}