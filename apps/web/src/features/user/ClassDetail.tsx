import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Users, Trophy, ArrowLeft, Play } from 'lucide-react';
import {
  getClassroomDetail,
  getClassroomProgress,
  type Classroom,
  type ClassroomMember,
  type ClassroomProblem,
  type ClassroomProgressItem,
  type AppUser,
} from '../../lib/api';

interface ClassDetailProps {
  user: AppUser | null;
  onOpenAuth: () => void;
}

type TabType = 'assignments' | 'leaderboard' | 'members';

export default function ClassDetail({ user, onOpenAuth }: ClassDetailProps) {
  const { classId } = useParams<{ classId: string }>();

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [problems, setProblems] = useState<ClassroomProblem[]>([]);
  const [progressList, setProgressList] = useState<ClassroomProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('assignments');

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getClassroomDetail(classId);
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          return;
        }
        setClassroom(res.classroom);
        setMembers(res.members);
        setProblems(res.problems);

        if (res.problems.length > 0 && res.members.length > 0) {
          const probIds = res.problems.map((p) => p.problem_id);
          const userIds = res.members.map((m) => m.user_id);
          const prog = await getClassroomProgress(classId, probIds, userIds);
          if (!cancelled) setProgressList(prog);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Lỗi tải thông tin lớp');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-[var(--text-muted)] animate-pulse">
        Đang tải thông tin lớp học...
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] text-center space-y-4">

        <h2 className="text-base font-black text-[var(--text-primary)]">Không Tìm Thấy Lớp Học</h2>
        <p className="text-xs text-[var(--text-muted)]">{error || 'Bạn không có quyền truy cập lớp này hoặc lớp đã bị đóng.'}</p>
        <Link
          to="/classes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách lớp
        </Link>
      </div>
    );
  }

  // Helper map for progress
  const progressMap = new Map<string, ClassroomProgressItem>();
  for (const item of progressList) {
    progressMap.set(`${item.userId}_${item.problemId}`, item);
  }

  // Calculate my stats
  let mySolvedCount = 0;
  if (user) {
    for (const p of problems) {
      const prog = progressMap.get(`${user.id}_${p.problem_id}`);
      if (prog?.status === 'ACCEPTED') mySolvedCount++;
    }
  }

  // Calculate Leaderboard: list members sorted by AC count DESC, then total score DESC
  const leaderboard = members.map((m) => {
    let acCount = 0;
    let totalScore = 0;
    for (const p of problems) {
      const prog = progressMap.get(`${m.user_id}_${p.problem_id}`);
      if (prog?.status === 'ACCEPTED') acCount++;
      totalScore += prog?.score || 0;
    }
    return {
      member: m,
      acCount,
      totalScore,
    };
  }).sort((a, b) => {
    if (b.acCount !== a.acCount) return b.acCount - a.acCount;
    return b.totalScore - a.totalScore;
  });

  return (
    <div className="space-y-6">
      {/* Back button & Class banner */}
      <div className="space-y-4">
        <Link
          to="/classes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tất cả lớp học
        </Link>

        <div className="p-6 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[var(--text-primary)]">{classroom.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-xs font-bold text-[var(--accent-text)]">
                  {classroom.code}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Giảng viên: <span className="font-bold text-[var(--text-primary)]">{classroom.teacher?.full_name || classroom.teacher?.username || 'Giáo viên'}</span>
              </p>
              {classroom.description && (
                <p className="text-xs text-[var(--text-muted)] mt-2 max-w-2xl">
                  {classroom.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick stats box */}
          <div className="flex items-center gap-3 bg-[var(--bg-secondary)] p-3.5 rounded-xl border border-[var(--border)] shrink-0 self-start md:self-auto">
            <div className="text-center px-3">
              <div className="text-lg font-black text-[var(--accent-text)] font-mono">
                {mySolvedCount}/{problems.length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-semibold">Đã hoàn thành</div>
            </div>
            <div className="w-px h-8 bg-[var(--border)]" />
            <div className="text-center px-3">
              <div className="text-lg font-black text-[var(--text-primary)] font-mono">
                {members.length}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-semibold">Học sinh</div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtabs Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-[var(--accent)] text-[var(--accent-text)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Bài Tập Được Giao ({problems.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'border-[var(--accent)] text-[var(--accent-text)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Trophy className="w-4 h-4" /> Bảng Thi Đua Lớp
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'members'
              ? 'border-[var(--accent)] text-[var(--accent-text)]'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4" /> Thành Viên ({members.length})
        </button>
      </div>

      {/* Subtab 1: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {problems.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-2">

              <div className="text-xs font-bold text-[var(--text-primary)]">Chưa có bài tập nào được giao</div>
              <p className="text-[11px] text-[var(--text-muted)]">Thầy cô sẽ sớm cập nhật bài tập cho lớp học này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {problems.map((cp, idx) => {
                const p = cp.problem;
                const myProg = user ? progressMap.get(`${user.id}_${cp.problem_id}`) : null;
                const isAc = myProg?.status === 'ACCEPTED';
                const hasDeadline = !!cp.deadline;
                const isExpired = hasDeadline && new Date(cp.deadline!).getTime() < Date.now();

                return (
                  <div
                    key={cp.problem_id}
                    className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-accent/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center font-mono font-bold text-xs text-[var(--text-secondary)] shrink-0">
                        {idx + 1}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/problems/${p?.slug || cp.problem_id}?classroom=${classId}`}
                            className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors"
                          >
                            {p?.title || 'Bài tập'}
                          </Link>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                              p?.difficulty === 'Easy'
                                ? 'bg-accent/10 text-[var(--accent-text)] border-accent/30'
                                : p?.difficulty === 'Medium'
                                ? 'bg-warning/10 text-warning border-warning/30'
                                : 'bg-danger/10 text-danger border-danger/30'
                            }`}
                          >
                            {p?.difficulty || 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] flex-wrap">
                          <span>Giới hạn: {p?.time_limit_ms}ms / {p?.memory_limit_mb}MB</span>
                          {hasDeadline && (
                            <span
                              className={`flex items-center gap-1 font-mono ${
                                isExpired ? 'text-danger font-bold' : 'text-[var(--text-secondary)]'
                              }`}
                            >
                               Hạn nộp: {new Date(cp.deadline!).toLocaleString('vi-VN')}
                              {isExpired && ' (Đã hết hạn)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {/* Status indicator */}
                      {user && (
                        <div>
                          {isAc ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/10 text-[var(--accent-text)] border border-accent/20 text-xs font-bold">
                               Đã Hoàn Thành
                            </div>
                          ) : myProg ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 text-xs font-bold">
                               {myProg.score}đ (Chưa AC)
                            </div>
                          ) : (
                            <div className="text-xs text-[var(--text-muted)] italic">Chưa nộp</div>
                          )}
                        </div>
                      )}

                      <Link
                        to={`/problems/${p?.slug || cp.problem_id}?classroom=${classId}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isAc ? 'Làm lại' : 'Làm bài'}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold text-[11px] uppercase border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center">Hạng</th>
                  <th className="px-4 py-3">Học Sinh</th>
                  <th className="px-4 py-3 text-center">Số Bài AC</th>
                  <th className="px-4 py-3 text-center">Tổng Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leaderboard.map((item, idx) => {
                  const isMe = user?.id === item.member.user_id;
                  return (
                    <tr
                      key={item.member.user_id}
                      className={`hover:bg-[var(--bg-secondary)] transition-colors ${
                        isMe ? 'bg-accent/5 font-semibold' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-black">
                          {(item.member.profile?.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                            <span>{item.member.profile?.username}</span>
                            {isMe && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/15 text-[var(--accent-text)] font-mono font-bold">
                                Bạn
                              </span>
                            )}
                          </div>
                          {item.member.profile?.full_name && (
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {item.member.profile.full_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[var(--accent-text)]">
                        {item.acCount} / {problems.length}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-[var(--text-primary)]">
                        {item.totalScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/15 text-[var(--accent-text)] flex items-center justify-center font-black">
                {(classroom.teacher?.username || 'T').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  {classroom.teacher?.full_name || classroom.teacher?.username}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold">Giảng viên / Chủ nhiệm lớp</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1">
              Danh sách học sinh ({members.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-black shrink-0">
                    {(m.profile?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {m.profile?.username}
                    </div>
                    {m.profile?.full_name && (
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {m.profile.full_name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

