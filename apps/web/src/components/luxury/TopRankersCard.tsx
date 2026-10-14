import { Trophy, Crown, Medal, ArrowRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RankUser } from '../../lib/api';

interface TopRankersCardProps {
  rankUsers?: RankUser[];
}

export default function TopRankersCard({ rankUsers = [] }: TopRankersCardProps) {
  const defaultUsers = [
    { username: 'viet_master', solved_count: 142, rating: 2450, rank: 1, title: 'Grandmaster' },
    { username: 'algo_knight', solved_count: 128, rating: 2210, rank: 2, title: 'Master' },
    { username: 'binary_sage', solved_count: 115, rating: 2090, rank: 3, title: 'Candidate' },
  ];

  const displayList = rankUsers.length > 0
    ? rankUsers.slice(0, 3).map((u, i) => ({
        username: u.username || 'Coder',
        solved_count: u.accepted_number || 0,
        rating: 2000 + (3 - i) * 150,
        rank: i + 1,
        title: i === 0 ? 'Grandmaster' : i === 1 ? 'Master' : 'Expert',
      }))
    : defaultUsers;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Crown, border: 'border-amber-400', glow: 'shadow-amber-500/30', color: 'text-amber-400', bg: 'bg-amber-400/10' };
    if (rank === 2) return { icon: Medal, border: 'border-slate-300', glow: 'shadow-slate-300/30', color: 'text-slate-300', bg: 'bg-slate-300/10' };
    return { icon: Medal, border: 'border-amber-700', glow: 'shadow-amber-700/30', color: 'text-amber-600', bg: 'bg-amber-700/10' };
  };

  return (
    <div className="luxury-card rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-full group">
      {/* Glow */}
      <div className="absolute -top-12 -left-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-purple-400">
              Bảng Vàng Danh Dự
            </span>
          </div>
          <Link to="/ranklist" className="text-[11px] text-purple-400 hover:underline font-bold">
            Xem Tất Cả →
          </Link>
        </div>

        <h4 className="text-base font-bold text-white mb-4">
          Top Cao Thủ Tuần Này
        </h4>

        {/* Podium list */}
        <div className="space-y-3">
          {displayList.map((user) => {
            const badge = getRankBadge(user.rank);
            return (
              <div
                key={user.username}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs ${badge.border} ${badge.color} ${badge.bg} shadow-md ${badge.glow}`}>
                    {user.rank === 1 ? <Crown className="w-4 h-4" /> : user.rank}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{user.username}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                        {user.title}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      <b className="text-emerald-400 font-mono">{user.solved_count}</b> bài AC • <span className="text-amber-400 font-mono">{user.rating}</span> ELO
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <Star className="w-3 h-3 fill-emerald-400" /> Rank #{user.rank}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-400">Bạn đang ở Top 8% toàn hệ thống</span>
        <Link to="/ranklist" className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
          Bảng Xếp Hạng <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
