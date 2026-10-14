import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2, Trophy, ArrowRight, CheckCircle2, Zap, ShieldCheck, Terminal,
  Users, Sparkles, Play, Calendar, Clock, Lock, Megaphone, Gauge, X, ChevronRight
} from 'lucide-react';
import { getAnnouncements, getContests, type Announcement, type Contest } from '../../lib/api';

interface LandingProps {
  onOpenAuth: () => void;
}

const CONTEST_STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: { label: 'Đang diễn ra', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse-glow' },
  NOT_STARTED: { label: 'Sắp diễn ra', className: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  ENDED: { label: 'Đã kết thúc', className: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const FEATURES = [
  {
    icon: Zap,
    color: 'text-[var(--accent-text)]',
    bg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20',
    title: 'Chấm bài siêu tốc & chính xác',
    desc: 'Judge worker phân tích thuật toán trong mili-giây, báo kết quả chi tiết đến từng testcase: Accepted, Wrong Answer hay Time Limit.',
  },
  {
    icon: Terminal,
    color: 'text-sky-700',
    bg: 'bg-sky-50 border-sky-200',
    title: 'Đa ngôn ngữ lập trình',
    desc: 'Hỗ trợ mượt mà C++, Python, Rust và nhiều hơn nữa — soạn code trực tiếp trên web với trình biên tập Monaco hiện đại.',
  },
  {
    icon: ShieldCheck,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    title: 'Sandbox cách ly an toàn',
    desc: 'Mỗi bài nộp chạy trong môi trường rsjudge giới hạn CPU/RAM (cgroups v2 + seccomp) — an toàn tuyệt đối cho hệ thống.',
  },
  {
    icon: Gauge,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    title: 'Xếp hạng realtime',
    desc: 'Bảng xếp hạng ACM/ICPC & OI subtask cập nhật tức thì theo thời gian AC, penalty chuẩn quốc tế cho mọi kỳ thi.',
  },
  {
    icon: Users,
    color: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
    title: 'Nhóm lớp & quản trị RBAC',
    desc: 'Giáo viên soạn đề, nhập testcase ẩn, phân quyền giáo viên/học sinh chi tiết — học sinh làm bài trực tuyến, điểm tự động tổng hợp.',
  },
  {
    icon: Trophy,
    color: 'text-rose-700',
    bg: 'bg-rose-50 border-rose-200',
    title: 'Tổ chức cuộc thi chuyên nghiệp',
    desc: 'Kỳ thi tự mở/đóng đúng giờ theo cơ sở dữ liệu, chống nộp trễ, lịch sử nộp bài và thống kê công khai minh bạch.',
  },
];

const STATUS_PRIORITY: Record<Contest['status'], number> = {
  UNDERWAY: 0,
  NOT_STARTED: 1,
  ENDED: 2,
};

export default function Landing({ onOpenAuth }: LandingProps) {
  const [contests, setContests] = useState<Contest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedNews, setSelectedNews] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedNews) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNews(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNews]);

  useEffect(() => {
    (async () => {
      try {
        const [cons, anns] = await Promise.all([getContests(), getAnnouncements()]);
        setContests(cons);
        setAnnouncements(anns);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const featuredContests = [...contests]
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .slice(0, 3);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full bg-[#F8FAFC]/50 min-h-screen">
      {/* ───────── KHUNG LAYOUT TOÀN DIỆN: 3/4 KHỐI CHÍNH & 1/4 STICKY SIDEBAR ───────── */}
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ════════════════════════════════════════════════════════════
             CỘT TRÁI (3/4 - KHỐI NỘI DUNG CHÍNH): HERO + FEATURES + CTA
             ════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-8 lg:space-y-12">
            
            {/* ── KHỐI 1: HERO CARD (2 CỘT: TEXT BÊN TRÁI & IDE THU NHỎ BÊN PHẢI) ── */}
            <section className="rounded-3xl bg-white border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow p-6 sm:p-8 lg:p-9 relative overflow-hidden">
              {/* Soft Ambient Glow */}
              <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-50/70 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-50/60 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-center">
                {/* Cột trái bên trong Hero: Text & Buttons */}
                <div className="xl:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] text-xs font-bold border border-[var(--accent)]/20 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Hệ thống hỗ trợ học lập trình &amp; chấm bài tự động
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-slate-900 leading-[1.18]">
                    Chinh phục
                    <br />
                    đỉnh cao lập trình
                    <br />
                    <span className="text-[var(--accent-text)]">
                      chấm bài trong tích tắc.
                    </span>
                  </h1>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                    CodeJudge VN là nơi bạn luyện tập thuật toán với hệ chấm tự động 24/7, giáo viên tạo bài kiểm tra không lo chấm tay, và tổ chức cuộc thi nội bộ chuẩn ACM/OI — tất cả miễn phí trên một nền tảng duy nhất.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Link
                      to="/problems"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-colors"
                    >
                      Luyện tập ngay <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/contests"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm border border-[var(--border)] shadow-sm transition-colors"
                    >
                      <Trophy className="w-4 h-4 text-amber-500" /> Xem cuộc thi
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Không cần cài đặt</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Chấm trong vài giây</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)]" /> Miễn phí cho học sinh</span>
                  </div>
                </div>

                {/* Cột phải bên trong Hero: IDE Mockup Thu Nhỏ Được Bê Lên Đặt Ngang Hàng */}
                <div className="xl:col-span-5">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-[#1E1E1E]">
                    {/* Header bar */}
                    <div className="h-8 bg-[#2D2D2D] border-b border-slate-700/60 flex items-center justify-between px-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="ml-2 text-[11px] font-bold text-slate-300 font-code">welcome.cpp</span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        C++17 (g++)
                      </span>
                    </div>

                    {/* Code Snippet */}
                    <pre className="text-[11px] sm:text-xs font-code leading-relaxed p-4 text-left text-slate-200 overflow-x-auto">
                      <code>
                        <span className="text-purple-400">#include</span> <span className="text-emerald-300">&lt;iostream&gt;</span>{'\n'}
                        <span className="text-blue-400">using namespace</span> <span className="text-slate-300">std;</span>{'\n\n'}
                        <span className="text-blue-400">int</span> <span className="text-yellow-300">main</span><span className="text-slate-300">() {'{'}</span>{'\n'}
                        {'    '}<span className="text-blue-400">int</span> a, b;{'\n'}
                        {'    '}cin &gt;&gt; a &gt;&gt; b;{'\n'}
                        {'    '}cout &lt;&lt; a + b;{'\n'}
                        {'    '}<span className="text-purple-400">return</span> <span className="text-yellow-300">0</span>;{'\n'}
                        <span className="text-slate-300">{'}'}</span>
                      </code>
                    </pre>

                    {/* Result Bar */}
                    <div className="bg-white border-t border-slate-200 p-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> CHÍNH XÁC (AC)
                      </span>
                      <div className="flex items-center gap-3 text-[11px] font-code font-bold text-slate-600">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> 12 ms</span>
                        <span>1024KB · 5/5 tests</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── KHỐI 2: CÔNG NGHỆ CỐT LÕI (FEATURES GRID) ── */}
            <section className="space-y-8">
              <div className="text-center space-y-2.5 max-w-2xl mx-auto">
                <p className="font-code text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">
                  Công nghệ cốt lõi
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Trải nghiệm vượt trội
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Được thiết kế tỉ mỉ để mang lại môi trường lập trình mượt mà, chính xác và chuyên nghiệp nhất cho người học.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {FEATURES.map((f) => (
                  <div key={f.title} className="bg-white rounded-3xl border border-[var(--border)] p-6 shadow-sm hover:shadow-md hover:border-[var(--accent)]/40 transition-all space-y-3">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${f.bg}`}>
                      <f.icon className={`w-6 h-6 ${f.color}`} />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">{f.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── KHỐI 3: BANNER HÀNH ĐỘNG (FINAL CTA) ── */}
            <section>
              <div className="rounded-3xl bg-slate-900 px-8 py-12 text-center space-y-5 relative overflow-hidden border border-slate-800 shadow-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 font-code text-xs font-semibold border border-white/10">
                  <Megaphone className="w-3.5 h-3.5" /> Bắt đầu hành trình
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight relative">
                  Sẵn sàng trở thành<br />siêu coder?
                </h2>
                <p className="text-sm text-slate-400 max-w-xl mx-auto relative">
                  Tạo tài khoản ngay hôm nay — chọn một bài dễ khởi động, nộp code đầu tiên và cảm nhận niềm vui của dòng chữ{" "}
                  <span className="font-code text-emerald-400 font-bold">Accepted</span>.
                </p>
                <button
                  onClick={onOpenAuth}
                  className="relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-black text-sm shadow-lg shadow-emerald-900/40 transition-colors cursor-pointer"
                >
                  <Code2 className="w-4 h-4" /> Tạo tài khoản miễn phí
                </button>
              </div>
            </section>
          </div>

          {/* ════════════════════════════════════════════════════════════
             CỘT PHẢI (1/4 - SIDEBAR STICKY TOÀN TRANG): CUỘC THI & TIN TỨC
             Luôn luôn hiển thị và ghim trôi theo suốt từ đầu đến hết trang!
             ════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6 lg:sticky lg:top-20 self-start">
            
            {/* Widget 1: Top Cuộc Thi Lập Trình */}
            <div className="rounded-3xl bg-white border border-[var(--border)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="space-y-0.5">
                  <p className="font-code text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    Top Cuộc Thi
                  </p>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" /> Cuộc thi CodeJudge
                  </h2>
                </div>
                <Link
                  to="/contests"
                  className="text-xs font-bold text-[var(--accent-text)] hover:underline flex items-center gap-0.5"
                >
                  Tất cả <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Đang tải cuộc thi...</div>
              ) : featuredContests.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  Chưa có cuộc thi nào đang mở.
                </div>
              ) : (
                <div className="space-y-3">
                  {featuredContests.map((c) => {
                    const meta = CONTEST_STATUS_META[c.status];
                    return (
                      <Link
                        key={c.id}
                        to={`/contests/${c.id}`}
                        className="block p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 hover:border-[var(--accent)]/50 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                          <span className="text-[10px] font-code font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {c.rule_type}
                          </span>
                        </div>

                        <h3 className="text-xs font-extrabold text-slate-900 group-hover:text-[var(--accent-text)] transition-colors line-clamp-1">
                          {c.title}
                        </h3>

                        <div className="text-[11px] text-[var(--text-secondary)] font-code flex items-center gap-1.5 mt-2">
                          <Calendar className="w-3 h-3 text-slate-400" /> {formatTime(c.start_time)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Widget 2: Tin Tức & Sự Kiện Mới Nhất */}
            <div className="rounded-3xl bg-white border border-[var(--border)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="space-y-0.5">
                  <p className="font-code text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    Cập Nhật Mới Nhất
                  </p>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-500" /> Tin tức &amp; Sự kiện
                  </h2>
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Đang tải tin tức...</div>
              ) : announcements.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  Chưa có thông báo mới.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedNews(item)}
                      className="w-full text-left p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/80 hover:border-[var(--accent)]/50 transition-all space-y-2 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] font-code font-bold text-[10px] border border-[var(--accent)]/20">
                          {item.tag || 'HỆ THỐNG'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {new Date(item.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-[var(--accent-text)] transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                        {item.content}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-text)]">
                        Đọc tiếp <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ───────── NEWS DETAIL MODAL ───────── */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedNews(null)}
        >
          <div role="dialog" aria-modal="true" aria-label={selectedNews.title} className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[var(--border)] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 pr-8 relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-text)] font-code font-bold text-[10px]">
                  {selectedNews.tag || 'HỆ THỐNG'}
                </span>
                <h3 className="font-extrabold text-sm text-slate-900 truncate">{selectedNews.title}</h3>
              </div>
              <button
                onClick={() => setSelectedNews(null)}
                className="absolute right-0 top-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedNews.content}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] font-code">
              <span>Đăng bởi: {selectedNews.author || 'Admin'}</span>
              <span>{new Date(selectedNews.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
