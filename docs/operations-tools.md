# Công cụ nghiệm thu vận hành

Dùng Node22+ và Docker. Các script không in secret. `.env` có quyền đọc riêng; backup chứa dữ liệu Auth/testcase nên cần lưu trên ổ mã hóa và hạn chế quyền. Không thêm dependency.

## Backup và restore

```bash
node scripts/backup.mjs backup --env .env --directory /secure/codejudge-20261025
node scripts/backup.mjs verify --directory /secure/codejudge-20261025
node scripts/backup.mjs restore --env /secure/restore-target.env --directory /secure/codejudge-20261025
node scripts/test-backup.mjs
```

Backup cần `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. PostgreSQL client15 chạy qua Docker; URL connection chỉ truyền qua environment. Local PostgreSQL tạm dùng `--db-container <name>` thay DATABASE_URL.

Tạm dừng ghi từ web/worker và Storage trong suốt backup để DB snapshot và file cùng thời điểm. Công cụ ghi custom archive (`pg_dump -Fc`), tất cả bucket/object qua Storage API, SHA256 manifest, quyền thư mục0700/file0600. Thư mục có `INCOMPLETE` không được restore. Không ghi đè backup cũ.

Restore kiểm tra hash toàn bộ trước khi ghi, từ chối URL nguồn trùng đích, DB có bảng, Storage còn object hoặc bucket visibility khác backup. DB đích PostgreSQL15 phải trống và đã có các role nguồn (`anon`, `authenticated`, `service_role` cho fixture). Restore giữ ACL/RLS, chạy một transaction; nếu restore Storage lỗi, loại bỏ môi trường đích và chạy lại trên đích mới. Không trỏ ứng dụng vào đích trước khi kiểm tra Auth, RLS, hidden cases, số bài, file và canary chấm bài.

Supabase managed project mới đã có bảng Auth/Storage nên không đạt điều kiện DB trống của CLI này. Khôi phục managed Supabase phải theo quy trình recovery của nhà cung cấp, diễn tập trên project khác; chưa được xác nhận trong phiên này. User chọn tiếp tục chạy SQL thủ công, backup/restore cục bộ trước.

Test tự động dựng hai PostgreSQL riêng, dump/restore schema + seed thật, kiểm tra dữ liệu và RLS sau restore; Storage dùng HTTP fixture ngoài ứng dụng. Đây chưa phải bằng chứng restore blob lên Supabase project thứ hai.

## Health và soak

```bash
node scripts/health.mjs
node scripts/health.mjs --duration 86400 --interval 15 --output /secure/health-24h.jsonl
node scripts/test-health.mjs
```

CLI trả JSON, exit0 nếu mọi mẫu ready và poll mới trong30s; exit1 khi endpoint lỗi/stale/503. `--duration`, `--interval` tính bằng giây. Dùng exit code với hệ thống giám sát sẵn có để cảnh báo. Chưa cấu hình kênh gửi cảnh báo bên ngoài. Theo dõi health không thay canary, và queue tăng liên tục cần đối chiếu bài thực tế.

## Tải và canary trên staging

```bash
node apps/judge-worker/scripts/test-load.mjs
node apps/judge-worker/scripts/load-staging.mjs --users 10 --jobs 50 --output /secure/load-smoke.json
node apps/judge-worker/scripts/load-staging.mjs --users 5 --duration 86400 --output /secure/load-24h.json
node apps/judge-worker/scripts/load-staging.mjs --users 5 --duration 600 --languages cpp,python,rust --cases 10 --storage --input-bytes 65536 --tle-every 10 --output /secure/load-storage.json
node apps/judge-worker/scripts/worker-timings.mjs --since 30m --output /secure/worker-timings.json
node apps/judge-worker/scripts/verify-verdicts.mjs
node scripts/benchmark-db.mjs --output /secure/db-performance.json
```

`worker-timings.mjs` đọc log container của worker và gom p50/p95/max cho `[Timing]` (claim/load/judge/save/total), `[CasesTiming]` (load/archive) và `[EngineTiming]` (compile/run). Dùng để đối chiếu trước–sau khi đổi engine hoặc worker.

`verify-verdicts.mjs` tạo bài fixture riêng rồi nộp 5 chương trình (AC/WA/TLE/MLE/RTE) và in verdict thực tế kèm thời gian/bộ nhớ đo được; tự dọn fixture. Exit 1 nếu verdict sai. Chạy sau mỗi thay đổi cách chấm hoặc giới hạn tài nguyên.

Root`.env` và web`.env.local` phải cùng staging riêng. Script tạo tài khoản xác nhận email riêng và bài A+B công khai tạm thời, đăng nhập thật, nộp/chờ verdict qua REST, dọn tài khoản/bài cuối test. Quota tối đa9 submission/phút/tài khoản, mỗi tài khoản chỉ có1 bài đang chờ. Chỉ dùng worker đang chạy, không tạo daemon thứ hai. SIGTERM/SIGINT ngừng tạo bài mới, đợi bài hiện tại và cleanup; không kill -9 trừ sự cố.

Báo cáo gồm tổng bài/lỗi, throughput, p95 queue/hoàn tất, health samples, Docker memory/CPU/PID trước–sau. p95 queue dựa trên timestamp DB; thời gian hoàn tất gồm network/poll. Bài A+B rất nhẹ: số đo này chỉ là baseline canary, không phải capacity cho đề biên dịch lớn/bộ test dài. Lượt ngắn không chứng minh ổn định24h. Soak cần thời gian thực, kiểm tra disk/log và người thử thực tế; chưa tự đánh dấu hoàn tất.

Load CLI hiện lấy mẫu Docker CPU/RAM/PID/BlockIO/NetIO, dung lượng trống ổ dự án và số PENDING/JUDGING trong DB xuyên suốt lượt chạy. Throughput chỉ tính khoảng nộp/chờ verdict, loại thời gian tạo/dọn fixture. Báo cáo có p50/p95/p99 và nhóm ngôn ngữ/verdict kỳ vọng; với mẫu nhỏ percentile chưa ổn định. Đây là closed-loop: mỗi tài khoản chỉ có một bài đang chờ, không mô phỏng arrival rate độc lập. Không chạy hai load script cùng lúc khi so trước–sau.

Các cờ: `--languages cpp,python,rust`, `--cases 1..100`, `--storage`, `--input-bytes 5..1048576` (padding whitespace cho A+B), `--tle-every N` để mỗi bài thứ N kỳ vọng TLE, `--job-timeout` tính bằng giây (mặc định1200). Đây vẫn là dữ liệu tổng hợp, cần thêm ngân hàng đề thực tế khi xác nhận capacity.

Script ngừng tạo bài khi health lỗi, worker đổi `startedAt`, có SYSTEM_ERROR, RAM container >80%, ổ còn <2GiB hoặc queue tăng kéo dài120s. Các bài đã gửi tiếp tục được chờ; không xóa fixture/tài khoản nếu DB còn PENDING/JUDGING. Nếu `cleanupFailed=true`, dùng fixture ID trong báo cáo để xử lý sau khi xác nhận không còn job đang chạy. File `<output>.progress.json` cập nhật khi lấy mẫu, `<output>.results.jsonl` ghi từng kết quả; `<output>` là báo cáo cuối. Giữ file của mỗi lượt riêng để không trộn kết quả. Không dùng health pass đơn lẻ thay bằng chứng 24 giờ.

Mỗi kết quả mới có `submissionId`; khi dùng engine, báo cáo đối chiếu các ID này với `[EngineTiming]` trong log worker để phát hiện lượt thực thi thiếu/trùng. Không lấy được log, ID không duy nhất hoặc đối chiếu không khớp thì lượt test không đạt. Đối chiếu này bổ sung cho test atomic claim; không thay thế audit toàn bộ sandbox.

`bash scripts/run-performance-campaign.sh` chạy tuần tự health30 phút, hai vòng5/10/20 người (10 phút/mức), rồi soak24h/5 người với workload Storage ở trên. Script dùng `flock` để ngăn hai campaign, cập nhật `performance-campaign-<UTC>.status.json` khi đổi stage và dừng ngay khi một stage lỗi. SIGTERM tới PID trong status được chuyển tới load script để ngừng nhận bài và cleanup. Không chạy load/smoke riêng trong các stage tải. Có thể chạy qua phiên terminal bền vững; nếu tách nền phải giữ log và xác nhận PID còn sống. Soak vẫn cần máy chạy đủ thời gian; status running không phải kết quả đạt.

`benchmark-db.mjs` chỉ dùng PostgreSQL15 tạm, 100 tài khoản/10 bài và 10k/100k submissions tổng hợp; không đọc `.env`. Nó so kết quả ACM/OI/freeze với định nghĩa rank trước tối ưu trong schema rồi lưu execution plan. Số đo SQL local không phải độ trễ API qua mạng. Chỉ cân nhắc thêm index sau khi execution plan chứng minh cần.

## Trình tự staging platform

1. Dừng worker và xác nhận không còn bài JUDGING; SQL Editor chạy migration. Không seed.
2. `node apps/judge-worker/scripts/platform-staging.mjs` (fixture kiểm tra DB/Auth, không có worker nhận các job tạm).
3. Recreate engine rồi worker cùng build, giữ một daemon/DB. `node scripts/health.mjs`.
4. `STAGING_WEB_URL=http://127.0.0.1:3000 node apps/judge-worker/scripts/smoke-staging.mjs` và `node e2e/staging-classrooms.mjs`.
5. Chạy tải/soak và lưu báo cáo trước khi tăng nhóm pilot.

Giới hạn hiện tại: cgroup chỉ giới hạn toàn container, chưa có accounting toàn cây process theo từng job. UID thường không tạo được namespace bwrap trên host hiện tại. Giữ fail-closed, không tắt isolation. Chỉ pilot kín có giám sát; máy judge riêng và per-job cgroup còn là cổng trước mở cho người lạ.

## Concurrency chấm bài

Worker nhận `WORKER_CONCURRENCY` (mặc định 2, cho phép 1..8): số bài chấm song song trong một daemon. Claim nguyên tử vẫn giữ nên không chạy trùng; heartbeat và `/health` báo `queued`/`processing` thật.

**Không được đặt concurrency vượt số CPU của engine** (`docker-compose.yml`: engine `cpus: 2`). Runner giết chương trình theo wall-time, nên khi nhiều job tranh CPU trên cùng số core, một chương trình sát thời gian có thể bị kết luận TLE giả. Tăng concurrency thì tăng `cpus` của engine tương ứng, và kiểm lại bằng `verify-verdicts.mjs`.

Thời gian và bộ nhớ của bài nộp được đo bằng GNU time chạy **bên ngoài** sandbox (từ 13/11): chương trình là PID 1 (`bwrap --as-pid-1`) nên usage đi lên qua `wait4`, báo cáo nằm ngoài thư mục bài nên chương trình không làm giả được. `time_used_ms`/`memory_used_mb` phản ánh đúng chương trình của học sinh; TLE theo CPU, wall-time có biên 1,5s.


Lượt health dự kiến 24 giờ trước đã dừng sau khoảng 5 phút; xem [verification](verification.md). Giữ dữ liệu báo cáo để đối chiếu; chạy lại health/soak khi nghiệm thu.


## Dung lượng build/cache Rust

Cache giúp giảm thời gian build lại; vài GiB sau nhiều lần build/test là bình thường. Dự án dùng `engine/rsjudge/build` cho trung gian và `engine/rsjudge/target` cho output cuối theo cấu hình Cargo. [Cargo Build Cache](https://doc.rust-lang.org/cargo/reference/build-cache.html) mô tả cách phân chia này.

Chính sách hiện tại: Chủ nhật 03:00 giờ Việt Nam kiểm tra dung lượng hai thư mục và dung lượng trống của ổ chứa dự án. Chỉ thông báo khi tổng dung lượng đạt 10 GiB hoặc ổ còn dưới 15 GiB; đây là ngưỡng cảnh báo ban đầu, không phải giới hạn Cargo. Lịch kiểm tra dùng Codex heartbeat, không phải cron/systemd độc lập của server. Không tự xóa cache hoặc binary.

Dọn khi có áp lực dung lượng, cache của build cũ không còn cần, hoặc cần làm sạch để chẩn đoán lỗi build. Thực hiện lúc không có Cargo/rustc; kiểm tra binary đang dùng trước. `cargo clean` mặc định xóa toàn bộ target, nên không dùng mù quáng trên thư mục chứa binary cần chạy. Xóa cache sẽ khiến lần build sau phải biên dịch lại. Không bổ sung một lượt dọn chỉ vì đã đến lịch.
