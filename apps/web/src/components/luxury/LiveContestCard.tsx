import { Trophy, Clock, Users, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Contest } from '../../lib/api';

interface LiveContestCardProps {
  contest?: Contest | null;
}

export default function LiveContestCard({ contest }: LiveContestCardProps) {
  const isRunning = contest?.status === 'UNDERWAY';
  const isEnded = contest?.status === 'ENDED';

  return (
    <div className="luxury-card luxury-card-amber rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-full group">
      {/* Glow effect */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

      <div>
        {/* Badge & Status */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">
              Đấu Trường ICPC / OI
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
              isRunning
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse'
                : isEnded
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : isEnded ? 'bg-slate-500' : 'bg-cyan-400'}`} />
            {isRunning ? 'ĐANG DIỄN RA' : isEnded ? 'ĐÃ KẾT THÚC' : 'SẮP DIỄN RA'}
          </span>
        </div>

        {/* Contest Title */}
        <h4 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-400 transition-colors mb-2 line-clamp-1">
          {contest?.title || 'CodeJudge National Spring Contest 2026'}
        </h4>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-5">
          {contest?.description || 'Cuộc thi lập trình thuật toán tiêu chuẩn quốc tế ACM-ICPC. Thử thách 5 bài toán từ Easy đến Grandmaster.'}
        </p>

        {/* HUD Stats */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 mb-5 text-center">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Thể thức</div>
            <div className="text-xs font-extrabold text-slate-200 mt-0.5">{contest?.rule_type || 'ACM/ICPC'}</div>
          </div>
          <div className="border-x border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Thí sinh</div>
            <div className="text-xs font-extrabold text-slate-200 mt-0.5 flex items-center justify-center gap-1">
              <Users className="w-3 h-3 text-cyan-400" /> 142
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">Giải Thưởng</div>
            <div className="text-xs font-extrabold text-amber-400 mt-0.5 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 fill-amber-400" /> +500 ELO
            </div>
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" /> Thời gian: 3 tiếng
        </span>

        <Link
          to={contest ? `/contests/${contest.id}` : '/contests'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-colors"
        >
          {isRunning ? 'Vào Thi Đấu' : 'Chi Tiết'} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
