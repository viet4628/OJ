# Vận hành pilot CodeJudge VN

## Chuẩn bị

- Dùng staging riêng, nhóm thử nghiệm được mời. Một worker/DB.
- Cấu hình root `.env` theo `.env.example`; frontend dùng `apps/web/.env.local`. Service-role key chỉ tồn tại phía worker, không có biến `VITE_*` nào chứa khóa đó.
- Supabase: schema, private `testcases` bucket, Realtime publication. Auth: cấu hình Site URL/redirect `/reset-password`, SMTP/xác nhận email đúng domain.
- Sao lưu DB và Storage trước migration; lưu image cũ để rollback ứng dụng. Schema mới chặn các client cũ đọc profile người khác, nên deploy web tương ứng ngay sau migration.

## Từ checkout mới

```bash
npm run setup:engine
npm --prefix apps/web ci
npm --prefix apps/judge-worker ci
npm --prefix e2e ci
npm run build
```

Engine cần Rust stable edition 2024, `protoc`, `buf`, `libseccomp-dev`; sandbox cần Linux + bubblewrap và kernel cho user namespaces. `setup:engine` dùng upstream revision cố định và patch trong repo, không ghi đè checkout khác phiên bản. Engine là thành phần chạy thật; giữ `patches/rsjudge-integration.patch` để tái lập build.

## Kiểm thử cục bộ

```bash
npm --prefix apps/judge-worker test
npm --prefix apps/judge-worker run smoke
npm run test:db
(cd engine/rsjudge && cargo test --workspace --locked && cargo build --locked --bin rsjudge)
npm run test:pilot
npx --prefix e2e playwright install chromium
npm run test:e2e
```

DB tests dùng container PostgreSQL15 tạm, không publish DB; integration thêm PostgREST12.2.3 và port loopback tạm. Không dùng `.env` thật cho worker của integration. Playwright dùng backend fixture riêng và không chứng minh Auth/DB integration. Bộ local có thể skip Rust nếu thiếu `/usr/bin/rustc`; image phải kiểm tra Rust thật trước pilot.

## Nâng cấp staging

1. Backup. Dừng nhận bài trong thời gian nâng cấp; đợi queue trống.
2. SQL Editor → chạy toàn bộ `supabase/schema.sql`. Script có transaction và an toàn rerun. **Không rerun seed**: seed xóa/tạo lại testcase, contest mẫu.
3. `docker compose build` rồi `docker compose up -d --force-recreate`. Kiểm tra không còn worker nào ngoài compose cùng DB. Không chạy thêm `npm run dev:worker`.
4. Deploy `apps/web/dist` trên cùng domain; SPA fallback về `index.html` cho `/admin`, `/teacher`, `/reset-password` và route bài tập.
5. Xem health/heartbeat và chạy staging smoke.

```bash
docker compose ps
curl --fail http://127.0.0.1:9090/health
node apps/judge-worker/scripts/smoke-staging.mjs
```

Provider50052, engine50051 và REST8080 chỉ dùng mạng Docker, không publish Internet. Health9090 bind host loopback. Không expose Docker socket hay thư mục dự án/secrets vào sandbox. `SYS_ADMIN`, `seccomp=unconfined`, `apparmor=unconfined` và `systempaths=unconfined` chỉ áp dụng container judge để bwrap tạo/mount namespace (đã thử trên host hiện tại); submission bị drop toàn bộ capabilities. Chạy judge trên máy/VM riêng; không áp dụng cho dịch vụ web/DB. Bảo vệ máy judge bằng giới hạn container và máy/VM riêng trước khi cho người lạ submit.

## Theo dõi

Admin overview đọc `judge_servers`; stale30s hoặc ready=false là không sẵn sàng. `/health` trả503 khi DB poll quá hạn, engine channel chưa ready hoặc worker đang drain. Health không tự đo độ đúng của compiler/testcase; vẫn cần canary A+B.

Theo dõi: queue PENDING, JUDGING quá11 phút, tỷ lệ SYSTEM_ERROR, thời gian hoàn tất, RAM/disk, số process và heartbeat. Dùng `docker stats --no-stream`, `docker compose logs --tail=100 worker engine`; không dán log chứa dữ liệu người dùng/khóa vào kênh công khai.

Worker có timeout DB `WORKER_REQUEST_TIMEOUT_MS` (mặc định8000, tối đa30000ms), Storage30s/request. Không tăng ngưỡng health để che poll chậm. Health bổ sung `startedAt`, `lastPollDurationMs`, `lastPollError`; `startedAt` đổi nghĩa là worker đã khởi động lại. Log `[Timing]`, `[EngineTiming]`, `[CasesTiming]` chỉ ghi ID/thời gian/kích thước, giúp phân biệt claim/đọc/chấm/lưu, compile RPC và tải/đóng gói testcase.

Lưu verdict chỉ cập nhật khi trạng thái còn JUDGING. Nếu ghi lỗi mạng/timeout, worker đọc lại: kết quả khớp thì xác nhận hoàn tất; còn JUDGING thì thử ghi có điều kiện thêm một lần. Không ghi đè bài đã rejudge hoặc verdict khác. Không xác minh được thì lỗi tiếp tục truyền lên daemon để dừng tiêu thụ. Claim không retry tự động. Cơ chế này giảm lỗi do mất response, không thay thế kết nối DB ổn định hoặc bảo đảm không mất kết quả qua mọi sự cố.

SIGTERM đợi bài đang chấm; grace11 phút, gRPC deadline10 phút. Chấm local có budget10 phút giữa các testcase. Bài bị crash không được tự chấm lặp trong lúc worker khác còn hoạt động. Claim cũ quá11 phút sẽ được chuyển SYSTEM_ERROR khi worker khởi động và khi kiểm tra heartbeat định kỳ; operator kiểm tra bài treo mới hơn và xử lý sau khi chắc chắn daemon cũ đã dừng. Người dùng có thể nộp lại.

## Sự cố và rollback

- Health503: kiểm tra DB REST, service key, engine và namespace kernel; không tắt sandbox để khôi phục chấm.
- Engine chết: bài hiện tại thành SYSTEM_ERROR/deadline; restart engine, xác nhận health, canary rồi cho nộp lại.
- DB mất kết nối: tạm dừng thử nghiệm; kiểm tra bài JUDGING không có kết quả trước restart. Không reset hàng loạt khi worker còn chạy.
- Rollback web/worker về image/build đã ghi lại, vẫn giữ guard DB mới. Không khôi phục các policy cho phép tự nâng quyền hay claim công khai.
- Restore DB từ backup chỉ trên staging khác trước; Storage object phải có backup riêng. Kiểm tra auth role, số bài/testcase, object path và canary sau restore. Backup chỉ được coi là hoạt động khi đã restore thử.

## Mẫu ghi nhận phiên pilot

Ngày/phiên bản: …; số người thử: …; thời lượng: …; tổng run/submit: …; verdict kỳ vọng/nhận được: …; p95 thời gian queue/chấm: …; SYSTEM_ERROR: …; RAM/disk đầu/cuối: …; lỗi và cách tái hiện: …; kết quả restore: …; quyết định mở rộng/dừng: …
