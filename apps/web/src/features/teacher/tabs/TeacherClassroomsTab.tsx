import { useEffect, useRef, useState } from 'react';
import MorphIcon from '../../../components/MorphIcon';
import { Plus as PlusData, Trash2 as Trash2Data, X as XData } from 'lucide';
import {
  getClassrooms,
  createClassroom,
  deleteClassroom,
  type Classroom,
} from '../../../lib/api';
import ClassroomDetailView from './ClassroomDetailView';

export default function TeacherClassroomsTab() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* active classroom detail */
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeClass, setActiveClass] = useState<Classroom | null>(null);

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

  // View: Class Detail
  if (activeClassId) {
    return (
      <ClassroomDetailView key={activeClassId} classId={activeClassId} initialClassroom={activeClass}
        notice={notice} setNotice={setNotice} onBack={() => { setActiveClassId(null); setActiveClass(null); }} />
    );
  }

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
        <div className="flex items-center gap-2">
          <button onClick={fetchClassrooms} disabled={loading} className="px-3 py-2 rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">Tải lại danh sách</button>
          <button
            onClick={() => { setCreateError(null); setIsCreateOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <MorphIcon icon={PlusData} size={14} /> Tạo Lớp Học Mới
          </button>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className="p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid of classrooms */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
          Đang tải danh sách lớp học...
        </div>
      ) : error && classrooms.length === 0 ? null : classrooms.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)] space-y-3">

          <div className="text-sm font-bold text-[var(--text-primary)]">Bạn chưa có lớp học nào</div>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Bấm "Tạo Lớp Học Mới" để bắt đầu mở lớp và chia sẻ mã mời cho học sinh.
          </p>
          <button
            onClick={() => { setCreateError(null); setIsCreateOpen(true); }}
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
              role="button"
              tabIndex={0}
              onClick={() => { setActiveClass(c); setActiveClassId(c.id); }}
              onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setActiveClass(c); setActiveClassId(c.id); } }}
              className="group p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-accent/50 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">

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
                     {c.student_count || 0} học sinh
                  </span>
                  <span className="flex items-center gap-1 font-semibold">
                     {c.problem_count || 0} bài tập
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClass(c.id, c.name);
                  }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
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
        className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-5 text-[var(--text-primary)] shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 id="create-class-title" className="text-sm font-semibold">Tạo lớp học mới</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Tạo lớp, chia sẻ mã mời và giao bài tập cho học sinh.</p>
          </div>
          <button type="button" aria-label="Đóng tạo lớp" disabled={isCreating} onClick={() => setIsCreateOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>
        {createError && <p role="alert" className="mb-3 text-xs text-[var(--danger)]">{createError}</p>}
        <form onSubmit={handleCreateClass}>
          <fieldset disabled={isCreating} className="space-y-4 disabled:opacity-60">
            <div className="space-y-1.5">
              <label htmlFor="class-name" className="block text-xs font-medium">Tên lớp học <span className="text-[var(--text-muted)]">(bắt buộc)</span></label>
              <input id="class-name" type="text" required maxLength={120} autoComplete="off" placeholder="Ví dụ: Tin học 11A" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="class-description" className="block text-xs font-medium">Mô tả lớp <span className="text-[var(--text-muted)]">(tùy chọn)</span></label>
              <textarea id="class-description" rows={3} maxLength={2000} placeholder="Mục tiêu học tập, đối tượng hoặc lưu ý cho học sinh..." value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="class-code" className="block text-xs font-medium">Mã mời <span className="text-[var(--text-muted)]">(tùy chọn)</span></label>
              <input id="class-code" type="text" autoComplete="off" spellCheck={false} pattern="[A-Z0-9]{4,10}" maxLength={10} title="Mã mời gồm 4–10 chữ cái A–Z hoặc số 0–9" aria-describedby="class-code-hint" placeholder="Để trống để tạo mã tự động" value={newClassCode} onChange={(e) => setNewClassCode(e.target.value.toUpperCase())} className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] font-mono text-sm focus:outline-none focus:border-[var(--accent)]" />
              <p id="class-code-hint" className="text-xs text-[var(--text-muted)]">4–10 chữ cái hoặc số, không có dấu cách. Để trống để nhận mã ngẫu nhiên gồm 6 ký tự.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-2 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">Hủy</button>
              <button type="submit" className="px-3 py-2 rounded-md text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white">{isCreating ? 'Đang tạo lớp...' : 'Tạo lớp học'}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </div>
  );
}
