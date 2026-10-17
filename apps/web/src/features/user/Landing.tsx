import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MorphIcon from '../../components/MorphIcon';
import {
  Code2 as Code2Data,
  Trophy as TrophyData,
  ArrowRight as ArrowRightData,
  CheckCircle2 as CheckCircle2Data,
  Zap as ZapData,
  ShieldCheck as ShieldCheckData,
  Terminal as TerminalData,
  Users as UsersData,
  Sparkles as SparklesData,
  Calendar as CalendarData,
  ChevronRight as ChevronRightData,
  X as XData,
} from 'lucide';
import { getAnnouncements, getContests, type Announcement, type Contest } from '../../lib/api';

interface LandingProps {
  onOpenAuth: () => void;
}

const CONTEST_STATUS_META: Record<Contest['status'], { label: string; className: string; dot: string }> = {
  UNDERWAY: { label: 'Đang diễn ra', className: 'border-[var(--accent)] text-[var(--accent-text)] bg-[var(--accent)]/10', dot: 'bg-[var(--accent)]' },
  NOT_STARTED: { label: 'Sắp diễn ra', className: 'border-[var(--border)] text-[var(--text-secondary)] bg-[var(--bg-tertiary)]', dot: 'bg-[var(--text-muted)]' },
  ENDED: { label: 'Đã kết thúc', className: 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-tertiary)]', dot: 'bg-[var(--border)]' },
};

const FEATURES = [
  {
    icon: ZapData,
    title: 'Chấm bài tức thì & chính xác',
    desc: 'Judge worker biên dịch và thực thi thuật toán trong mili-giây, streaming kết quả từng testcase: AC, WA, TLE, MLE.',
  },
  {
    icon: TerminalData,
    title: 'Đa ngôn ngữ lập trình',
    desc: 'Hỗ trợ C++, Python, Rust và Java với trình soạn thảo Monaco Editor đồng bộ phím tắt và highlight cú pháp.',
  },
  {
    icon: ShieldCheckData,
    title: 'Sandbox cách ly bảo mật',
    desc: 'Mỗi bài nộp chạy trong sandbox rsjudge (cgroups v2 + rlimits) hoặc bubblewrap, ngăn chặn hoàn toàn can thiệp hệ thống.',
  },
  {
    icon: UsersData,
    title: 'Không gian Giáo viên & Lớp học',
    desc: 'Giáo viên quản lý đề bài, testcase chấm ẩn, mở lớp học và kiểm tra tiến độ học sinh trên cùng một nền tảng thống nhất.',
  },
  {
    icon: TrophyData,
    title: 'Tổ chức kỳ thi trực tuyến',
    desc: 'Hệ thống tự động mở/đóng kỳ thi theo lịch, bảo mật mã nguồn và xếp hạng công khai minh bạch.',
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
    <div className="w-full bg-[var(--bg-primary)] min-h-screen">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* CỘT TRÁI (9 cols): HERO + FEATURES */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            
            {/* HERO BOX: GitHub style container */}
            <section className="rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] p-6 sm:p-8">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
                {/* Left Text */}
                <div className="xl:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-mono">
                    <MorphIcon icon={SparklesData} size={14} className="text-[var(--accent-text)]" /> Nền tảng chấm bài tự động &amp; luyện tập thuật toán
                  </div>

                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    Nền tảng luyện tập lập trình thi đấu trực tuyến.
                  </h1>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                    CodeJudge VN cung cấp môi trường giải bài thuật toán trực tuyến với hệ thống chấm tự động sandbox, hỗ trợ giáo viên tổ chức kỳ thi và quản lý lớp học.
                  </p>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <Link
                      to="/problems"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs border border-[rgba(27,31,36,0.15)] shadow-xs transition-colors"
                    >
                      Bắt đầu làm bài <MorphIcon icon={ArrowRightData} size={14} />
                    </Link>
                    <Link
                      to="/contests"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium text-xs border border-[var(--border)] transition-colors"
                    >
                      Kỳ thi trực tuyến
                    </Link>
                  </div>
                </div>

                {/* Right: Code Sandbox Preview (GitHub Blob Style) */}
                <div className="xl:col-span-5">
                  <div className="rounded-md overflow-hidden border border-[var(--border)] bg-[#0d1117]">
                    {/* Header bar */}
                    <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#7d8590]">
                        <MorphIcon icon={TerminalData} size={14} className="text-[#58a6ff]" />
                        <span>solution.cpp</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#3fb950] bg-[#3fb950]/10 px-1.5 py-0.2 rounded border border-[#3fb950]/30">
                        C++17 (g++)
                      </span>
                    </div>

                    {/* Code Snippet */}
                    <pre className="text-[11px] font-mono leading-relaxed p-3.5 text-left text-[#e6edf3] overflow-x-auto">
                      <code>
                        <span className="text-[#ff7b72]">#include</span> <span className="text-[#a5d6ff]">&lt;iostream&gt;</span>{'\n'}
                        <span className="text-[#ff7b72]">using namespace</span> <span className="text-[#e6edf3]">std;</span>{'\n\n'}
                        <span className="text-[#ff7b72]">int</span> <span className="text-[#d2a8ff]">main</span><span className="text-[#e6edf3]">() {'{'}</span>{'\n'}
                        {'    '}<span className="text-[#ff7b72]">long long</span> a, b;{'\n'}
                        {'    '}cin &gt;&gt; a &gt;&gt; b;{'\n'}
                        {'    '}cout &lt;&lt; a + b;{'\n'}
                        {'    '}<span className="text-[#ff7b72]">return</span> <span className="text-[#79c0ff]">0</span>;{'\n'}
                        <span className="text-[#e6edf3]">{'}'}</span>
                      </code>
                    </pre>

                    {/* Result Bar */}
                    <div className="bg-[#161b22] border-t border-[#30363d] p-2.5 flex items-center justify-between text-xs font-mono">
                      <span className="inline-flex items-center gap-1.5 text-[#3fb950] font-semibold text-[11px]">
                        <MorphIcon icon={CheckCircle2Data} size={14} /> ACCEPTED (AC)
                      </span>
                      <div className="flex items-center gap-2.5 text-[10px] text-[#7d8590]">
                        <span>12 ms</span>
                        <span>·</span>
                        <span>1.2 MB</span>
                        <span>·</span>
                        <span>5/5 tests</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FEATURES GRID: GitHub style boxes */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  Tính năng cốt lõi
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Architecture & Sandbox</span>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className="bg-[var(--bg-secondary)] rounded-md border border-[var(--border)] p-4 space-y-2 hover:border-[var(--text-muted)] transition-colors">
                    <div className="w-7 h-7 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--accent-text)]">
                      <MorphIcon icon={f.icon} size={16} />
                    </div>
                    <h3 className="text-xs font-semibold text-[var(--text-primary)]">{f.title}</h3>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* CỘT PHẢI (3 cols): CUỘC THI & TIN TỨC */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            
            {/* Widget 1: Cuộc thi */}
            <div className="rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Kỳ Thi Sắp Diễn Ra
                </span>
                <Link
                  to="/contests"
                  className="text-[11px] text-[var(--accent-text)] hover:underline flex items-center gap-0.5"
                >
                  Tất cả <MorphIcon icon={ChevronRightData} size={12} />
                </Link>
              </div>

              {loading ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">Đang tải kỳ thi...</div>
              ) : featuredContests.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
                  Chưa có kỳ thi nào đang mở.
                </div>
              ) : (
                <div className="space-y-2">
                  {featuredContests.map((c) => {
                    const meta = CONTEST_STATUS_META[c.status];
                    return (
                      <Link
                        key={c.id}
                        to={`/contests/${c.id}`}
                        className="block p-2.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full border text-[10px] font-mono ${meta.className}`}>
                            <span className={`w-1 h-1 rounded-full ${meta.dot}`} /> {meta.label}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {c.rule_type}
                          </span>
                        </div>

                        <h3 className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[#0969DA] dark:group-hover:text-[#58A6FF] transition-colors truncate">
                          {c.title}
                        </h3>

                        <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1 mt-1">
                          <MorphIcon icon={CalendarData} size={12} className="text-[var(--text-muted)]" /> {formatTime(c.start_time)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Widget 2: Tin tức & Thông báo */}
            <div className="rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] p-3.5 space-y-3">
              <div className="pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Thông Báo Mới
                </span>
              </div>

              {loading ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">Đang tải thông báo...</div>
              ) : announcements.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
                  Chưa có thông báo nào.
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedNews(item)}
                      className="w-full text-left p-2.5 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border)] transition-colors space-y-1 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                          {item.tag || 'HỆ THỐNG'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {new Date(item.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h3 className="font-medium text-xs text-[var(--text-primary)] group-hover:text-[#0969DA] dark:group-hover:text-[#58A6FF] transition-colors truncate">
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                        {item.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* NEWS DETAIL MODAL (GitHub Dialog) */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedNews(null)}
        >
          <div role="dialog" aria-modal="true" aria-label={selectedNews.title} className="bg-[var(--bg-secondary)] rounded-md max-w-lg w-full p-4 border border-[var(--border)] shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                  {selectedNews.tag || 'HỆ THỐNG'}
                </span>
                <h3 className="font-semibold text-xs text-[var(--text-primary)] truncate">{selectedNews.title}</h3>
              </div>
              <button
                onClick={() => setSelectedNews(null)}
                className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Đóng"
              >
                <MorphIcon icon={XData} size={16} />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedNews.content}
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] font-mono">
              <span>Tác giả: {selectedNews.author || 'Admin'}</span>
              <span>{new Date(selectedNews.created_at).toLocaleDateString('vi-VN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
