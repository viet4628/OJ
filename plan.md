# Kế hoạch pilot CodeJudge VN

Cập nhật 25/10/2026. Tài liệu này chỉ giữ trạng thái và công việc còn lại; hướng dẫn nằm trong [docs](docs/README.md), bằng chứng trong [verification](docs/verification.md).

## Đã hoàn thành trong phạm vi pilot

| Phần | Trạng thái |
|---|---|
| Bảo mật | RLS/RPC, quota, chống giả verdict/nâng quyền, testcase private, audit và khóa tài khoản |
| Chấm bài | Claim nguyên tử, local/Rust sandbox, timeout/output cap, trọng số, trial score 0, recovery bài stale |
| Backend | WorkerApp, queue, service, repository và hai backend chấm theo composition |
| Ngân hàng đề | Lưu bundle nguyên tử, Studio rich text chung bốn phần, công thức/chỉ số, starter code, editorial/kiểm định, ZIP và hướng dẫn định dạng |
| Luyện tập | Monaco local, chạy mẫu/custom, nộp bài, nháp theo tài khoản/bài/ngôn ngữ/ngữ cảnh, lịch sử và rank |
| Lớp học | Tạo/mời/join/giao bài/deadline; điểm đúng ngữ cảnh lớp và CSV |
| Contest | Workspace dùng chung luyện tập, đăng ký/duyệt, ACM/OI/freeze/rejudge và quyền quản lý theo người tạo |
| Vận hành | Compose, health/heartbeat/drain, CI workflow, công cụ backup/restore local và load/health |
| Tài liệu | Hướng dẫn sử dụng, cài đặt, DB, kiến trúc, vận hành; loại bỏ tham khảo/bản engine dự phòng và tài liệu kế hoạch cũ |

## Phase tiếp theo

| Phase | Việc | Tiêu chí hoàn thành |
|---|---|---|
| 1 — Hạ tầng thử nghiệm | Domain/TLS, Auth redirect/SMTP, CI GitHub, kênh cảnh báo ngoài | Đăng ký/reset qua email tới hộp thư thật; CI xanh; alert được nhận khi health lỗi |
| 2 — Phục hồi | Managed Supabase DB + Storage recovery trên project khác | Restore đủ dữ liệu/Auth/RLS/blob; canary chấm đúng sau restore; ghi thời gian phục hồi |
| 3 — Độ ổn định | Soak chấm thật ít nhất 24 giờ, có người dùng thử | Không mất kết quả/claim trùng/bài treo; ghi queue, p95, SYSTEM_ERROR, RAM/disk và restart |
| 4 — Mở rộng pilot | Nhóm 5–10 người, tăng dần theo số đo | Có biên bản lỗi tái hiện, capacity theo bộ đề thực tế và quy trình trực vận hành |
| 5 — Trước mở công khai | Máy judge riêng, accounting/cgroup theo job, kiểm thử abuse và rà dependency | Giới hạn toàn process tree, fail-closed, audit bảo mật/tài nguyên và recovery đạt |

Lượt health thụ động trước chỉ có 20 mẫu trong khoảng 5 phút; tiến trình đã dừng, không phải bằng chứng 24 giờ. Chạy lại soak theo [operations](docs/operations-tools.md) khi có môi trường sẵn sàng.

## Kế hoạch cải thiện hiệu năng

Lập ngày 25/10/2026; đang triển khai theo phê duyệt. Thực hiện theo thứ tự dưới đây, bổ sung cho các phase pilot hiện có. Giữ một worker/DB, atomic claim, testcase private và sandbox. Không tăng timeout health để che lỗi, không thêm dependency hoặc queue service.

Tiến độ: đã triển khai timeout/đo thời gian và đối chiếu verdict sau lỗi ghi vào worker; đã áp migration phân trang/rank trên staging; web đã tách route, phân trang và theo dõi bài chấm lâu. Rank SQL local 100k submissions nhanh hơn khoảng5,7 lần trong lượt so cùng dữ liệu, kết quả ACM/OI/freeze khớp. Bundle chính giảm khoảng55%. Health30 phút đạt; chiến dịch tải dừng lỗi ở mức5 người vòng1 với SYSTEM_ERROR và health mất, nên các vòng tải còn lại và soak24h chưa chạy. Không có kết luận capacity. Chưa thêm cache archive xuyên job: cần tín hiệu version/invalidation đáng tin cậy cho cả blob Storage trước khi bỏ lượt đọc; giữ nhánh hoãn cache đã cho phép trong P2. Median đóng gói25ms nhỏ hơn nhiều so với tải Storage2,68s; cache phần nén đơn thuần ít giá trị, còn cache bỏ lượt tải cần một thay đổi version riêng.

Bản cuối đã qua lượt ngắn15 bài/5 người, 10 testcase Storage64KiB, C++/Python/Rust và TLE: 0 lỗi, p95 hoàn tất40,57s; không so tỷ lệ tăng tốc với lượt trước bị lỗi mạng/restart. Chiến dịch nền đã bắt đầu health30 phút → hai vòng5/10/20 người, mỗi mức10 phút → soak24h nếu mọi bước đạt. `scripts/run-performance-campaign.sh` và heartbeat theo dõi15 phút giữ kết quả tại `docs/reports/performance-campaign-*`; xem bằng chứng và giới hạn mới nhất trong `docs/verification.md`.

### Cơ sở và mục tiêu đo

- Lịch sử A+B: 10 tài khoản, 50 bài, 0 lỗi; 1,29 bài/s; p95 queue 6,36s và hoàn tất 7,20s. Thời gian chờ trung bình chiếm khoảng 87% thời gian hoàn tất. Đây là một testcase inline, chưa đo capacity đề thật.
- Build web trong lượt đánh giá: JS chính 292,64 KB gzip, editor 720,42 KB gzip, rich text 170,52 KB gzip. Chưa có số đo LCP/INP trên trình duyệt.
- Kiểm tra trực tiếp khoảng 22:44 ngày 25/10/2026: health HTTP 503, poll cũ hơn 60s, Docker chuyển unhealthy. Nguyên nhân chưa xác định; không coi trạng thái này là số đo hiệu năng bình thường.
- Mục tiêu ban đầu, cần xác nhận bằng benchmark: A+B cùng cấu hình p95 hoàn tất <=5s; API danh sách/rank p95 <=500ms trên bộ dữ liệu và vị trí client được ghi rõ; giảm JS chính xuống <=220 KB gzip. Không dùng các mục tiêu này làm cam kết capacity.

### P0 — Khôi phục readiness và tìm nguyên nhân poll chậm

- Đối chiếu health, log worker/engine, kết nối DB và phiên bản container đang chạy với source; đo request `getPending`, recovery và heartbeat. Phân biệt lỗi mạng/DB, request treo và engine mất readiness trước khi sửa.
- Nếu xác nhận request có thể treo: thêm timeout có hủy request ở điểm gọi phù hợp bằng công cụ sẵn có; poll được thử lại, lỗi claim/lưu verdict tiếp tục dừng tiêu thụ bài. Không retry mù thao tác ghi có kết quả chưa rõ.
- Phạm vi dự kiến: `apps/judge-worker/src/worker.ts`, `worker-app.ts`, `data/judge-repository.ts`, `config.ts` và `tests/worker.test.mjs`; chỉ sửa file liên quan nguyên nhân thật.
- Hoàn tất: tái hiện được nguyên nhân hoặc ghi rõ giới hạn chẩn đoán; health ready liên tục 30 phút khi dependency khỏe; mô phỏng DB chậm/mất kết nối cho thấy health báo lỗi và tự phục hồi, không mất verdict hay claim trùng.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `npm run test:ops`, `node scripts/health.mjs --duration 1800 --interval 15 --output /secure/health-recovery.jsonl`. Chạy health dài trên môi trường phù hợp, không tự đánh dấu đạt trước khi đủ thời gian.

### P1 — Đo baseline đại diện trước khi tối ưu

- Tái sử dụng load script; thêm bộ bài C++/Python/Rust với test inline và Storage, bộ nhiều testcase và trường hợp TLE. Ghi cấu hình máy, container limits, phiên bản build, kích thước test và ngôn ngữ.
- Đo bằng đồng hồ đơn điệu các công đoạn claim, đọc dữ liệu, chuẩn bị/tải test, tổng RPC chấm, lưu verdict; tách compile/run trong engine nếu số tổng chưa giải thích được độ trễ. Log chỉ ID/thời gian/dung lượng, không ghi code hoặc nội dung test ẩn.
- Lấy mẫu CPU/RAM/PID/disk trong suốt lượt chạy; báo p50/p95/p99, lỗi và queue DB bên cạnh queue trong bộ nhớ. Ghi rõ thời gian client có bao gồm mạng/poll và việc throughput hiện tính cả thời gian cleanup.
- Phạm vi: `apps/judge-worker/scripts/load-staging.mjs`, `test-load.mjs`, các điểm đo trong service/repository/provider/client; chỉ chạm engine nếu cần tách compile/run. Báo cáo tại `docs/reports/`.
- Chạy từng mức 5, 10, 20 người nộp đồng thời trên staging riêng, tuân thủ quota; mỗi mức ít nhất 10 phút, lặp lại cùng bộ tải để đối chiếu. Dừng tăng khi queue tăng liên tục 2 phút, xuất hiện SYSTEM_ERROR do hạ tầng, hoặc RAM vượt 80% container limit. Chờ drain và kiểm tra dữ liệu sau dừng.
- Hoàn tất: xác định công đoạn chiếm thời gian, mức tải ổn định và điểm bắt đầu quá tải cho từng nhóm bài. Chưa suy từ số bài/s sang tổng số học sinh online.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `node apps/judge-worker/scripts/test-load.mjs`, `npm run test:pilot`; chạy tải riêng trên staging và lưu cấu hình cùng báo cáo.

### P2 — Giảm chi phí mỗi bài chấm nếu P1 xác nhận

- Ưu tiên bỏ lần đọc metadata trùng giữa service và provider nếu có thể tái sử dụng snapshot trong một job mà không làm sai testcase/giới hạn.
- Nếu chuẩn bị testcase chiếm tỷ trọng đáng kể: cache archive private theo phiên bản của toàn bộ bundle đề/testcase/giới hạn, có giới hạn byte và cơ chế loại bỏ. Phải bao phủ sửa/xóa testcase, cập nhật blob cùng đường dẫn và đổi giới hạn; không cache chỉ theo problem ID. Nếu chưa có tín hiệu phiên bản tin cậy thì bổ sung trước hoặc hoãn cache.
- Hạn chế tải Storage song song theo ngân sách RAM từ P1; không `Promise.all` toàn bộ bộ test lớn. Ưu tiên cache đĩa có giới hạn nếu buffer gây đỉnh RAM cao.
- Phạm vi dự kiến: `judging/engine-judge.ts`, `engine/cases-provider.ts`, `data/judge-repository.ts`; schema/migration chỉ khi cần version bundle. Nếu sửa truy vấn, grep toàn bộ đường ghi liên quan trước.
- Hoàn tất: cùng bộ tải có thời gian chuẩn bị test giảm rõ ràng và p95 tổng không hồi quy; sửa đề/test/blob dùng ngay phiên bản mới; RAM/disk không vượt ngân sách; weighted verdict, trial score và testcase secrecy giữ nguyên.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `npm run test:pilot`; thêm `npm run test:db` nếu có migration; benchmark lại đúng workload P1. Nếu sửa Rust, chạy `cargo test` tại `engine/rsjudge` và cập nhật patch tái lập.

### P3 — Giảm tải DB và frontend

- Danh sách bài: truy vấn chỉ cột hiển thị, lọc/sắp xếp/phân trang tại DB; rà các caller `getProblems` để giữ đúng nhu cầu trang học, tìm kiếm và chọn đề. Ranklist phân trang/sắp xếp phía DB.
- Dùng `EXPLAIN (ANALYZE, BUFFERS)` trên DB test với 10k/100k submissions để đo rank/quota/history; chỉ thêm composite/partial index có bằng chứng. Chuyển `get_contest_rank` từ vòng lặp truy vấn sang tổng hợp tập hợp nếu đây là điểm nghẽn, giữ đúng ACM/OI, freeze, run và quyền owner/admin.
- Lazy-load route chưa cần ở trang đầu, nhất là TeacherPortal và workspace; tái sử dụng lazy Monaco/Tiptap hiện có. Đo trước khi thay cách chia chunk; không đặt mục tiêu giảm editor bằng cách bỏ tính năng cần dùng.
- Điều chỉnh theo dõi submission: trạng thái chờ rõ ràng, polling có backoff và cleanup; hết khoảng chờ UI không đồng nghĩa job lỗi. Tận dụng Realtime hiện có và giữ polling dự phòng khi mất kết nối.
- Phạm vi: `apps/web/src/App.tsx`, API problems/users/submissions, trang danh sách/rank/workspace và các caller thực tế; `supabase/schema.sql` cùng migration idempotent nếu cần.
- Hoàn tất: mục tiêu bundle/API nêu trên được đo; tìm kiếm và chuyển trang không thiếu/lặp hàng; rank/freeze/quyền không đổi; UI tiếp tục theo dõi bài chấm >30s và hủy listener/timer khi rời trang. Ghi LCP/INP trên production preview với thiết bị/mạng cố định để so trước–sau.
- Kiểm chứng: `npm --prefix apps/web run build`, `npm run test:e2e`; `npm run test:db` nếu sửa SQL. Lưu kích thước bundle và execution plan trước–sau.

### P4 — Nghiệm thu tải dài và quyết định capacity

- Sau P0–P3, chạy lại workload P1; chạy soak chấm thật ít nhất 24 giờ với RAM/disk/queue/latency/error và tình huống restart/drain. Load test và health soak là hai bằng chứng riêng.
- Hoàn tất: không mất verdict/claim trùng/bài treo; không có SYSTEM_ERROR do hạ tầng; queue không tăng vô hạn ở tải công bố; RAM/disk không tăng không giới hạn; recovery sau restart đạt. Ghi p95 theo nhóm bài và chọn tải vận hành có biên dự phòng từ số đo thực tế.
- Chỉ cân nhắc concurrency giới hạn trong một daemon khi tối ưu chi phí mỗi bài vẫn không đạt nhu cầu. Điều kiện trước: sandbox/accounting toàn cây process theo job, ngân sách CPU/RAM và kiểm chứng isolation/drain/recovery. Giữ tuần tự cho tới khi các điều kiện này đạt; nhiều worker/DB là thiết kế riêng.
- Kiểm chứng: `npm run test:pilot`, load/soak staging, `node scripts/health.mjs`; cập nhật `docs/verification.md` và `docs/pilot-runbook.md` bằng kết quả đã chạy.

Trạng thái lần chạy 25/10/2026: health30 phút PASS, nhưng vòng `load-5-round-1` thất bại sau khi ghi nhận SYSTEM_ERROR, 237 lỗi health và bốn lần chờ bài chấm quá hạn; cleanup fixture báo lỗi. Runner đã thoát với exit1. Không tiếp tục các stage sau hoặc soak. Trước lần chạy lại cần chẩn đoán sự cố worker/engine và xác minh fixture còn sót theo runbook; không tăng timeout health hoặc bỏ sandbox.

Mỗi bước triển khai thành diff riêng, so với baseline cùng workload. Nếu kết quả không cải thiện hoặc sai verdict/quyền, rollback bước đó; không gộp nâng dependency, thiết kế queue mới hoặc refactor diện rộng vào đợt tối ưu.

## Kế hoạch cải thiện độ trễ chấm bài (bổ sung 12/11/2026)

Bổ sung cho mục "Kế hoạch cải thiện hiệu năng" ở trên, dựa trên số đo `docs/reports/worker-timings-final-20261025.json` (22 bài) và `docs/reports/load-20261025.json` (10 tài khoản, 50 bài). Không đổi kiến trúc: vẫn một worker/DB, claim nguyên tử, testcase private, sandbox. Không thêm dependency hay queue service.

Quy ước đặt tên: T0 và T1 là việc đã nằm trong P0–P2 hiện có (đo lại baseline và giảm chi phí mỗi bài); T2 là phần mới (concurrency giới hạn trong một daemon) và nằm đúng điều kiện đã viết ở P4; T3–T5 là việc còn lại.

### Kết quả đợt 12/11/2026 (đã chạy trên staging thật)

Đợt này chạy trên staging Supabase thật với `docker compose` (worker + rsjudge engine), bộ tải 10 tài khoản/50 bài và bộ Storage 10 testcase/TLE.

| Việc | Kết quả |
|---|---|
| T0 — baseline đo lặp được | Thêm `apps/judge-worker/scripts/worker-timings.mjs` (tổng hợp p50/p95 từ log worker). Baseline cũ: p50 queue 10,19s, p95 hoàn tất 23,67s, 0,71 bài/s |
| T1.1 — tải Storage song song có ngân sách | Đọc testcase chạy 8 request/lần thay vì 2; thêm semaphore toàn cục 8 lượt tải Storage để nhiều job không làm quá tải bucket. `cases.loadMs` p95 6,43s → 2,56s |
| T1.2 — cache bundle theo phiên bản | **Hoãn**: web luôn lưu testcase inline (`input_content`), nên `cases.loadMs` p50 = 0ms; cache chỉ thêm rủi ro trả verdict sai khi tín hiệu version không đáng tin cậy |
| T2 — concurrency giới hạn | `WORKER_CONCURRENCY` (mặc định 2, cho phép 1..8). Hàng đợi drain song song, claim nguyên tử giữ nguyên. Lượt cuối: p50 queue 2,35s, p95 hoàn tất 4,33s, 2,68 bài/s, 0 lỗi; qua nhiều lượt p95 hoàn tất 4,3–10,1s và throughput 1,9–2,7 bài/s |
| Retry đường đọc | Một lần retry cho lỗi mạng tạm ở đọc problem/testcase/Storage; trước đó lỗi này thành SYSTEM_ERROR |
| **Sửa lỗi đo thời gian/bộ nhớ** | `wait4` chỉ trả usage của bwrap (PID namespace) nên mọi bài đều ghi ~1ms/2MB. Bọc chương trình bằng GNU time trong sandbox (cả engine lẫn chấm local): bài 500ms CPU/100MB nay ghi đúng 550ms/103MB; verdict MLE nhận diện đúng |

Quy tắc vận hành: **concurrency không được vượt số CPU của engine** (engine `cpus: 2`, worker `WORKER_CONCURRENCY: 2`). Runner giết theo wall-time, nên nếu nhiều job tranh CPU trên cùng số core, một chương trình sát thời gian có thể bị TLE giả. Muốn tăng concurrency thì phải tăng `cpus` của engine tương ứng.

Còn lại: T3 (giới hạn hàng đợi trong RAM), T4 (vị trí xếu hàng cho người dùng), T5 (campaign 5/10/20 người + soak 24h). Chưa sửa `updated_at` cho testcase vì chưa dùng cache bundle.

### Số đo hiện tại và mục tiêu

| Hạng mục | Hiện tại | Mục tiêu | Nút thắt |
|---|---|---|---|
| `totalMs` chấm 1 bài, p50 / p95 | 4,8s / 10,0s | <= 2,5s / <= 6s | tải testcase từ Storage |
| `cases.loadMs` p50 / p95 | 2,68s / 6,43s | <= 0,5s | Storage round-trip |
| `cases.archiveMs` p95 | 558ms | <= 100ms | build tar+zstd mỗi bài |
| `judgeMs` p50 | 2,58s | <= 1,5s | = load + compile + run |
| Queue wait p95 (10 người đồng thời) | 6,36s | <= 3s | concurrency = 1 |
| SYSTEM_ERROR dưới tải | có (vòng 5 người đã thất bại) | 0 | chưa rõ nguyên nhân |

### T0 — Chốt baseline đo lặp được

- Vòng `load-5-round-1` đã thất bại nên chưa có baseline hợp lệ để so sánh. Không làm T1/T2 trước khi có số đo lặp lại được trên cùng bộ tải.
- Thay đổi: script tổng hợp log worker (`[Timing]`, `[CasesTiming]`, `[EngineTiming]`) ra p50/p95 theo nhóm ngôn ngữ và số testcase, lưu `docs/reports/`. Không đụng code runtime.
- Phạm vi: `apps/judge-worker/scripts/` (script mới); chỉ sửa file liên quan nguyên nhân thật.
- Hoàn thành: chạy 3 lần trên cùng bộ tải, sai số p50 <= 15%, có bảng theo nhóm bài.
- Kiểm chứng: `npm --prefix apps/judge-worker run build && node apps/judge-worker/scripts/test-load.mjs`.

### T1 — Giảm thời gian chuẩn bị testcase (song song với P2 hiện có)

- Tải Storage song song theo ngân sách: `judging/engine-judge.ts` đang tải 2 request mỗi lượt (input + output của một testcase); đổi sang 8 request đồng thời, <= 32 MiB đang bay.
- Cache bundle theo phiên bản để bỏ lượt tải lặp: bảng `testcases` chưa có `updated_at`; thêm trigger bump `problems.updated_at` khi testcases INSERT/UPDATE/DELETE (migration idempotent). Version = `problems.updated_at` cộng hash `(id, input_path, output_path, score)` để bắt đổi path/blob. Cache chỉ nằm trong RAM tiến trình worker, không ghi testcase ra ngoài thư mục tạm.
- Cache archive bytes theo version để bỏ `mkdtemp` + `tar` + `zstd` mỗi bài (`engine/cases-provider.ts`); engine đã nhận tar thuần.
- Phạm vi: `judging/engine-judge.ts`, `engine/cases-provider.ts`, `data/judge-repository.ts`, `supabase/schema.sql` cùng migration mới.
- Hoàn thành: `cases.loadMs` p50 <= 0,5s, `archiveMs` p95 <= 100ms, `totalMs` p50 <= 2,5s; sửa/xóa testcase dùng ngay phiên bản mới; RAM/disk không vượt ngân sách; weighted verdict, trial score và testcase secrecy giữ nguyên.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `npm --prefix apps/judge-worker run smoke`, `npm run test:pilot`, `npm run test:db` (có migration).

### T2 — Concurrency giới hạn trong một daemon (chỉ khi T1 xong)

- Điều kiện tiên quyết, phải kiểm chứng được chứ không "tin": `RLIMIT_CPU/AS/FSIZE` đặt qua `setrlimit` trong `pre_exec` nên kế thừa cho cháu, nhưng `RLIMIT_CPU` tính theo từng process chứ không theo cây; giữ concurrency <= 2 và nâng `cpus` engine để có biên. Mỗi job giữ tối đa `memory_limit_mb` của đề nên nâng `mem_limit` engine khi bật concurrency.
- Thay đổi: `submissions/submission-queue.ts` nhận `concurrency` (env `WORKER_CONCURRENCY`, mặc định 1); `config.ts` validate env mới; `worker-app.ts` heartbeat/health báo đúng số job đang chạy. Không đổi DB — `claim_submission` nguyên tử đã chặn chạy trùng.
- Phạm vi: `submissions/submission-queue.ts`, `config.ts`, `worker-app.ts`, `docker-compose.yml`.
- Hoàn thành: concurrency 2 cho queue p95 <= 3s ở 10 người, throughput >= 2 bài/s, 0 SYSTEM_ERROR, RAM engine <= 80% limit; isolation, drain và recover vẫn đúng.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `npm run test:pilot`, campaign 5/10/20 người >= 10 phút mỗi mức.
- Điều kiện dừng: nếu T1 đã đạt `totalMs` p50 <= 2,5s và queue p95 <= 3s thì không làm T2, giữ concurrency 1 (đơn giản và an toàn hơn).

### T3 — Công bằng và giới hạn hàng đợi

- Không ưu tiên theo tài khoản để tránh starvation; nếu cần thì ưu tiên contest sắp đóng, lấy deadline qua `contest_id`.
- `SubmissionQueue.pending` hiện không giới hạn độ dài; quota ở DB đã chặn (<= 3 bài chờ mỗi người) nhưng vẫn cần giới hạn số bài giữ trong RAM.
- Phạm vi: `data/judge-repository.ts` (`getPending`), `submissions/submission-queue.ts`.
- Hoàn thành: hàng đợi trong RAM có trần; không ưu tiên gây starvation; phản hồi vị trí xếu hàng khớp với hàng đợi thật.
- Kiểm chứng: `npm --prefix apps/judge-worker test`, `npm run test:pilot`.

### T4 — Phản hồi về người dùng

- Realtime `UPDATE` đã cho phản hồi dưới 1s; không tăng tần suất poll (poll dự phòng 5s giữ nguyên) để không tăng tải DB.
- Thiếu là thông báo vị trí xếu hàng và thời gian chờ; dùng `judge_servers.queued` từ heartbeat hoặc RPC đếm bài PENDING có `created_at` nhỏ hơn bài của người dùng.
- Phạm vi: `apps/web/src/features/user/ProblemDetail.tsx`, `apps/web/src/lib/api/submissions.ts`, có thể `supabase/schema.sql` (RPC đếm vị trí xếu hàng).
- Hoàn thành: hiển thị "Đang xếu hàng (vị trí N)" và thời gian chờ; UI vẫn theo dõi bài chấm > 30s và hủy listener/timer khi rời trang; verdict và quyền không đổi.
- Kiểm chứng: `npm --prefix apps/web run build`, `npm run test:e2e`; `npm run test:db` nếu sửa SQL.

### T5 — Nghiệm thu tải và công bố capacity

- Chạy lại campaign 5/10/20 người (10 phút mỗi mức) rồi soak 24h theo `scripts/health.mjs`, có kịch bản restart/drain; lưu báo cáo `docs/reports/`.
- Hoàn thành: không mất verdict/claim trùng/bài treo; 0 SYSTEM_ERROR do hạ tầng; queue không tăng vô hạn ở tải công bố; recovery sau restart đạt; ghi p95 theo nhóm bài và chọn tải vận hành có biên dự phòng.
- Kiểm chứng: `npm run test:pilot`, `node scripts/health.mjs`; cập nhật `docs/verification.md` và `docs/pilot-runbook.md` bằng kết quả đã chạy.

### Thứ tự và quy tắc dừng

T0 → T1 → T2 → T4 → T5. T1 và T2 không làm cùng lúc vì cùng đổi vùng `judging/engine-judge.ts` và cùng ảnh hưởng `judgeMs`, khó quy kết nguyên nhân hồi quy; T1 trước vì độc lập, rủi ro thấp và không đụng concurrency. Mỗi bước thành diff riêng so với baseline của T0; nếu sai verdict/quyền hoặc hồi quy thì rollback bước đó. Số đo bổ sung đưa vào `docs/verification.md` và `docs/reports/`.

## Giữ phạm vi

Một SPA và một worker/DB. Chưa cần Redis, nhiều worker, microservice mới hoặc thêm thư viện. SPJ, interactive, subtask và plagiarism chỉ lên phase riêng khi có nhu cầu/tiêu chí cụ thể. Không coi build hoặc canary A+B ngắn là chứng nhận mở công khai.

Đợt dọn tài liệu: hợp nhất nội dung còn dùng, bỏ tham khảo/engine dự phòng/cache/script cũ (~9 GB), sửa clean để giữ dependency. Kiểm tra lại build, 63 UI, 10 worker, DB và ops PASS; liên kết tài liệu hợp lệ, worker triển khai vẫn healthy. Các cổng hạ tầng/24 giờ nêu trên tiếp tục là việc còn lại.
