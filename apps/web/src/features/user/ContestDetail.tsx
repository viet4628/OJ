import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronRight, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import {
  getContest, getContestProblems, getContestRank, getMyContestSubmissions,
  getContestStatusFromTime,
  getMyContestRegistration, registerContest,
  type Contest, type ContestProblemRow, type ContestRankRow,
} from '../../lib/api';
import Markdown from '../../components/Markdown';

type Tab = 'overview' | 'problems' | 'rank';

function fmtSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(startIso: string, endIso: string): string {
  const diff = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0 && minutes > 0) return `${hours} giờ ${minutes} phút`;
  if (hours > 0) return `${hours} giờ`;
  return `${minutes} phút`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ContestDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [contest, setContest] = useState<Contest | null>(null);
  const [problems, setProblems] = useState<ContestProblemRow[]>([]);
  const [rank, setRank] = useState<ContestRankRow[]>([]);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'rank' ? 'rank' : 'overview');
  const [now, setNow] = useState(() => Date.now());
  const [registration, setRegistration] = useState<string | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const updateRegistration = async (register: boolean) => {
    if (!id) return;
    setEntryBusy(true);
    setEntryError(null);
    try { setRegistration(register ? await registerContest(id) : await getMyContestRegistration(id)); }
    catch (err: any) { setEntryError(err.message || 'Không cập nhật được đăng ký'); }
    finally { setEntryBusy(false); }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      const c = await getContest(id);
      if (!c) {
        setError('Không tìm thấy kỳ thi');
        setLoading(false);
        return;
      }
      setContest(c);
      if (c.registration_required) {
        try { setRegistration(await getMyContestRegistration(id)); }
        catch { setEntryError('Không tải được trạng thái đăng ký. Vui lòng kiểm tra lại.'); }
      }
      const [probs, rnk, subs] = await Promise.all([
        getContestProblems(id),
        getContestRank(id),
        getMyContestSubmissions(id),
      ]);
      setProblems(probs);
      setRank(rnk);
      setMySubs(subs);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = contest ? getContestStatusFromTime(contest.start_time, contest.end_time) : null;

  const countdown = useMemo(() => {
    if (!contest) return null;
    const targetMs =
      status === 'NOT_STARTED'
        ? new Date(contest.start_time).getTime()
        : new Date(contest.end_time).getTime();
    const diff = Math.max(0, Math.floor((targetMs - now) / 1000));
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return d > 0 ? `${d} ngày ${h} giờ` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [contest, now, status]);

  const myResults = useMemo(() => {
    const map: Record<string, 'AC' | 'WA' | 'PENDING'> = {};
    for (const s of mySubs) {
      if (s.status === 'ACCEPTED') map[s.problem_id] = 'AC';
      else if (['PENDING', 'JUDGING'].includes(s.status)) map[s.problem_id] = 'PENDING';
      else if (!map[s.problem_id]) map[s.problem_id] = 'WA';
    }
    return map;
  }, [mySubs]);

  const sortedRank = useMemo(() => {
    if (contest?.rule_type === 'ACM') {
      return [...rank].sort((a, b) =>
        b.accepted_number - a.accepted_number || a.total_time_seconds - b.total_time_seconds
        || Math.max(0, ...Object.values(a.problem_info).filter(info => info.is_ac).map(info => info.time_seconds || 0))
          - Math.max(0, ...Object.values(b.problem_info).filter(info => info.is_ac).map(info => info.time_seconds || 0))
        || a.user_id.localeCompare(b.user_id)
      );
    }
    return [...rank].sort((a, b) => b.total_score - a.total_score || a.user_id.localeCompare(b.user_id));
  }, [rank, contest?.rule_type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-xs text-[var(--text-secondary)] font-bold">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tải kỳ thi...
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="py-24 text-center text-xs text-[var(--text-secondary)] space-y-2">
        <p>{error || 'Không tìm thấy kỳ thi'}</p>
        <Link to="/contests" className="text-[var(--accent-text)] font-bold block">← Về danh sách kỳ thi</Link>
      </div>
    );
  }

  const STATUS_MAP: Record<Contest['status'], { label: string; cls: string; dot: string }> = {
    UNDERWAY: {
      label: 'Đang diễn ra',
      cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-500 animate-pulse',
    },
    NOT_STARTED: {
      label: 'Chưa bắt đầu',
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dot: 'bg-amber-500',
    },
    ENDED: {
      label: 'Đã kết thúc',
      cls: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]',
      dot: 'bg-[var(--text-muted)]',
    },
  };
  const STATUS_META = STATUS_MAP[status as Contest['status']];

  const tbBtn = (t: Tab, text: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
        tab === t
          ? 'bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-transparent'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-5">
      {contest.freeze_at && now >= new Date(contest.freeze_at).getTime() && status === 'UNDERWAY' && <p className="text-xs border border-[var(--border)] p-3 rounded">Bảng xếp hạng công khai đang đóng băng. Kết quả mới sẽ được công bố khi kỳ thi kết thúc; người quản lý vẫn xem được bảng đầy đủ.</p>}
      {contest.registration_required && <section className="border border-[var(--border)] rounded-lg p-4 space-y-2 text-xs">
        <p>{registration === 'APPROVED' ? 'Bạn đã được duyệt tham gia kỳ thi.' : registration === 'PENDING' ? 'Đăng ký đang chờ giáo viên duyệt.' : registration === 'REJECTED' ? 'Đăng ký đã bị từ chối. Vui lòng liên hệ giáo viên.' : 'Kỳ thi yêu cầu đăng ký và được giáo viên duyệt trước khi nộp bài.'}</p>
        {entryError && <p role="alert">{entryError}</p>}
        <div className="flex gap-2">
          <button onClick={() => updateRegistration(true)} disabled={entryBusy || !!registration || status === 'ENDED'} className="border border-[var(--border)] rounded px-3 py-1.5 disabled:opacity-50">Đăng ký dự thi</button>
          <button onClick={() => updateRegistration(false)} disabled={entryBusy} className="border border-[var(--border)] rounded px-3 py-1.5 disabled:opacity-50">Kiểm tra trạng thái</button>
        </div>
      </section>}
      {/* HEADER */}
      <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-4">
        {/* Navigation & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/contests"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors font-medium"
          >
            ← Quay lại danh sách kỳ thi
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${STATUS_META.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META.dot}`} /> {STATUS_META.label}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 font-bold text-[11px]">
              Thể thức {contest.rule_type}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] text-[11px] font-medium">
              {contest.is_public ? (
                <>
                   Công khai
                </>
              ) : (
                <>
                   Nội bộ
                </>
              )}
            </span>
          </div>
        </div>

        {/* Title & Action Box */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-1">
          <div className="space-y-3 flex-1 min-w-0">
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {contest.title}
            </h1>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">

                <span>Bắt đầu: <strong className="text-[var(--text-primary)] font-semibold">{fmtDate(contest.start_time)}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">

                <span>Kết thúc: <strong className="text-[var(--text-primary)] font-semibold">{fmtDate(contest.end_time)}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">

                <span>Thời lượng: <strong className="text-[var(--text-primary)] font-semibold">{fmtDuration(contest.start_time, contest.end_time)}</strong></span>
              </span>
              <span className="inline-flex items-center gap-1.5">

                <span><strong className="text-[var(--text-primary)] font-semibold">{problems.length}</strong> bài tập</span>
              </span>
              <span className="inline-flex items-center gap-1.5">

                <span><strong className="text-[var(--text-primary)] font-semibold">{rank.length}</strong> thí sinh</span>
              </span>
            </div>
          </div>

          {/* Countdown & Action Card */}
          <div className="shrink-0 md:w-64 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col justify-between space-y-3">
            <div>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">

                {status === 'NOT_STARTED' ? 'Bắt đầu sau' : status === 'UNDERWAY' ? 'Thời gian còn lại' : 'Kỳ thi kết thúc lúc'}
              </div>
              <div className="font-code font-black text-xl text-[var(--text-primary)] tabular-nums mt-1">
                {status === 'ENDED' ? fmtDate(contest.end_time) : countdown}
              </div>
            </div>

            {status === 'UNDERWAY' ? (
              <button
                onClick={() => setTab('problems')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Vào làm bài ngay <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : status === 'NOT_STARTED' ? (
              <button
                onClick={() => setTab('problems')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-semibold transition-all cursor-pointer"
              >
                Xem danh sách bài ({problems.length})
              </button>
            ) : (
              <button
                onClick={() => setTab('rank')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-semibold transition-all cursor-pointer"
              >
                Xem bảng xếp hạng
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-1.5 shadow-sm w-fit">
        {tbBtn('overview', 'Tổng Quan & Thể Lệ')}
        {tbBtn('problems', `Bài Tập (${problems.length})`)}
        {tbBtn('rank', `Bảng Xếp Hạng (${rank.length})`)}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Quick Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] space-y-1 shadow-xs">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Thể thức thi đấu</span>
              <div className="font-bold text-sm text-[var(--text-primary)]">
                {contest.rule_type === 'ACM' ? 'ACM / ICPC' : 'OI tính điểm'}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {contest.rule_type === 'ACM'
                  ? 'AC nhiều nhất, sai trừ thời gian phạt (penalty 20 phút).'
                  : 'Chấm theo trọng số testcase, tích lũy điểm cao nhất từng bài.'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] space-y-1 shadow-xs">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Thời lượng làm bài</span>
              <div className="font-bold text-sm text-[var(--text-primary)]">
                {fmtDuration(contest.start_time, contest.end_time)}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Từ {new Date(contest.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} đến {new Date(contest.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] space-y-1 shadow-xs">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Quy mô đề thi</span>
              <div className="font-bold text-sm text-[var(--text-primary)]">
                {problems.length} Bài toán thuật toán
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Xem chi tiết danh sách và làm bài ở tab &ldquo;Bài Tập&rdquo;.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] space-y-1 shadow-xs">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Môi trường & Ngôn ngữ</span>
              <div className="font-bold text-sm text-[var(--text-primary)]">
                C++, Python, Rust
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Thực thi an toàn qua sandbox tự động với giới hạn RAM/CPU.
              </p>
            </div>
          </div>

          {/* Main Description Card */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">

                <h2 className="text-sm font-bold text-[var(--text-primary)]">Mô Tả & Thông Tin Kỳ Thi</h2>
              </div>
              {contest.rule_type && (
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Quy chuẩn {contest.rule_type}
                </span>
              )}
            </div>

            {contest.description && contest.description.trim().length > 0 ? (
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--border)] text-sm leading-relaxed text-[var(--text-primary)]">
                <Markdown content={contest.description} />
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[var(--bg-secondary)]/30 border border-[var(--border)] text-center text-xs text-[var(--text-muted)] italic">
                Ban tổ chức chưa cung cấp thêm phần mô tả chi tiết cho kỳ thi này. Bạn có thể xem ngay danh sách các bài tập ở tab &ldquo;Bài Tập&rdquo;.
              </div>
            )}
          </div>

          {/* Rules & Guidelines */}
          <div className="bg-[var(--bg-primary)] rounded-2xl border border-[var(--border)] shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[var(--border)]">

              <h2 className="text-sm font-bold text-[var(--text-primary)]">Quy Định Chung & Tính Điểm</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[var(--text-secondary)]">
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">

                  Quy tắc tính điểm ({contest.rule_type})
                </h3>
                {contest.rule_type === 'ACM' ? (
                  <p className="leading-relaxed">
                    Xếp hạng ưu tiên theo số lượng bài giải được (<strong className="text-[var(--text-primary)]">AC</strong>). Nếu bằng số bài AC, thí sinh có tổng thời gian phạt (<strong className="text-[var(--text-primary)]">Penalty</strong>) nhỏ hơn sẽ xếp trên. Mỗi lần nộp sai trước khi AC bị cộng 20 phút phạt.
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    Mỗi bài tập được chia thành các testcase với điểm số tương ứng. Điểm số của bạn là <strong className="text-[var(--text-primary)]">điểm cao nhất</strong> đạt được trong các lần nộp. Thứ hạng được xếp theo tổng điểm bài làm.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-2">
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">

                  Quy chế làm bài & Trung thực
                </h3>
                <p className="leading-relaxed">
                  Tất cả bài nộp được kiểm tra tự động qua sandbox cách ly bảo mật. Nghiêm cấm chia sẻ mã nguồn, sao chép code hoặc sử dụng nhiều tài khoản trong suốt thời gian diễn ra kỳ thi. Vi phạm sẽ bị hủy kết quả.
                </p>
              </div>
            </div>

            {/* Bottom Call to Action */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">
                Bạn đã nắm rõ thể lệ? Bắt đầu khám phá đề bài và thử sức ngay.
              </span>
              <button
                onClick={() => setTab('problems')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
              >
                Xem danh sách bài tập ({problems.length}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROBLEMS */}
      {tab === 'problems' && (
        <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
               Bài Tập Trong Kỳ Thi
            </h2>
            {status === 'NOT_STARTED' && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                 Đề mở khi bắt đầu (vẫn xem được thông tin)
              </span>
            )}
          </div>
          {problems.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-secondary)] py-12">Kỳ thi chưa có bài tập nào</p>
          ) : (
            <ol className="divide-y divide-[var(--border)]">
              {problems.map((row, idx) => {
                const st = myResults[row.problem_id];
                return (
                  <li key={row.problem_id}>
                    <Link
                      to={`/contests/${contest.id}/problems/${row.problem_id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-secondary)]/60 transition-colors group"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-text)] border border-[var(--accent)]/20 font-black text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                          {row.problems.title}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-code mt-0.5">
                          {row.problems.time_limit_ms}ms / {row.problems.memory_limit_mb}MB · {row.problems.difficulty}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {st === 'AC' && <span className="flex items-center gap-1 text-[var(--accent-text)] font-black text-[11px]"><CheckCircle2 className="w-4 h-4" /> AC</span>}
                        {st === 'PENDING' && <span className="flex items-center gap-1 text-blue-600 font-bold text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> ĐANG CHẤM</span>}
                        {st === 'WA' && <span className="flex items-center gap-1 text-red-500 font-bold text-[11px]"><XCircle className="w-4 h-4" /> SAI / CHƯA AC</span>}
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-text)] transition-colors" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* RANK */}
      {tab === 'rank' && (
        <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
               Bảng Xếp Hạng {contest.rule_type}
            </h2>
            {contest.rule_type === 'ACM' ? (
              <span className="text-[11px] text-[var(--text-secondary)] font-semibold">AC xếp trước, penalty nhỏ hơn xếp trên</span>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)] font-semibold">Tổng điểm tốt nhất từng bài</span>
            )}
          </div>

          {sortedRank.length === 0 ? (
            <p className="text-center text-xs text-[var(--text-secondary)] py-12">Chưa có thí sinh nào nộp bài</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-code">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)] font-bold text-[11px] uppercase">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Người Dùng</th>
                    <th className="px-4 py-3 text-center">{contest.rule_type === 'ACM' ? 'AC / Tổng' : 'Điểm'}</th>
                    {contest.rule_type === 'ACM' && <th className="px-4 py-3">Tổng Thời Gian</th>}
                    {problems.map((row, idx) => (
                      <th key={row.problem_id} className="px-2 py-3 text-center">
                        <Link to={`/contests/${contest.id}/problems/${row.problem_id}`} className="hover:text-[var(--accent-text)] transition-colors" title={row.problems.title}>
                          {idx + 1}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedRank.map((row, i) => (
                    <tr key={row.user_id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                      <td className="px-4 py-3 font-black">{i + 1}</td>
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{row.username || row.email?.split('@')[0] || 'user'}</td>
                      <td className="px-4 py-3 text-center font-black text-[var(--accent-text)]">
                        {contest.rule_type === 'ACM' ? `${row.accepted_number} / ${row.submission_number}` : row.total_score}
                      </td>
                      {contest.rule_type === 'ACM' && (
                        <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{fmtSeconds(row.total_time_seconds)}</td>
                      )}
                      {problems.map((pp) => {
                        const info = row.problem_info?.[pp.problem_id];
                        if (contest.rule_type === 'ACM') {
                          if (!info || !info.submission_count) return <td key={pp.problem_id} className="px-2 py-3 text-center text-[var(--text-muted)]">—</td>;
                          return (
                            <td key={pp.problem_id} className="px-2 py-3 text-center">
                              {info.is_ac ? (
                                <span className="inline-flex flex-col items-center gap-0.5">
                                  <span className="text-[var(--accent-text)] font-black">{fmtSeconds(info.time_seconds || 0)}</span>
                                  {info.error_count ? <span className="text-red-500 text-[10px] font-bold">-{info.error_count}</span> : null}
                                </span>
                              ) : (
                                <span className="text-red-400 font-bold">{info.submission_count}</span>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={pp.problem_id} className="px-2 py-3 text-center">
                            {info && info.submission_count ? (
                              <span className={`font-black ${(info.score || 0) > 0 ? 'text-[var(--accent-text)]' : 'text-red-400'}`}>
                                {info.score || 0}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
