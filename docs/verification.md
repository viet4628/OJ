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
