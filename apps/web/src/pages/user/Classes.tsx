import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Plus,
  Users,
  BookOpen,
  ArrowRight,
  Sparkles,
  X,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import {
  getClassrooms,
  joinClassroomByCode,
  type Classroom,
  type AppUser,
} from '../../lib/api';

interface ClassesProps {
  user: AppUser | null;
  onOpenAuth: () => void;
}

export default function Classes({ user, onOpenAuth }: ClassesProps) {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* join class modal */
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchClasses = async () => {
    if (!user) {
      setClassrooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getClassrooms(false);
      setClassrooms(list);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [user]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsJoining(true);
    setJoinError(null);
    const res = await joinClassroomByCode(joinCode.trim());
    setIsJoining(false);
    if (!res.ok) {
      setJoinError(res.error || 'Tham gia lớp thất bại');
      return;
    }
    setIsJoinOpen(false);
    setJoinCode('');
    if (res.classroom) {
      navigate(`/classes/${res.classroom.id}`);
    } else {
      fetchClasses();
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <GraduationCap className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">Lớp Học CodeJudge</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Vui lòng đăng nhập để tham gia lớp học của giáo viên và nộp bài tập được giao.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <LogIn className="w-4 h-4" /> Đăng Nhập Ngay
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold font-mono">
              <Sparkles className="w-3.5 h-3.5" /> Không Gian Học Tập
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Lớp Học Của Tôi</h1>
            <p className="text-xs text-[var(--text-secondary)] max-w-md">
              Tham gia các lớp học của thầy cô, nhận bài tập về nhà và theo dõi bảng xếp hạng thi đua trong lớp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tham Gia Bằng Mã
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Classes Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
          Đang tải danh sách lớp học...
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-3">
          <GraduationCap className="w-12 h-12 text-[var(--text-muted)] mx-auto" />
          <div className="text-sm font-bold text-[var(--text-primary)]">Bạn chưa tham gia lớp học nào</div>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Hỏi giáo viên hoặc trợ giảng của bạn để nhận mã mời lớp học (ví dụ: <code className="font-mono font-bold text-amber-600 dark:text-amber-400">MATH11</code>) và bấm nút bên dưới.
          </p>
          <button
            onClick={() => setIsJoinOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nhập Mã Tham Gia Lớp
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              to={`/classes/${c.id}`}
              className="group p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/60 transition-all shadow-sm hover:shadow-md flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-muted)]">
                    <span className="font-bold">{c.code}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {c.name}
                  </h3>
                  {c.teacher && (
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
                      <span>Giáo viên:</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {c.teacher.full_name || c.teacher.username}
                      </span>
                    </p>
                  )}
                  {c.description && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-2">
                      {c.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-3 font-semibold">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" /> {c.problem_count || 0} bài tập
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-sky-500" /> {c.student_count || 0} bạn học
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-[var(--accent-text)] group-hover:translate-x-0.5 transition-transform">
                  <span>Vào lớp</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal: Tham gia lớp bằng mã */}
      {isJoinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsJoinOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-[var(--text-primary)]">Tham Gia Lớp Học</h3>
              </div>
              <button
                onClick={() => setIsJoinOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">{joinError}</div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Mã lớp học (Class Code)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ví dụ: TIN11A"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-center text-lg font-black text-[var(--text-primary)] tracking-widest uppercase focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-[var(--text-muted)] text-center">
                  Nhận mã mời gồm 4-10 ký tự từ giáo viên của bạn để tham gia.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!joinCode.trim() || isJoining}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {isJoining ? 'Đang kiểm tra...' : 'Vào Lớp Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

