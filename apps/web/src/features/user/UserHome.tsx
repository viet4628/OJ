import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  UserRound, Mail, Trophy, Flame, Star, Calendar, Loader2, AlertOctagon,
} from 'lucide-react';
import {
  getUserProfile, getUserRankStats, getSubmissionsByUser,
  type Profile, type RankUser, type Submission,
} from '../../lib/api';

const STATUS_STYLE: Record<string, string> = {
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WRONG_ANSWER: 'bg-red-50 text-red-700 border-red-200',
  TIME_LIMIT_EXCEEDED: 'bg-amber-50 text-amber-700 border-amber-200',
  MEMORY_LIMIT_EXCEEDED: 'bg-purple-50 text-purple-700 border-purple-200',
  COMPILE_ERROR: 'bg-red-50 text-red-700 border-red-200',
  RUNTIME_ERROR: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'AC', WRONG_ANSWER: 'WA', TIME_LIMIT_EXCEEDED: 'TLE',
  MEMORY_LIMIT_EXCEEDED: 'MLE', COMPILE_ERROR: 'CE', RUNTIME_ERROR: 'RE',
};

export default function UserHome() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<RankUser | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [p, s, list] = await Promise.all([
        getUserProfile(id),
        getUserRankStats(id),
        getSubmissionsByUser(id, 15),
      ]);
      setProfile(p);
      setStats(s);
      setSubs(list);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[var(--text-secondary)] font-bold">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải hồ sơ...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-24 text-center space-y-3">
        <AlertOctagon className="w-8 h-8 mx-auto text-[var(--text-muted)]" />
        <p className="text-xs text-[var(--text-secondary)]">Không tìm thấy người dùng này</p>
        <Link to="/ranklist" className="text-xs font-bold text-[var(--accent-text)] hover:underline">← Xem bảng xếp hạng</Link>
      </div>
    );
  }

  const displayName = profile.full_name || profile.email.split('@')[0];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* HEADER CARD */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="w-20 h-20 rounded-2xl object-cover border border-[var(--border)] shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent-text)] font-black text-2xl flex items-center justify-center">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <UserRound className="w-5 h-5 text-[var(--accent-text)]" /> {displayName}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-code flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {profile.email}
          </p>
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
            profile.role === 'admin'
              ? 'bg-slate-900 text-white border-slate-900'
              : profile.role === 'teacher'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
          }`}>
            {profile.role === 'admin' ? 'ADMIN' : profile.role === 'teacher' ? 'GIÁO VIÊN' : 'THÍ SINH'}
          </span>
        </div>

        <div className="text-[11px] text-[var(--text-muted)] font-code shrink-0">
          Tham gia: {new Date(profile.created_at).toLocaleDateString('vi-VN')}
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Trophy, label: 'Bài Đã Giải (AC)', value: stats?.accepted_number ?? 0, color: 'text-[var(--accent-text)]' },
          { icon: Flame, label: 'Tổng Lượt Nộp', value: stats?.submission_number ?? 0, color: 'text-amber-500' },
          { icon: Star, label: 'Điểm OI Tích Lũy', value: stats?.total_score ?? 0, color: 'text-sky-600 dark:text-sky-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--bg-primary)] rounded-2xl p-4 border border-[var(--border)] shadow-sm space-y-1">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div className="text-2xl font-black text-[var(--text-primary)]">{Number(s.value).toLocaleString('vi-VN')}</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* RECENT SUBMISSIONS */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent-text)]" /> Bài Nộp Gần Đây
          </h2>
          <span className="text-[10px] text-[var(--text-muted)] font-code">15 mới nhất</span>
        </div>

        {subs.length === 0 ? (
          <p className="py-12 text-center text-xs text-[var(--text-secondary)]">Chưa có bài nộp nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase">
                <tr>
                  <th className="px-5 py-3">Thời Gian</th>
                  <th className="px-5 py-3">Bài Tập</th>
                  <th className="px-5 py-3">Kết Quả</th>
                  <th className="px-5 py-3">Thời Gian</th>
                  <th className="px-5 py-3 text-right">Ngôn Ngữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-code">
                {subs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[var(--bg-secondary)]/80 transition-colors">
                    <td className="px-5 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                      {new Date(sub.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 font-bold text-[var(--text-primary)] font-sans">
                      <Link to={`/problems/${sub.problems?.slug || ''}`} className="hover:text-[var(--accent-text)] transition-colors">
                        {sub.problems?.title || 'Bài tập'}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_STYLE[sub.status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {STATUS_LABEL[sub.status] || sub.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{sub.time_used_ms} ms · {sub.memory_used_mb} MB</td>
                    <td className="px-5 py-3 text-right">
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] uppercase font-bold text-[10px] text-[var(--text-secondary)]">{sub.language}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
