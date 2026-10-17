import { useEffect, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  GraduationCap as GraduationCapData,
  Plus as PlusData,
  Users as UsersData,
  BookOpen as BookOpenData,
  Copy as CopyData,
  Check as CheckData,
  Trash2 as Trash2Data,
  Clock as ClockData,
  ArrowLeft as ArrowLeftData,
  X as XData,
  Search as SearchData,
  Award as AwardData,
  CheckCircle2 as CheckCircle2Data,
  XCircle as XCircleData,
} from 'lucide';
import {
  getClassrooms,
  getClassroomDetail,
  createClassroom,
  deleteClassroom,
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

type SubTab = 'assignments' | 'students' | 'gradebook';

export default function TeacherClassroomsTab() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* active classroom detail */
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [classProblems, setClassProblems] = useState<ClassroomProblem[]>([]);
  const [progressList, setProgressList] = useState<ClassroomProgressItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('assignments');

  /* create class modal */
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* add problem modal */
  const [isAddProblemOpen, setIsAddProblemOpen] = useState(false);
  const [availableProblems, setAvailableProblems] = useState<Problem[]>([]);
  const [probSearch, setProbSearch] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [deadlineInput, setDeadlineInput] = useState('');
  const [isAddingProblem, setIsAddingProblem] = useState(false);

  /* copied state */
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchClassrooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClassrooms(true);
      setClassrooms(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const loadClassDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await getClassroomDetail(id);
      if (res.error) {
        setNotice(res.error);
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
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (activeClassId) {
      loadClassDetail(activeClassId);
    } else {
      setActiveClass(null);
      setMembers([]);
      setClassProblems([]);
      setProgressList([]);
    }
  }, [activeClassId]);

  /* create class */
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    const res = await createClassroom({
      name: newClassName,
      description: newClassDesc,
      code: newClassCode || undefined,
    });
    setIsCreating(false);
    if (!res.ok) {
      setCreateError(res.error || 'Tạo lớp thất bại');
      return;
    }
    setNotice(`Đã tạo lớp "${res.classroom?.name}" thành công`);
    setIsCreateOpen(false);
    setNewClassName('');
    setNewClassDesc('');
    setNewClassCode('');
    fetchClassrooms();
  };

  /* delete class */
  const handleDeleteClass = async (id: string, name: string) => {
    if (!window.confirm(`Xóa vĩnh viễn lớp "${name}"? Toàn bộ bài tập và dữ liệu học sinh trong lớp sẽ bị hủy.`)) return;
    const res = await deleteClassroom(id);
    if (!res.ok) {
      alert(res.error || 'Xóa lớp thất bại');
      return;
    }
    setNotice(`Đã xóa lớp "${name}"`);
    if (activeClassId === id) setActiveClassId(null);
    fetchClassrooms();
  };

  /* copy invite code */
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  /* open problem picker modal */
  const handleOpenAddProblem = async () => {
    setIsAddProblemOpen(true);
    setSelectedProblemId('');
    setDeadlineInput('');
    setProbSearch('');
    if (availableProblems.length === 0) {
      const all = await getAllProblems();
      setAvailableProblems(all);
    }
  };

  /* add problem to class */
  const handleAddProblemSubmit = async () => {
    if (!activeClassId || !selectedProblemId) return;
    setIsAddingProblem(true);
    const deadlineVal = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    const res = await addClassroomProblem(activeClassId, selectedProblemId, deadlineVal);
    setIsAddingProblem(false);
    if (!res.ok) {
      alert(res.error || 'Không thể thêm bài tập');
      return;
    }
    setIsAddProblemOpen(false);
    setNotice('Đã thêm bài tập vào lớp học');
    loadClassDetail(activeClassId);
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

  // View: Class Detail
  if (activeClassId && activeClass) {
    return (
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveClassId(null)}
              className="p-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] transition-colors cursor-pointer"
            >
              <MorphIcon icon={ArrowLeftData} size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-[var(--text-primary)]">{activeClass.name}</h2>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold">
                  <span>Mã: {activeClass.code}</span>
                  <button
                    onClick={() => handleCopyCode(activeClass.code)}
                    className="hover:opacity-75 transition-opacity cursor-pointer"
                    title="Sao chép mã lớp"
                  >
                    {copiedCode ? <MorphIcon icon={CheckData} size={12} className="text-[var(--accent-text)]" /> : <MorphIcon icon={CopyData} size={12} />}
                  </button>
                </div>
              </div>
              {activeClass.description && (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{activeClass.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddProblem}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <MorphIcon icon={PlusData} size={14} /> Giao Bài Tập
            </button>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <MorphIcon icon={XData} size={16} />
            </button>
          </div>
        )}

        {/* Subtabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveSubTab('assignments')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'assignments'
                ? 'border-[var(--accent)] text-[var(--accent-text)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MorphIcon icon={BookOpenData} size={14} /> Bài Tập ({classProblems.length})
          </button>
          <button
            onClick={() => setActiveSubTab('students')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'students'
                ? 'border-[var(--accent)] text-[var(--accent-text)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MorphIcon icon={UsersData} size={14} /> Học Sinh ({members.length})
          </button>
          <button
            onClick={() => setActiveSubTab('gradebook')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-colors cursor-pointer ${
              activeSubTab === 'gradebook'
                ? 'border-[var(--accent)] text-[var(--accent-text)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MorphIcon icon={AwardData} size={14} /> Bảng Điểm & Tiến Độ
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
                  <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-3">
                    <MorphIcon icon={BookOpenData} size={28} className="text-[var(--text-muted)] mx-auto" />
                    <div className="text-xs font-bold text-[var(--text-primary)]">Chưa có bài tập nào trong lớp</div>
                    <p className="text-[11px] text-[var(--text-muted)]">Hãy thêm bài tập từ kho đề để học sinh bắt đầu làm bài.</p>
                    <button
                      onClick={handleOpenAddProblem}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold cursor-pointer"
                    >
                      <MorphIcon icon={PlusData} size={14} /> Giao bài tập ngay
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold text-[11px] uppercase border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-3">Bài Tập</th>
                          <th className="px-4 py-3">Độ Khó</th>
                          <th className="px-4 py-3">Thời Gian / RAM</th>
                          <th className="px-4 py-3">Hạn Nộp</th>
                          <th className="px-4 py-3 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {classProblems.map((cp) => {
                          const p = cp.problem;
                          const hasDeadline = !!cp.deadline;
                          const isExpired = hasDeadline && new Date(cp.deadline!).getTime() < Date.now();
                          return (
                            <tr key={cp.problem_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                              <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                                <div className="font-bold">{p?.title || cp.problem_id}</div>
                                <div className="text-[11px] font-mono text-[var(--text-muted)]">/{p?.slug}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                    p?.difficulty === 'Easy'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : p?.difficulty === 'Medium'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {p?.difficulty || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                                {p ? `${p.time_limit_ms}ms / ${p.memory_limit_mb}MB` : '-'}
                              </td>
                              <td className="px-4 py-3">
                                {hasDeadline ? (
                                  <span
                                    className={`inline-flex items-center gap-1 font-mono text-xs ${
                                      isExpired ? 'text-red-500 font-bold' : 'text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    <MorphIcon icon={ClockData} size={12} />
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
                                  <span className="text-[var(--text-muted)] italic">Không có hạn</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleRemoveProblem(cp.problem_id, p?.title || 'Bài tập')}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
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
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300">Mã Mời Tham Gia Lớp Học</div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Gửi mã này cho học sinh. Học sinh chỉ cần nhập mã tại mục "Lớp Học" để tự động gia nhập lớp.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-4 py-2 rounded-xl bg-[var(--bg-primary)] border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-base font-black tracking-wider">
                      {activeClass.code}
                    </span>
                    <button
                      onClick={() => handleCopyCode(activeClass.code)}
                      className="px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode ? <MorphIcon icon={CheckData} size={14} /> : <MorphIcon icon={CopyData} size={14} />}
                      <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                  </div>
                </div>

                {members.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-2">
                    <MorphIcon icon={UsersData} size={28} className="text-[var(--text-muted)] mx-auto" />
                    <div className="text-xs font-bold text-[var(--text-primary)]">Chưa có học sinh nào trong lớp</div>
                    <p className="text-[11px] text-[var(--text-muted)]">Hãy chia sẻ mã mời trên để học sinh tham gia.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold text-[11px] uppercase border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-3">Học Sinh</th>
                          <th className="px-4 py-3">Tên Hiển Thị</th>
                          <th className="px-4 py-3">Ngày Gia Nhập</th>
                          <th className="px-4 py-3 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {members.map((m) => (
                          <tr key={m.user_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                            <td className="px-4 py-3 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-black">
                                {(m.profile?.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-bold">{m.profile?.username || 'Học sinh'}</span>
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {m.profile?.full_name || '-'}
                            </td>
                            <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                              {new Date(m.joined_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveMember(m.user_id, m.profile?.username || 'học sinh')}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
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
                {classProblems.length === 0 || members.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-2">
                    <MorphIcon icon={AwardData} size={28} className="text-[var(--text-muted)] mx-auto" />
                    <div className="text-xs font-bold text-[var(--text-primary)]">Chưa có dữ liệu tiến độ</div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Lớp học cần có ít nhất 1 bài tập và 1 học sinh để xem ma trận điểm.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold text-[11px] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-4 py-3 sticky left-0 bg-[var(--bg-secondary)] z-10 min-w-[160px]">
                            Học Sinh
                          </th>
                          {classProblems.map((cp) => (
                            <th key={cp.problem_id} className="px-3 py-3 text-center min-w-[100px]">
                              <div className="font-bold truncate max-w-[120px] mx-auto" title={cp.problem?.title}>
                                {cp.problem?.title || 'Bài tập'}
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400 min-w-[90px]">
                            Tổng AC
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {members.map((m) => {
                          let totalAc = 0;
                          return (
                            <tr key={m.user_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                              <td className="px-4 py-3 sticky left-0 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] z-10 font-semibold text-[var(--text-primary)] flex items-center gap-2 border-r border-[var(--border)]">
                                <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                  {(m.profile?.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate">{m.profile?.username}</span>
                              </td>
                              {classProblems.map((cp) => {
                                const prog = progressMap.get(`${m.user_id}_${cp.problem_id}`);
                                const isAc = prog?.status === 'ACCEPTED';
                                if (isAc) totalAc++;

                                return (
                                  <td key={cp.problem_id} className="px-3 py-2.5 text-center">
                                    {prog ? (
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                          isAc
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                                        }`}
                                      >
                                        {isAc ? <MorphIcon icon={CheckCircle2Data} size={12} /> : <MorphIcon icon={XCircleData} size={12} />}
                                        {prog.score}đ
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-[var(--text-muted)] font-mono">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 border-l border-[var(--border)]">
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsAddProblemOpen(false)}
          >
            <div
              className="w-full max-w-lg bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <h3 className="text-sm font-black text-[var(--text-primary)]">Giao Bài Tập Cho Lớp Học</h3>
                <button
                  onClick={() => setIsAddProblemOpen(false)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <MorphIcon icon={XData} size={16} />
                </button>
              </div>

              {/* Search problem */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Chọn bài tập từ ngân hàng đề</label>
                <div className="relative">
                  <MorphIcon icon={SearchData} size={16} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên bài hoặc slug..."
                    value={probSearch}
                    onChange={(e) => setProbSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-xl divide-y divide-[var(--border)] bg-[var(--bg-secondary)]/50">
                  {availableProblems
                    .filter(
                      (p) =>
                        p.title.toLowerCase().includes(probSearch.toLowerCase()) ||
                        p.slug.toLowerCase().includes(probSearch.toLowerCase())
                    )
                    .map((p) => {
                      const alreadyInClass = classProblems.some((cp) => cp.problem_id === p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => !alreadyInClass && setSelectedProblemId(p.id)}
                          className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                            alreadyInClass
                              ? 'opacity-40 cursor-not-allowed bg-[var(--bg-tertiary)]'
                              : selectedProblemId === p.id
                              ? 'bg-[var(--accent)]/15 border-l-4 border-[var(--accent)] cursor-pointer'
                              : 'hover:bg-[var(--bg-secondary)] cursor-pointer'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-[var(--text-primary)]">{p.title}</div>
                            <div className="text-[10px] font-mono text-[var(--text-muted)]">/{p.slug}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                              {p.difficulty}
                            </span>
                            {alreadyInClass && (
                              <span className="text-[10px] text-amber-500 font-bold">Đã có</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Hạn chót nộp bài (tùy chọn)
                </label>
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsAddProblemOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!selectedProblemId || isAddingProblem}
                  onClick={handleAddProblemSubmit}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50 transition-colors cursor-pointer"
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

  // View: Classrooms Grid / List
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Quản Lý Lớp Học</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Tạo lớp học, phát mã mời học sinh tham gia và quản lý bài tập theo từng lớp.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <MorphIcon icon={PlusData} size={14} /> Tạo Lớp Học Mới
        </button>
      </div>

      {/* Notices */}
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid of classrooms */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
          Đang tải danh sách lớp học...
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-3">
          <MorphIcon icon={GraduationCapData} size={36} className="text-[var(--text-muted)] mx-auto" />
          <div className="text-sm font-bold text-[var(--text-primary)]">Bạn chưa có lớp học nào</div>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Bấm "Tạo Lớp Học Mới" để bắt đầu mở lớp và chia sẻ mã mời cho học sinh.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={14} /> Tạo Lớp Ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveClassId(c.id)}
              className="group p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
                    <MorphIcon icon={GraduationCapData} size={16} />
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-xs font-bold text-[var(--text-secondary)]">
                    <span>Mã: {c.code}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                    {c.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-semibold">
                    <MorphIcon icon={UsersData} size={13} className="text-[var(--text-muted)]" /> {c.student_count || 0} học sinh
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                    <MorphIcon icon={BookOpenData} size={13} className="text-[var(--text-muted)]" /> {c.problem_count || 0} bài tập
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClass(c.id, c.name);
                  }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Xóa lớp học"
                >
                  <MorphIcon icon={Trash2Data} size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Tạo lớp mới */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <MorphIcon icon={GraduationCapData} size={16} className="text-[var(--accent-text)]" />
                <h3 className="text-sm font-black text-[var(--text-primary)]">Tạo Lớp Học Mới</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <MorphIcon icon={XData} size={16} />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">{createError}</div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Tên lớp học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tin học 11A - THPT Chuyên"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả mục tiêu lớp học, giáo trình hoặc lưu ý cho học sinh..."
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">
                  Mã mời tùy chỉnh (để trống sẽ tự động sinh)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: TIN11A"
                  value={newClassCode}
                  onChange={(e) => setNewClassCode(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] uppercase"
                />
                <p className="text-[11px] text-[var(--text-muted)]">Mã gồm 4-10 ký tự chữ và số.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors cursor-pointer"
                >
                  {isCreating ? 'Đang tạo...' : 'Tạo Lớp Học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

