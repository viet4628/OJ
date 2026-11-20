import { useEffect, useState } from 'react';
import { downloadBlob } from '../../../lib/zip';
import MorphIcon from '../../../components/MorphIcon';
import {
  Plus as PlusData,
  Users as UsersData,
  BookOpen as BookOpenData,
  Copy as CopyData,
  Check as CheckData,
  Trash2 as Trash2Data,
  ArrowLeft as ArrowLeftData,
  X as XData,
  Award as AwardData,
  Download as DownloadData,
  Search as SearchData,
} from 'lucide';
import {
  getClassroomDetail,
  addClassroomProblem,
  removeClassroomProblem,
  removeClassroomMember,
  getClassroomProgress,
  getAllProblems,
  type Classroom,
  type ClassroomMember,
  type ClassroomProblem,
  type ClassroomProgressItem,
  type Problem,
} from '../../../lib/api';
import { useEscapeKey } from '../../../lib/useEscapeKey';

type SubTab = 'assignments' | 'students' | 'gradebook';

/** One classroom: assignments, students and gradebook (owned by its teacher). */
export default function ClassroomDetailView({ classId, initialClassroom, notice, setNotice, onBack }: {
  classId: string;
  initialClassroom: Classroom | null;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  onBack: () => void;
}) {
  const activeClassId = classId;
  const [activeClass, setActiveClass] = useState<Classroom | null>(initialClassroom);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [classProblems, setClassProblems] = useState<ClassroomProblem[]>([]);
  const [progressList, setProgressList] = useState<ClassroomProgressItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('assignments');
  /* add problem modal */
  const [isAddProblemOpen, setIsAddProblemOpen] = useState(false);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [probSearch, setProbSearch] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [deadlineInput, setDeadlineInput] = useState('');
  const [isAddingProblem, setIsAddingProblem] = useState(false);
  useEscapeKey(isAddProblemOpen, () => { if (!isAddingProblem) setIsAddProblemOpen(false); });
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [problemsLoading, setProblemsLoading] = useState(false);

  /* copied state */
  const [copiedCode, setCopiedCode] = useState(false);

  const loadClassDetail = async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await getClassroomDetail(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setActiveClass(res.classroom);
      setMembers(res.members);
      setClassProblems(res.problems);

      // Load progress matrix
      if (res.problems.length > 0 && res.members.length > 0) {
        const probIds = res.problems.map((p) => p.problem_id);
        const userIds = res.members.map((m) => m.user_id);
        const prog = await getClassroomProgress(id, probIds, userIds);
        setProgressList(prog);
      } else {
        setProgressList([]);
      }
    } catch {
      setError('Không tải được thông tin lớp. Vui lòng thử lại.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadClassDetail(classId);
  }, [classId]);

  /* copy invite code */
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setError('Không sao chép được mã mời. Bạn có thể chọn và sao chép mã hiển thị.');
    }
  };

  const exportGradebook = () => {
    if (!activeClass) return;
    const rows: (string | number)[][] = [['Họ tên', 'ID', ...classProblems.map(cp => cp.problem?.title || cp.problem_id), 'Tổng điểm']];
    for (const member of members) {
      const scores = classProblems.map(cp => progressList.find(item => item.userId === member.user_id && item.problemId === cp.problem_id)?.score ?? 0);
      rows.push([member.profile?.full_name || member.user_id, member.user_id, ...scores, scores.reduce((a, b) => a + b, 0)]);
    }
    const csv = rows.map(row => row.map(value => {
      // Prevent spreadsheet formula execution in user-controlled names/titles.
      const text = String(value).replace(/^[\s]*[=+@-]/, match => `'${match}`);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    downloadBlob(`\uFEFF${csv}`, `bang-diem-${activeClass.id}.csv`, 'text/csv;charset=utf-8');
  };

  /* open problem picker modal */
  const handleOpenAddProblem = async () => {
    setIsAddProblemOpen(true);
    setSelectedProblemId('');
    setDeadlineInput('');
    setProbSearch('');
    setAssignmentError(null);
    setProblemsLoading(true);
    try {
      setAvailableProblems(await getAllProblems());
    } catch {
      setAssignmentError('Không tải được ngân hàng bài tập. Vui lòng mở lại để thử lại.');
    } finally {
      setProblemsLoading(false);
    }
  };

  /* add problem to class */
  const handleAddProblemSubmit = async () => {
    if (!activeClassId || !selectedProblemId || isAddingProblem) return;
    setIsAddingProblem(true);
    setAssignmentError(null);
    try {
      const deadline = deadlineInput ? new Date(deadlineInput) : null;
      if (deadline && (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now())) {
        setAssignmentError('Hạn nộp cần nằm trong tương lai. Để trống nếu không giới hạn.');
        return;
      }
      const res = await addClassroomProblem(activeClassId, selectedProblemId, deadline?.toISOString() || null);
      if (!res.ok) {
        setAssignmentError(res.error || 'Không thể thêm bài tập');
        return;
      }
      setIsAddProblemOpen(false);
      setNotice('Đã giao bài tập cho lớp học');
      await loadClassDetail(activeClassId);
    } catch {
      setAssignmentError('Chưa xác nhận được kết quả giao bài. Vui lòng tải lại lớp trước khi thử lại.');
    } finally {
      setIsAddingProblem(false);
    }
  };

  /* remove problem from class */
  const handleRemoveProblem = async (problemId: string, title: string) => {
    if (!activeClassId || !window.confirm(`Xóa bài "${title}" khỏi lớp học này?`)) return;
    const res = await removeClassroomProblem(activeClassId, problemId);
    if (!res.ok) {
      alert(res.error || 'Xóa thất bại');
      return;
    }
    setNotice(`Đã gỡ bài "${title}" khỏi lớp`);
    loadClassDetail(activeClassId);
  };

  /* remove student from class */
  const handleRemoveMember = async (userId: string, username: string) => {
    if (!activeClassId || !window.confirm(`Xóa học sinh "${username}" khỏi lớp học này?`)) return;
    const res = await removeClassroomMember(activeClassId, userId);
    if (!res.ok) {
      alert(res.error || 'Xóa học sinh thất bại');
      return;
    }
    setNotice(`Đã xóa học sinh "${username}"`);
    loadClassDetail(activeClassId);
  };

  // Helper map for progress
  const progressMap = new Map<string, ClassroomProgressItem>();
  for (const item of progressList) {
    progressMap.set(`${item.userId}_${item.problemId}`, item);
  }

  if (!activeClass) {
    return (
      <div className="space-y-3 text-xs">
        {error ? <p role="alert" className="text-[var(--danger)]">{error}</p> : <p role="status">Đang tải lớp học...</p>}
        <button type="button" onClick={onBack} className="underline">Quay lại danh sách lớp</button>
      </div>
    );
  }

  return (
      <div className="space-y-4">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="p-1.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors cursor-pointer"
              title="Quay lại danh sách lớp"
            >
              <MorphIcon icon={ArrowLeftData} size={15} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{activeClass.name}</h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--accent-text)] font-mono text-xs font-semibold">
                  <span>Mã: {activeClass.code}</span>
                  <button
                    onClick={() => handleCopyCode(activeClass.code)}
                    className="hover:opacity-75 transition-opacity cursor-pointer"
                    title="Sao chép mã lớp"
                    aria-label={copiedCode ? 'Đã sao chép mã lớp' : 'Sao chép mã lớp'}
                  >
                    {copiedCode ? <MorphIcon icon={CheckData} size={12} className="text-[var(--accent-text)]" /> : <MorphIcon icon={CopyData} size={12} />}
                  </button>
                </div>
              </div>
              {activeClass.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{activeClass.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddProblem}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
            >
              <MorphIcon icon={PlusData} size={14} /> Giao Bài Tập
            </button>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="p-3 rounded-md bg-accent/10 border border-accent/25 text-[var(--accent-text)] text-xs font-medium flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
              <MorphIcon icon={XData} size={16} />
            </button>
          </div>
        )}

        {error && <div className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">{error}</div>}
        {!detailLoading && members.length === 0 && (
          <div className="p-3 border border-[var(--border)] rounded-md text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)]">
            Mời học sinh vào mục Lớp học và nhập mã <strong className="font-mono text-[var(--text-primary)]">{activeClass.code}</strong> để tham gia.
          </div>
        )}

        {/* Subtabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveSubTab('assignments')}
            className={`flex items-center gap-1.5 px-3.5 py-2 border-b-2 text-xs transition-colors cursor-pointer ${
              activeSubTab === 'assignments'
                ? 'border-[var(--accent)] text-[var(--accent-text)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <MorphIcon icon={BookOpenData} size={13} /> Bài Tập ({classProblems.length})
          </button>
          <button
            onClick={() => setActiveSubTab('students')}
            className={`flex items-center gap-1.5 px-3.5 py-2 border-b-2 text-xs transition-colors cursor-pointer ${
              activeSubTab === 'students'
                ? 'border-[var(--accent)] text-[var(--accent-text)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <MorphIcon icon={UsersData} size={13} /> Học Sinh ({members.length})
          </button>
          <button
            onClick={() => setActiveSubTab('gradebook')}
            className={`flex items-center gap-1.5 px-3.5 py-2 border-b-2 text-xs transition-colors cursor-pointer ${
              activeSubTab === 'gradebook'
                ? 'border-[var(--accent)] text-[var(--accent-text)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            <MorphIcon icon={AwardData} size={13} /> Bảng Điểm & Tiến Độ
          </button>
        </div>

        {detailLoading ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
            Đang tải thông tin lớp học...
          </div>
        ) : (
          <>
            {/* TAB 1: ASSIGNMENTS */}
            {activeSubTab === 'assignments' && (
              <div className="space-y-4">
                {classProblems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-md bg-[var(--bg-secondary)] space-y-2.5">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">Chưa có bài tập nào trong lớp</div>
                    <p className="text-[11px] text-[var(--text-secondary)]">Hãy giao bài tập từ ngân hàng đề để học sinh bắt đầu làm bài.</p>
                    <button
                      onClick={handleOpenAddProblem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium cursor-pointer shadow-xs border border-[rgba(27,31,36,0.15)]"
                    >
                      <MorphIcon icon={PlusData} size={13} /> Giao bài tập ngay
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-md">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] font-medium text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-2.5">Bài Tập</th>
                          <th className="px-4 py-2.5">Độ Khó</th>
                          <th className="px-4 py-2.5">Giới Hạn</th>
                          <th className="px-4 py-2.5">Hạn Nộp</th>
                          <th className="px-4 py-2.5 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {classProblems.map((cp) => {
                          const p = cp.problem;
                          const hasDeadline = !!cp.deadline;
                          const isExpired = hasDeadline && new Date(cp.deadline!).getTime() < Date.now();
                          return (
                            <tr key={cp.problem_id} className="hover:bg-[var(--bg-primary)] transition-colors">
                              <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                                <div>{p?.title || cp.problem_id}</div>
                                <div className="text-[10px] font-mono text-[var(--text-muted)]">/{p?.slug}</div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`text-[10px] px-2 py-0.2 rounded font-mono border ${
                                    p?.difficulty === 'Easy'
                                      ? 'bg-accent/10 text-[var(--accent-text)] border-accent/25'
                                      : p?.difficulty === 'Medium'
                                      ? 'bg-warning/10 text-[var(--warning)] border-warning/25'
                                      : 'bg-danger/10 text-[var(--danger)] border-danger/25'
                                  }`}
                                >
                                  {p?.difficulty || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                                {p ? `${p.time_limit_ms}ms · ${p.memory_limit_mb}MB` : '-'}
                              </td>
                              <td className="px-4 py-2.5">
                                {hasDeadline ? (
                                  <span
                                    className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                                      isExpired ? 'text-[var(--danger)] font-medium' : 'text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    {new Date(cp.deadline!).toLocaleString('vi-VN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    })}
                                    {isExpired && ' (Hết hạn)'}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-[11px]">Không có hạn</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleRemoveProblem(cp.problem_id, p?.title || 'Bài tập')}
                                  className="p-1.5 rounded-md text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                                  title="Gỡ khỏi lớp"
                                >
                                  <MorphIcon icon={Trash2Data} size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STUDENTS */}
            {activeSubTab === 'students' && (
              <div className="space-y-4">
                {/* Invite Code Box */}
                <div className="p-3.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">Mã Mời Tham Gia Lớp Học</div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Gửi mã này cho học sinh để tự gia nhập lớp tại mục "Lớp Học".
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--accent-text)] font-mono text-sm font-semibold tracking-wider">
                      {activeClass.code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(activeClass.code)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs border border-[rgba(27,31,36,0.15)]"
                    >
                      {copiedCode ? <MorphIcon icon={CheckData} size={13} /> : <MorphIcon icon={CopyData} size={13} />}
                      <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                  </div>
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-md bg-[var(--bg-secondary)] space-y-2">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">Chưa có học sinh nào trong lớp</div>
                    <p className="text-[11px] text-[var(--text-secondary)]">Hãy chia sẻ mã mời trên để học sinh tham gia.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-md">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] font-medium text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-2.5">Học Sinh</th>
                          <th className="px-4 py-2.5">Tên Hiển Thị</th>
                          <th className="px-4 py-2.5">Ngày Gia Nhập</th>
                          <th className="px-4 py-2.5 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {members.map((m) => (
                          <tr key={m.user_id} className="hover:bg-[var(--bg-primary)] transition-colors">
                            <td className="px-4 py-2.5 font-medium text-[var(--text-primary)] flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)] text-[10px] font-mono font-semibold">
                                {(m.profile?.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span>{m.profile?.username || 'Học sinh'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                              {m.profile?.full_name || '—'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                              {new Date(m.joined_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => handleRemoveMember(m.user_id, m.profile?.username || 'học sinh')}
                                className="p-1.5 rounded-md text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
                                title="Xóa khỏi lớp"
                              >
                                <MorphIcon icon={Trash2Data} size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GRADEBOOK & PROGRESS */}
            {activeSubTab === 'gradebook' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">Bảng Điểm & Ma Trận Tiến Độ</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      Chỉ tính bài nộp của học sinh trong lớp sau khi được giao và trước hạn nộp.
                    </p>
                  </div>
                  <button
                    onClick={exportGradebook}
                    disabled={detailLoading || !!error}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-md text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <MorphIcon icon={DownloadData} size={13} /> Xuất bảng điểm CSV
                  </button>
                </div>

                {classProblems.length === 0 || members.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-md bg-[var(--bg-secondary)] space-y-2">
                    <div className="text-xs font-semibold text-[var(--text-primary)]">Chưa có dữ liệu tiến độ</div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Lớp học cần có ít nhất 1 bài tập và 1 học sinh để hiển thị ma trận điểm.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-md">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[var(--bg-primary)] text-[var(--text-secondary)] font-medium text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-2.5 sticky left-0 bg-[var(--bg-primary)] z-10 min-w-[160px]">
                            Học Sinh
                          </th>
                          {classProblems.map((cp) => (
                            <th key={cp.problem_id} className="px-3 py-2.5 text-center min-w-[100px]">
                              <div className="truncate max-w-[120px] mx-auto" title={cp.problem?.title}>
                                {cp.problem?.title || 'Bài tập'}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-2.5 text-center font-semibold text-[var(--accent-text)] min-w-[90px]">
                            Tổng AC
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {members.map((m) => {
                          let totalAc = 0;
                          return (
                            <tr key={m.user_id} className="hover:bg-[var(--bg-primary)] transition-colors">
                              <td className="px-4 py-2.5 sticky left-0 bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] z-10 font-medium text-[var(--text-primary)] flex items-center gap-2 border-r border-[var(--border)]">
                                <div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)] text-[9px] font-mono shrink-0">
                                  {(m.profile?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{m.profile?.username}</span>
                              </td>
                              {classProblems.map((cp) => {
                                const prog = progressMap.get(`${m.user_id}_${cp.problem_id}`);
                                const isAc = prog?.status === 'ACCEPTED';
                                if (isAc) totalAc++;

                                return (
                                  <td key={cp.problem_id} className="px-3 py-2 text-center">
                                    {prog ? (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-mono font-medium ${
                                          isAc
                                            ? 'bg-accent/10 text-[var(--accent-text)] border border-accent/25'
                                            : 'bg-danger/10 text-[var(--danger)] border border-danger/25'
                                        }`}
                                      >
                                        {prog.score}đ
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[var(--text-muted)] font-mono">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-2.5 text-center font-mono font-semibold text-[var(--accent-text)] border-l border-[var(--border)]">
                                {totalAc} / {classProblems.length}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal: Thêm bài tập vào lớp */}
        {isAddProblemOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={() => { if (!isAddingProblem) setIsAddProblemOpen(false); }}
          >
            <div
              role="dialog" aria-modal="true" aria-labelledby="assignment-dialog-title"
              className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div>
                  <h3 id="assignment-dialog-title" className="text-sm font-semibold text-[var(--text-primary)]">Giao Bài Tập Cho Lớp Học</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Chọn bài tập từ ngân hàng và thiết lập thời hạn nộp bài.</p>
                </div>
                <button
                  onClick={() => { if (!isAddingProblem) setIsAddProblemOpen(false); }}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                >
                  <MorphIcon icon={XData} size={16} />
                </button>
              </div>

              {assignmentError && <div role="alert" className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">{assignmentError}</div>}
              {problemsLoading && <p role="status" className="text-xs text-[var(--text-muted)]">Đang tải bài tập...</p>}
              {!problemsLoading && !assignmentError && availableProblems.length === 0 && <p className="text-xs text-[var(--text-secondary)]">Ngân hàng chưa có bài tập. Hãy tạo bài tập trước khi giao cho lớp.</p>}
              
              {/* Search problem */}
              <div className="space-y-1.5">
                <label htmlFor="class-problem-search" className="text-xs font-semibold text-[var(--text-secondary)]">Chọn bài tập từ ngân hàng đề</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <MorphIcon icon={SearchData} size={13} />
                  </div>
                  <input
                    type="text"
                    id="class-problem-search"
                    placeholder="Tìm theo tên bài hoặc slug..."
                    value={probSearch}
                    onChange={(e) => setProbSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--bg-primary)]">
                  {availableProblems
                    .filter(
                      (p) =>
                        p.title.toLowerCase().includes(probSearch.toLowerCase()) ||
                        p.slug.toLowerCase().includes(probSearch.toLowerCase())
                    )
                    .map((p) => {
                      const alreadyInClass = classProblems.some((cp) => cp.problem_id === p.id);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          disabled={alreadyInClass || isAddingProblem}
                          aria-pressed={selectedProblemId === p.id}
                          onClick={() => setSelectedProblemId(p.id)}
                          className={`w-full text-left p-2.5 flex items-center justify-between text-xs transition-colors ${
                            alreadyInClass
                              ? 'opacity-40 cursor-not-allowed bg-[var(--bg-tertiary)]'
                              : selectedProblemId === p.id
                              ? 'bg-accent/10 border-l-2 border-[var(--accent)] cursor-pointer'
                              : 'hover:bg-[var(--bg-secondary)] cursor-pointer'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{p.title}</div>
                            <div className="text-[10px] font-mono text-[var(--text-muted)]">/{p.slug}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)]">
                              {p.difficulty}
                            </span>
                            {alreadyInClass && (
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">Đã có</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-1">
                <label htmlFor="class-deadline" className="text-xs font-semibold text-[var(--text-secondary)]">
                  Hạn chót nộp bài (tùy chọn)
                </label>
                <input
                  id="class-deadline"
                  type="datetime-local"
                  disabled={isAddingProblem}
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] font-mono transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => { if (!isAddingProblem) setIsAddProblemOpen(false); }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!selectedProblemId || isAddingProblem || problemsLoading}
                  onClick={handleAddProblemSubmit}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50 transition-colors cursor-pointer border border-[rgba(27,31,36,0.15)] shadow-xs"
                >
                  {isAddingProblem ? 'Đang thêm...' : 'Xác Nhận Thêm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
