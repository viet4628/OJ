import { useEffect, useRef, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import {
  Plus as PlusData,
  Trash2 as Trash2Data,
  X as XData,
  Search as SearchData,
  RefreshCw as RefreshCwData,
  Users as UsersData,
  BookOpen as BookOpenData,
  School as SchoolData,
} from 'lucide';
import {
  getClassrooms,
  createClassroom,
  deleteClassroom,
  type Classroom,
} from '../../../lib/api';
import ClassroomDetailView from './ClassroomDetailView';

export default function TeacherClassroomsTab({ initialClass }: { initialClass?: Classroom | null } = {}) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /* active classroom detail */
  const [activeClassId, setActiveClassId] = useState<string | null>(initialClass?.id || null);
  const [activeClass, setActiveClass] = useState<Classroom | null>(initialClass || null);

  /* create class modal */
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const createPending = useRef(false);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (isCreateOpen && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('#class-name')?.focus();
    }
    if (!isCreateOpen) dialog?.close();
  }, [isCreateOpen]);

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

  /* create class */
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPending.current) return;
    createPending.current = true;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await createClassroom({ name: newClassName, description: newClassDesc, code: newClassCode });
      if (!res.ok || !res.classroom) {
        setCreateError(res.error || 'Tạo lớp thất bại');
        return;
      }
      setNotice(`Đã tạo lớp "${res.classroom.name}". Chia sẻ mã mời hoặc giao bài tập đầu tiên cho lớp.`);
      setIsCreateOpen(false);
      setNewClassName('');
      setNewClassDesc('');
      setNewClassCode('');
      setClassrooms((rows) => [{ ...res.classroom!, student_count: 0, problem_count: 0 }, ...rows]);
      setActiveClass(res.classroom);
      setActiveClassId(res.classroom.id);
    } finally {
      createPending.current = false;
      setIsCreating(false);
    }
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

  const query = searchQuery.trim().toLowerCase();
  const filteredClassrooms = classrooms.filter(
    (c) => !query || c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
  );

  // View: Class Detail
  if (activeClassId) {
    return (
      <ClassroomDetailView key={activeClassId} classId={activeClassId} initialClassroom={activeClass}
        notice={notice} setNotice={setNotice} onBack={() => { setActiveClassId(null); setActiveClass(null); }} />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Quản Lý Lớp Học</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Tạo lớp học, phát mã mời học sinh tham gia và quản lý bài tập theo từng lớp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchClassrooms}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors cursor-pointer"
            title="Làm mới danh sách lớp"
          >
            <MorphIcon icon={RefreshCwData} size={13} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
          <button
            onClick={() => { setCreateError(null); setIsCreateOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={14} /> Tạo Lớp Học
          </button>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="p-3 rounded-md bg-accent/10 border border-accent/25 text-[var(--accent-text)] text-xs font-medium flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
            <MorphIcon icon={XData} size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-[var(--danger)] text-xs font-medium">
          {error}
        </div>
      )}

      {/* Search Filter */}
      {classrooms.length > 0 && (
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <MorphIcon icon={SearchData} size={13} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên lớp hoặc mã mời..."
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          />
        </div>
      )}

      {/* Grid of classrooms */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : error && classrooms.length === 0 ? null : classrooms.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-md bg-[var(--bg-secondary)] space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-tertiary)] text-[var(--accent)] mb-1">
            <MorphIcon icon={SchoolData} size={20} />
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">Bạn chưa có lớp học nào</div>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Bấm "Tạo Lớp Học" để bắt đầu mở lớp và chia sẻ mã mời cho học sinh.
          </p>
          <button
            onClick={() => { setCreateError(null); setIsCreateOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={14} /> Tạo Lớp Ngay
          </button>
        </div>
      ) : filteredClassrooms.length === 0 ? (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-md">
          Không tìm thấy lớp học nào khớp với từ khóa tìm kiếm.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredClassrooms.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveClass(c); setActiveClassId(c.id); }}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveClass(c); setActiveClassId(c.id); } }}
              className="group p-4 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-all shadow-xs hover:shadow-sm cursor-pointer flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[11px] font-semibold text-[var(--accent-text)]">
                    <span>Mã: {c.code}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                    {c.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <MorphIcon icon={UsersData} size={12} className="text-[var(--text-muted)]" />
                    <span>{c.student_count || 0} học sinh</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <MorphIcon icon={BookOpenData} size={12} className="text-[var(--text-muted)]" />
                    <span>{c.problem_count || 0} bài tập</span>
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClass(c.id, c.name);
                  }}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-danger/10 transition-colors cursor-pointer"
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
      <dialog
        ref={createDialogRef}
        aria-labelledby="create-class-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!createPending.current) setIsCreateOpen(false);
        }}
        className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-5 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--border)]">
          <div>
            <h3 id="create-class-title" className="text-sm font-semibold text-[var(--text-primary)]">Tạo lớp học mới</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Tạo lớp, chia sẻ mã mời và giao bài tập cho học sinh.</p>
          </div>
          <button type="button" aria-label="Đóng tạo lớp" disabled={isCreating} onClick={() => setIsCreateOpen(false)} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 cursor-pointer">
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>
        {createError && (
          <div role="alert" className="mb-3 p-2.5 rounded-md bg-danger/10 border border-danger/20 text-xs text-[var(--danger)] font-medium">
            {createError}
          </div>
        )}
        <form onSubmit={handleCreateClass}>
          <fieldset disabled={isCreating} className="space-y-3.5 disabled:opacity-60">
            <div className="space-y-1">
              <label htmlFor="class-name" className="block text-xs font-semibold text-[var(--text-secondary)]">Tên lớp học <span className="text-[var(--danger)]">*</span></label>
              <input id="class-name" type="text" required maxLength={120} autoComplete="off" placeholder="Ví dụ: Tin học 11A" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors" />
            </div>
            <div className="space-y-1">
              <label htmlFor="class-description" className="block text-xs font-semibold text-[var(--text-secondary)]">Mô tả lớp <span className="text-[var(--text-muted)] font-normal">(tùy chọn)</span></label>
              <textarea id="class-description" rows={3} maxLength={2000} placeholder="Mục tiêu học tập, đối tượng hoặc lưu ý cho học sinh..." value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} className="w-full px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors" />
            </div>
            <div className="space-y-1">
              <label htmlFor="class-code" className="block text-xs font-semibold text-[var(--text-secondary)]">Mã mời <span className="text-[var(--text-muted)] font-normal">(tùy chọn)</span></label>
              <input id="class-code" type="text" autoComplete="off" spellCheck={false} pattern="[A-Z0-9]{4,10}" maxLength={10} title="Mã mời gồm 4–10 chữ cái A–Z hoặc số 0–9" aria-describedby="class-code-hint" placeholder="Để trống để tạo mã tự động" value={newClassCode} onChange={(e) => setNewClassCode(e.target.value.toUpperCase())} className="w-full px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors" />
              <p id="class-code-hint" className="text-[11px] text-[var(--text-muted)]">4–10 ký tự A–Z, 0–9. Để trống để nhận mã ngẫu nhiên 6 ký tự.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors cursor-pointer">Hủy</button>
              <button type="submit" className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors cursor-pointer disabled:opacity-50">{isCreating ? 'Đang tạo lớp...' : 'Tạo lớp học'}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </div>
  );
}
