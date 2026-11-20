import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  School as SchoolData,
  Users as UsersData,
  BookOpen as BookOpenData,
  Send as SendData,
  Plus as PlusData,
  Copy as CopyData,
  Check as CheckData,
  ArrowRight as ArrowRightData,
  Eye as EyeData,
  X as XData,
  Trophy as TrophyData,
  FileCode as FileCodeData,
} from 'lucide';
import VerdictBadge from '../../../components/VerdictBadge';
import {
  getClassrooms,
  getSubmissions,
  getSubmission,
  createClassroom,
  type Classroom,
  type Submission,
} from '../../../lib/api';
import { useEscapeKey } from '../../../lib/useEscapeKey';

interface TeacherOverviewTabProps {
  onNavigateTab: (tab: 'classrooms' | 'problems' | 'contests' | 'submissions', problemMode?: 'list' | 'create') => void;
  onSelectClassroom?: (c: Classroom) => void;
  teacherName?: string;
}

export default function TeacherOverviewTab({
  onNavigateTab,
  onSelectClassroom,
  teacherName,
}: TeacherOverviewTabProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Quick Create Class Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Code inspection modal
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEscapeKey(isCreateOpen, () => setIsCreateOpen(false));
  useEscapeKey(selectedSub !== null, () => setSelectedSub(null));

  const loadData = async () => {
    setLoading(true);
    try {
      const [classesData, subsData] = await Promise.all([
        getClassrooms(true).catch(() => []),
        getSubmissions({ pageSize: 6 }).catch(() => ({ rows: [], total: 0 })),
      ]);
      setClassrooms(classesData);
      setSubmissions(subsData.rows);
      setSubTotal(subsData.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalStudents = classrooms.reduce((acc, c) => acc + (c.student_count || 0), 0);
  const totalAssignments = classrooms.reduce((acc, c) => acc + (c.problem_count || 0), 0);

  const handleCopyClassCode = (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await createClassroom({
        name: newClassName,
        description: newClassDesc,
        code: newClassCode,
      });
      if (!res.ok || !res.classroom) {
        setCreateError(res.error || 'Tạo lớp thất bại');
        return;
      }
      setNotice(`Đã tạo lớp "${res.classroom.name}".`);
      setIsCreateOpen(false);
      setNewClassName('');
      setNewClassDesc('');
      setNewClassCode('');
      setClassrooms((prev) => [{ ...res.classroom!, student_count: 0, problem_count: 0 }, ...prev]);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      setCreateError(err.message || 'Lỗi khi tạo lớp');
    } finally {
      setIsCreating(false);
    }
  };

  const openSubmission = async (sub: Submission) => {
    setSelectedSub(sub);
    setDetailLoading(true);
    try {
      const full = await getSubmission(sub.id);
      if (full) setSelectedSub(full);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Lớp Học Phụ Trách',
      value: classrooms.length,
      icon: SchoolData,
      sub: 'Lớp học đang hoạt động',
      action: () => onNavigateTab('classrooms'),
    },
    {
      label: 'Học Sinh Đăng Ký',
      value: totalStudents,
      icon: UsersData,
      sub: 'Tổng học sinh các lớp',
      action: () => onNavigateTab('classrooms'),
    },
    {
      label: 'Bài Tập Đã Giao',
      value: totalAssignments,
      icon: BookOpenData,
      sub: 'Trong tất cả lớp học',
      action: () => onNavigateTab('problems'),
    },
    {
      label: 'Lượt Nộp Bài',
      value: subTotal,
      icon: SendData,
      sub: 'Tổng bài nộp hệ thống',
      action: () => onNavigateTab('submissions'),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Workspace Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">
            Bảng Điều Khiển Giáo Viên
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {teacherName ? `Xin chào, ${teacherName}! ` : ''}
            Quản lý nhanh các lớp học, đề thi và theo dõi bài làm của học sinh.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={13} />
            <span>Tạo Lớp Mới</span>
          </button>

          <button
            onClick={() => onNavigateTab('problems', 'create')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={FileCodeData} size={13} />
            <span>Soạn Đề Mới</span>
          </button>

          <button
            onClick={() => onNavigateTab('contests')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={TrophyData} size={13} />
            <span>Tạo Kỳ Thi</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-2.5 rounded-md bg-accent/10 border border-accent/25 text-xs text-[var(--accent-text)] font-medium flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <MorphIcon icon={XData} size={14} />
          </button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            onClick={s.action}
            className="bg-[var(--bg-secondary)] p-3.5 rounded-md border border-[var(--border)] shadow-xs hover:border-[var(--text-muted)] transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <dt className="text-xs font-medium group-hover:text-[var(--accent-text)] transition-colors">
                {s.label}
              </dt>
              <div className="w-6 h-6 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                <MorphIcon icon={s.icon} size={13} />
              </div>
            </div>
            <dd className="mt-2 text-xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {loading ? '—' : s.value.toLocaleString('vi-VN')}
            </dd>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{s.sub}</p>
          </div>
        ))}
      </dl>

      {/* Two-Column Hub: Classrooms on Left, Recent Submissions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Active Classrooms (7 cols) */}
        <section className="lg:col-span-7 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <MorphIcon icon={SchoolData} size={15} className="text-[var(--accent-text)]" />
              <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Lớp Học Đang Phụ Trách
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('classrooms')}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline font-medium cursor-pointer"
            >
              <span>Xem tất cả</span>
              <MorphIcon icon={ArrowRightData} size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded bg-[var(--bg-primary)] animate-pulse" />
              ))}
            </div>
          ) : classrooms.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md space-y-2">
              <p>Bạn chưa tạo lớp học nào.</p>
              <button
                onClick={() => {
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium cursor-pointer"
              >
                <MorphIcon icon={PlusData} size={13} /> Tạo lớp ngay
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {classrooms.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    if (onSelectClassroom) onSelectClassroom(c);
                    else onNavigateTab('classrooms');
                  }}
                  className="p-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                        {c.name}
                      </h3>
                      <button
                        onClick={(e) => handleCopyClassCode(c.code, c.id, e)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-mono font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                        title="Sao chép mã mời học sinh"
                      >
                        <MorphIcon icon={copiedCodeId === c.id ? CheckData : CopyData} size={10} />
                        <span>{copiedCodeId === c.id ? 'Đã chép' : c.code}</span>
                      </button>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-[var(--text-muted)] truncate max-w-sm">
                        {c.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1 text-[11px]">
                      <MorphIcon icon={UsersData} size={11} className="text-[var(--text-muted)]" />
                      <span>{c.student_count || 0}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <MorphIcon icon={BookOpenData} size={11} className="text-[var(--text-muted)]" />
                      <span>{c.problem_count || 0} bài</span>
                    </span>
                    <span className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform">
                      <MorphIcon icon={ArrowRightData} size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Recent Submissions Monitor (5 cols) */}
        <section className="lg:col-span-5 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <MorphIcon icon={SendData} size={15} className="text-[var(--accent-text)]" />
              <h2 className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Bài Nộp Gần Đây
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('submissions')}
              className="inline-flex items-center gap-1 text-xs text-[var(--accent-text)] hover:underline font-medium cursor-pointer"
            >
              <span>Xem tất cả</span>
              <MorphIcon icon={ArrowRightData} size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 rounded bg-[var(--bg-primary)] animate-pulse" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
              Chưa có lượt nộp bài nào gần đây.
            </div>
          ) : (
            <div className="space-y-1.5 font-mono">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => openSubmission(sub)}
                  className="p-2.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 font-sans">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {sub.problems?.title || 'Bài tập'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                      <span>{sub.profiles?.full_name || sub.profiles?.email?.split('@')[0] || 'user'}</span>
                      <span>·</span>
                      <span className="font-mono uppercase text-[10px]">{sub.language}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <VerdictBadge status={sub.status} />
                    <button
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Xem bài làm"
                    >
                      <MorphIcon icon={EyeData} size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick Create Class Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tạo lớp học mới"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tạo Lớp Học Mới</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <MorphIcon icon={XData} size={15} />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded bg-danger/10 border border-danger/20 text-xs text-[var(--danger)]">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Tên lớp học <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="VD: Chuyên Tin 10 - Năm học 2026"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">Mô tả lớp</label>
                <textarea
                  rows={2}
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu môn học, lịch kiểm tra định kỳ..."
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--text-secondary)] mb-1">
                  Mã tham gia lớp (Tùy chọn, để trống sẽ tự tạo)
                </label>
                <input
                  type="text"
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                  placeholder="VD: TIN10K26"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-1.5 font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] font-medium text-[var(--text-secondary)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'Đang tạo...' : 'Tạo Lớp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Code Inspector Modal */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedSub(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết bài nộp"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-2.5">
                <VerdictBadge status={selectedSub.status} long />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedSub.problems?.title || 'Bài tập'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono">
                    Học sinh: {selectedSub.profiles?.full_name || selectedSub.profiles?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <MorphIcon icon={XData} size={15} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Ngôn ngữ</div>
                  <div className="font-semibold text-[var(--text-primary)] uppercase mt-0.5">{selectedSub.language}</div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Thời gian</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSub.time_used_ms === 'number' ? `${selectedSub.time_used_ms} ms` : '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">Bộ nhớ</div>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof selectedSub.memory_used_mb === 'number' ? `${selectedSub.memory_used_mb} MB` : '—'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Mã nguồn bài nộp</span>
                  <button
                    onClick={() => {
                      if (!selectedSub.code) return;
                      navigator.clipboard.writeText(selectedSub.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    <MorphIcon icon={copiedCode ? CheckData : CopyData} size={11} />
                    <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                  </button>
                </div>

                {detailLoading ? (
                  <div className="h-40 rounded bg-[var(--bg-primary)] border border-[var(--border)] animate-pulse" />
                ) : (
                  <pre className="p-3 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto max-h-72 leading-relaxed">
                    <code>{selectedSub.code || '// Không tìm thấy nội dung mã nguồn'}</code>
                  </pre>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--border)] flex justify-end bg-surface/50">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-primary)] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
