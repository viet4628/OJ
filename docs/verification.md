# Kiểm chứng và mức sẵn sàng

Cập nhật 25/10/2026. Kết luận: các luồng chính đủ để pilot kín có giám sát; chưa nghiệm thu mở công khai hoặc ổn định chấm 24 giờ. Kết quả dưới đây ghi rõ kiểm thử local, fixture hay staging thật; không suy từ build sang khả năng chịu tải.

## Kết quả đã chạy trong phiên phát triển

| Kiểm tra | Bằng chứng và giới hạn |
|---|---|
| `npm run build` | Web TypeScript/Vite và worker TypeScript PASS. Vite còn cảnh báo chunk lớn; Monaco/Tiptap được tách lazy |
| `npm --prefix e2e test -- --reporter=list` | 63/63 PASS trên production preview sau gộp khung soạn đề; backend fixture, không thay Auth thật |
| Test ZIP/testcase sau thêm hướng dẫn | 7/7 PASS; nhập đúng, thiếu cặp, CRC hỏng, quá lớn, trùng basename, giữ whitespace/test ẩn và input rỗng; bố cục 1280/390px |
| `npm --prefix apps/judge-worker test` | 10 unit/lifecycle tests PASS: queue, claim, drain, error propagation, health/cleanup |
| `npm --prefix apps/judge-worker run smoke` | Local sandbox PASS; compiler Rust/Java có thể skip nếu không có trong `/usr/bin`. Docker smoke trước đó có Rust thật, Java không quảng bá |
| `npm run test:db` | PostgreSQL tạm: schema/seed/migrations rerun, security và contest ownership PASS |
| Rust workspace và `npm run test:pilot` | Đã PASS local/Rust pipeline trên DB/PostgREST tạm: AC, weighted WA, CE, TLE, hidden stderr, run/output cap, rank và drain. Một số utility tests upstream được ignore theo cấu hình gốc |
| `npm run test:ops` | Backup/restore hai PostgreSQL thật + Storage HTTP fixture và health CLI PASS; không chứng minh managed Supabase recovery |
| Engine patch | `patches/rsjudge-integration.patch` tái tạo được checkout upstream cố định; reverse apply check trên engine hiện tại PASS |

Thời điểm và số lượng của các đợt trước được gom tại đây thay vì dùng nhiều kế hoạch/nhật ký có kết luận mâu thuẫn. Khi chạy lại, ghi kết quả mới cùng phạm vi; không coi số test lịch sử là số đo mới.

## Staging thật đã kiểm tra

Các script sau tạo tài khoản/bài/lớp/contest riêng và dọn fixture; chỉ chạy trên staging được cấp quyền:

| Script | Phạm vi đã PASS |
|---|---|
| `apps/judge-worker/scripts/smoke-staging.mjs` | Auth, Storage/RLS, Realtime INSERT, chấm/run, reference AC/score 0 và browser ba role |
| `apps/judge-worker/scripts/platform-staging.mjs` | RPC/DB: registration/freeze/rejudge, editorial, lớp, moderation/audit/reference queue; yêu cầu dừng worker theo runbook |
| `e2e/staging-classrooms.mjs` | Browser tạo/mời/giao/join/reload lớp; nộp qua engine AC/100, deadline/outsider |
| `e2e/staging-contests.mjs` | Chọn/sắp bài, điểm OI, lưu/reload/bỏ bài |
| `e2e/staging-contest-ownership.mjs` | Hai giáo viên/admin: chủ contest, public/private, RETURNING, chống chuyển chủ, cascade, duyệt/rejudge/freeze/legacy |
| `e2e/staging-contest-workspace.mjs` | Bài private trong contest, sample/custom run, AC chính thức, rank/lịch sử đúng phạm vi; không gọi editorial |
| `e2e/staging-starter-codes.mjs` | Giáo viên lưu mẫu, học sinh đọc nhưng không sửa; testcase/editorial vẫn kín |
| `e2e/staging-rich-text.mjs` | Một toolbar/bốn phần, browser soạn/lưu/mở lại, khách đọc chữ đậm/phân số/ràng buộc; dữ liệu kín không lộ |

Owner đã áp dụng các migration bằng SQL Editor và báo thành công; REST/RPC staging đã xác nhận. Các đợt UI sau đó không đòi migration mới. Đây là bằng chứng đã chạy, không phải health snapshot liên tục của môi trường triển khai.

## Số đo tải và phục hồi lịch sử

- [Load A+B](reports/load-20261025.json): 10 tài khoản, 50 bài, 0 lỗi, khoảng 38,68 giây; p95 queue 6.356 ms, p95 hoàn tất 7.197 ms, throughput 1,29 bài/s. Đây là canary nhẹ, không xác định capacity cho đề lớn.
- [Health outage](reports/health-drill-20261025.jsonl) phát hiện engine dừng (503/exit 1); [health phục hồi](reports/health-recovered-20261025.jsonl) và [4 canary sau restart](reports/restart-canary-20261025.json) PASS.
- Lượt dự kiến theo dõi health 24 giờ đã **dừng**: [metadata](reports/health-soak24h-20261025.meta.json), [dữ liệu](reports/health-soak24h-20261025.jsonl) chỉ có 20 mẫu, từ 04:17:26 đến 04:22:11 ngày 25/10/2026 (giờ Việt Nam), khoảng 4 phút 45 giây. Không còn tiến trình đó khi rà soát tài liệu. Không có summary 24 giờ hợp lệ và không phải soak chấm bài.

## Cổng chưa nghiệm thu

- Email xác nhận/reset tới hộp thư thật, redirect/SMTP trên domain/TLS triển khai.
- Soak nộp/chấm ít nhất 24 giờ với bộ đề thực tế, log RAM/disk/queue và người dùng thử.
- Managed Supabase DB + Storage recovery/PITR trên project khác; CLI local từ chối DB đích đã có bảng.
- Accounting/cgroup toàn cây process theo từng job, máy/VM judge riêng và kiểm thử abuse trước khi mở cho người lạ. Namespace/rlimits/container limits không thay thế hoàn toàn cgroup/job.
- Kênh cảnh báo ngoài và một lượt GitHub CI chạy xanh; workflow tồn tại chưa chứng minh CI online đã chạy.
- Rà dependency theo phiên bản triển khai; audit trước ghi nhận advisory Router/Vite/build tree, chưa thực hiện nâng major trong phạm vi dọn tài liệu.
- SPJ, interactive, subtask, plagiarism và kiểm định toàn bộ ngân hàng đề hiện hữu chưa được cung cấp/nghiệm thu hoàn chỉnh.

Tiếp tục theo [plan](../plan.md), triển khai theo [runbook](pilot-runbook.md). Đã giữ bằng chứng đo lường; ảnh/video/kết quả Playwright có thể sinh lại và được dọn bằng `npm run clean`.

## Đợt cải thiện hiệu năng và độ đúng chấm ngày 12/11/2026

Đợt này chạy trên staging Supabase thật bằng `docker compose` (worker + rsjudge engine), cùng bộ tải 10 tài khoản/50 bài và bộ Storage 10 testcase/TLE. Ba việc đã đổi hành vi thật: (1) `WORKER_CONCURRENCY` cho phép chấm nhiều bài song song trong một daemon, claim nguyên tử giữ nguyên; (2) đọc testcase song song có ngân sách, kèm semaphore toàn cục 8 lượt tải Storage và một lần retry cho lỗi mạng tạm ở đường đọc; (3) sửa lỗi đo thời gian/bộ nhớ.

| Bằng chứng | Kết quả và phạm vi |
|---|---|
| [Baseline trước](reports/baseline-20261112-inline.json) | 10 người/50 bài inline 1 testcase: 0 lỗi, p50 queue 10,19s, p95 hoàn tất 23,67s, 0,71 bài/s. Chạy trên laptop 8 core, worker+engine trên cùng host, DB Supabase từ xa nên độ trễ mạng là điều kiện riêng của môi trường đo |
| [Sau khi tối ưu](reports/after-20261112-inline.json) | Cùng bộ tải: 0 lỗi, 0 lỗi health, p50 queue 2,35s, p95 hoàn tất 4,33s, 2,68 bài/s; đối chiếu execution 50/50 ID khớp, không trùng. Qua nhiều lượt p95 hoàn tất 4,3–10,1s, throughput 1,9–2,7 bài/s |
| [Bộ Storage nặng](reports/after-20261112-storage.json) | 5 người/20 bài, 10 testcase Storage 64KiB, C++/Python/Rust và TLE: 20/20 verdict đúng, 0 lỗi. `cases.loadMs` p95 2,56s (trước 6,43s) |
| [Timing worker](reports/after-20261112-inline-timings.json) | `totalMs` p50 693ms, p95 2,855s; `cases.loadMs` p50 0ms (testcase inline); RAM worker tối đa 5,23%, engine tối đa 6,25%, PID tối đa 14 |
| Verdict qua API thật | `verify-verdicts.mjs`: AC/WA/TLE/MLE/RTE đều đúng. Chương trình 500ms CPU + 100MB trước khi sửa ghi 1ms/40MB, sau khi sửa ghi 550ms/103MB |
| Kiểm thử mã | Worker 20/20 PASS (thêm test concurrency, retry đọc, trần tải Storage); Rust `cargo test -p rsjudge-judger` 17/17 PASS (thêm test đo CPU/RSS); `patches/rsjudge-integration.patch` áp sạch lên upstream `d33f85b` |

Lỗi gốc đã tìm và sửa: `wait4` chỉ trả usage của tiến trình trực tiếp (bwrap), còn chương trình của học sinh nằm trong PID namespace khác nên CPU thật và RSS đỉnh đều mất — mọi bài đều bị ghi ~1ms/2MB và verdict MLE không nhận diện được. Nay đo bằng GNU time bên trong sandbox. Lỗi SYSTEM_ERROR rời rạc trong lúc tải là timeout đọc Storage khi nhiều job tải song song; đã thêm semaphore và retry đọc.

Giới hạn còn lại: concurrency mặc định 2 và không được vượt `cpus` của engine (2), nếu không chương trình sát thời gian có thể bị TLE giả; campaign 5/10/20 người và soak 24h chưa chạy lại; số đo trên cùng một host nên chưa phải capacity công bố.

## Đợt cải thiện hiệu năng ngày 25/10/2026

Đã triển khai bản worker có timeout DB/Storage, thời gian từng công đoạn và đối chiếu verdict sau lỗi ghi; claim không retry, ghi lại tối đa một lần sau read-back xác nhận còn JUDGING và luôn có điều kiện trạng thái. Metadata đề/test được dùng lại trong một job, tải Storage tối đa hai testcase đồng thời, callback provider được giải phóng sau job. Không thêm dependency, nhiều worker hoặc cache xuyên job chưa có invalidation đáng tin cậy.

Migration `20261025_performance.sql` đã được chủ dự án áp qua SQL Editor và REST anon xác nhận RPC danh sách/rank. Web có route lazy, danh sách bài phân trang/lọc ở DB, metadata nhẹ cho Home/Learning, ranklist phân trang/sắp xếp tại DB và chờ verdict bằng Realtime + polling backoff có cleanup, thay giới hạn khoảng22s trước đây.

| Bằng chứng mới | Kết quả và phạm vi |
|---|---|
| [So sánh SQL cùng dữ liệu](reports/db-performance-comparison-20261025.json) | PostgreSQL15 local, 100 người/10 bài, 100k submissions: median rank contest216,99ms so với1233,60ms trước tối ưu, khoảng5,7 lần. Ba mẫu timing mỗi query; so kết quả ACM/OI có/không freeze khớp ở cả10k/100k. Không phải API latency qua Internet |
| [Bundle](reports/frontend-performance-20261025.json) | JS entry131.920 byte gzip so với292,64KB trước, giảm54,9%; editor vẫn tải riêng, chưa giảm kích thước editor |
| [Browser](reports/frontend-browser-performance-20261025.json) | Chromium/production preview, API fixture, CPU4x, mạng cố định, font ngoài bị chặn: LCP1460ms, max interaction event48ms trong lượt ngắn. Không phải field INP hay so LCP trước–sau; preview transport có thể khác hosting |
| [Tải ngắn bản cuối](reports/performance-final-20261025.json) | 5 người,15 bài,10 testcase Storage64KiB, C++/Python/Rust và TLE: 0 lỗi/health lỗi, cleanup đạt; p95 queue34,88s, hoàn tất40,57s,0,156 bài/s. Mẫu nhỏ/workload tổng hợp, chưa đạt capacity |
| [Timing worker cuối](reports/worker-timings-final-20261025.json) | Log lượt tải ngắn và smoke: median tải test2,68s, đóng gói25ms; snapshot worker cuối0 restart tại thời điểm thu. Không chứng minh24h |
| [Đối chiếu execution](reports/performance-execution-audit-20261025.json) | Canary1 bài xác nhận báo cáo ID và log engine khớp, không thiếu/trùng. Các lượt dài tiếp theo dùng cùng đối chiếu |
| Kiểm thử mã | Worker17/17; E2E đầy đủ67/67 và test browser performance1/1 riêng; build web/worker PASS. Sandbox9 thực thi PASS,2 compiler local skip; Rust được chạy qua pipeline và staging |
| Pipeline/quyền/vận hành | `npm run test:db`, `npm run test:ops`, `npm run test:pilot` PASS; `smoke-staging.mjs` PASS Auth/Storage/RLS, AC/weighted WA/CE/TLE/run/reference và Realtime thật. Fixture contest trong platform check được sửa để gán đúng owner, không nới quyền |

Hai lượt trước bản cuối ([trước](reports/performance-before-20261025.json), [trung gian](reports/performance-after-20261025.json)) đã có health/SYSTEM_ERROR và timeout ghi verdict dẫn đến restart; chỉ dùng làm bằng chứng lỗi. Lượt trước còn bị canary khác chồng ngắn ở cuối, đã ghi giới hạn trong JSON; không dùng hai lượt này để công bố tỷ lệ tăng tốc. Một lượt E2E trước gặp mất ký tự khi nhập Monaco rất nhanh dưới tải; không tái hiện trong9 lượt kiểm tra lại, lượt full sau đạt67/67. Chưa xác định nguyên nhân cho flake đó.

Chiến dịch nền: [status](reports/performance-campaign-20261025T162929Z.status.json), [lượt đầu đã hủy](reports/performance-campaign-launch-cancelled-20261025.json), [health 30 phút](reports/performance-campaign-20261025T162929Z-health.jsonl), [tóm tắt health](reports/performance-campaign-20261025T162929Z-health-summary.json), [kết quả tải 5 người vòng 1](reports/performance-campaign-20261025T162929Z-load-5-round-1.json), [progress](reports/performance-campaign-20261025T162929Z-load-5-round-1.json.progress.json), [kết quả từng bài](reports/performance-campaign-20261025T162929Z-load-5-round-1.json.results.jsonl). Health đạt đủ1800 giây với121 mẫu, 0 lỗi, queue/processing tối đa0. Vòng tải bắt đầu lúc16:59:53Z và runner dừng lúc17:20:30Z: 14 bài kết thúc (9 ACCEPTED, 1 SYSTEM_ERROR, 4 timeout), 5 lỗi tổng theo báo cáo, 237/247 mẫu health lỗi. Báo cáo ghi p95 queue21,526ms và p95 hoàn tất24,807ms; đây là lượt thất bại, không dùng làm benchmark capacity. Queue DB tối đa4 pending/1 judging. Bộ nhớ container cao nhất worker90,48MiB/1GiB (8,84%), engine154,5MiB/2GiB (7,54%); dung lượng đĩa thấp nhất52.067.147.776 byte. Không thấy ngưỡng RAM/disk vượt, nhưng health và SYSTEM_ERROR làm lượt tải không đạt. Đối chiếu execution không khả dụng (engine logs unavailable); cleanup fixture thất bại. Tại lần rà soát 30/10, PID runner187223 không còn tồn tại và Docker không còn container `online-judge-worker-1`, nên không thể truy hồi thêm log container từ môi trường hiện tại; nguyên nhân gốc chưa xác định. Status cuối là `failed`, stage `load-5-round-1`, exit1. Hai vòng tải còn lại và soak24h không chạy; chưa có nghiệm thu tải dài, restart/recovery hoặc capacity. Trước lần chạy lại cần chẩn đoán worker/engine, kiểm tra fixture còn lại qua runbook và thu thập log đầy đủ; không tăng timeout health hoặc tắt sandbox. Các cổng hạ tầng, per-job accounting và managed recovery phía trên vẫn còn.

## Rà soát tài liệu và dọn dự án

Đã hợp nhất nhật ký/kế hoạch trùng thành mục lục, hướng dẫn sử dụng, DB/migrations, kiến trúc, runbook, công cụ ops và biên bản này. Loại bỏ bản frontend tham khảo, engine dự phòng đã được thay thế, cache Rust cũ, ba script probe/smoke cũ được pipeline test thay thế, tài liệu lỗi thời và file báo cáo rỗng. Khối lượng thư mục/cache dọn khoảng 9 GB. Giữ nguồn engine, patch, binary hiện tại, migrations, test fixtures, báo cáo đo lường và cấu hình local.

Kiểm tra lại sau thay đổi:

- `npm run build`: PASS web/worker.
- `npm --prefix apps/judge-worker test`: 10/10 PASS.
- `npm run test:db`: PASS schema/seed/migrations rerun, security và contest ownership.
- `npm run test:ops`: PASS health CLI và backup/verify/restore local.
- `npm run test:e2e`: 63/63 PASS trên production preview.
- `npm run setup:engine`: xác nhận patch đã được áp dụng; binary engine vẫn chạy được `--help` sau dọn cache.
- Kiểm tra 12 tài liệu Markdown: mọi liên kết file local tồn tại; không còn tham chiếu vận hành tới tài liệu/script đã bỏ.
- `node scripts/health.mjs`: ready, một mẫu thành công, queue/processing bằng 0 khi kiểm tra. Không chạy lại load hoặc staging write chỉ để dọn tài liệu.

`npm run clean` được dùng sau kiểm tra để bỏ build/report vừa sinh; lệnh giữ dependency và cấu hình. `npm run test:e2e -- --list` chuyển tham số đúng tới Playwright. Không chạy lại Rust workspace sau khi xóa cache vì không sửa nguồn Rust; kết quả Rust/pipeline ở trên là kết quả lịch sử.

Vị trí liên kết quên mật khẩu: chuyển xuống dưới ô mật khẩu và căn phải. `npm --prefix e2e test -- --project=frontend --reporter=list` build production và PASS 12/12; test mới kiểm tra vị trí desktop/mobile, giữ email và gọi API recovery qua fixture (không chứng minh email delivery). Đã xem ảnh mobile 390px.
