# CodeJudge VN

Nền tảng luyện và chấm lập trình online cho học sinh, giáo viên và quản trị viên. Frontend React/TypeScript là một SPA; Supabase cung cấp Auth/PostgreSQL/RLS/Storage; worker TypeScript điều phối chấm qua Rust rsjudge hoặc sandbox bubblewrap.

## Chức năng hiện có

- Bài tập, tìm kiếm/chủ đề, lộ trình luyện, Monaco C++/Python/Rust, bản nháp, chạy thử và nộp bài.
- Studio soạn đề trực quan: một khung gồm mô tả/input/output/ràng buộc, toolbar chung, bảng, công thức và chỉ số; code khởi đầu theo bài, lời giải và kiểm định lời giải chuẩn.
- Testcase nhập thủ công hoặc ZIP, test ẩn, trọng số; kết quả từng case và xếp hạng.
- Lớp học: mã mời, giao bài, deadline, tiến độ/điểm riêng theo lớp và xuất CSV.
- Contest ACM/OI: đăng ký/duyệt, bài thi, freeze, xếp hạng và chấm lại. Giáo viên quản lý contest do mình tạo; admin quản lý toàn hệ thống.
- RBAC, khóa tài khoản, audit, health/heartbeat, backup/restore và công cụ kiểm thử tải.

Mức sẵn sàng: **pilot kín có giám sát**. Email/domain, managed recovery, soak chấm 24 giờ và hardening tài nguyên từng job còn là các cổng nghiệm thu. Bằng chứng và giới hạn: [verification](docs/verification.md). Kế hoạch còn lại: [plan](plan.md).

## Cấu trúc

```text
apps/web/             SPA: /, /teacher, /admin
apps/judge-worker/    Worker, gRPC testcase provider, sandbox và các smoke test
engine/rsjudge/       Checkout engine được tái tạo bằng setup:engine
patches/              Patch engine cần để tái lập build
supabase/             Schema, seed local, migrations và kiểm thử quyền
scripts/              Setup engine, DB tests, backup và health
e2e/                 Playwright, fixture và kiểm thử staging
docs/                Hướng dẫn sử dụng, kỹ thuật, vận hành và kiểm chứng
```

## Cài đặt

Cần Node.js 22+, npm, Docker cho DB tests/triển khai worker; môi trường Linux cho sandbox. Build Rust cần toolchain hỗ trợ edition 2024, `protoc`, `buf`, `libseccomp-dev`. Chạy sandbox local cần `bubblewrap`, `g++`, `python3`, `rustc`, `/usr/bin/time`, `timeout`, `tar`, `zstd` và kernel cho user namespaces. Thiếu isolation thì hệ thống từ chối chạy code.

```bash
npm --prefix apps/web ci
npm --prefix apps/judge-worker ci
npm --prefix e2e ci
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Điền cấu hình vào hai file local:

| File | Biến |
|---|---|
| `.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, endpoint engine và health theo file mẫu |
| `apps/web/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Hai URL phải trỏ cùng môi trường. Service-role key chỉ ở phía server, không đặt trong biến `VITE_*` hoặc commit vào Git.

Tạo Supabase project, chạy `supabase/schema.sql` bằng SQL Editor. `supabase/seed.sql` chỉ dành cho DB local/demo trống; seed có thể thay testcase mẫu. Cấu hình Auth Site URL/redirect `/reset-password` và SMTP theo domain triển khai. Chi tiết: [database](docs/database.md).

## Chạy ứng dụng

Web ở cổng 3000:

```bash
npm run dev:web
```

Worker và engine bằng Docker, dùng root `.env`:

```bash
npm run setup:engine
docker compose up -d --build
node scripts/health.mjs
```

Chỉ chạy **một worker trên mỗi DB**. Khi dùng compose, không chạy thêm worker dev cùng DB.

Nếu phát triển engine/worker trực tiếp trên Linux:

```bash
npm run setup:engine
(cd engine/rsjudge && cargo build --locked --bin rsjudge)
engine/rsjudge/target/debug/rsjudge --config-dir apps/judge-worker/engine-config --cases-endpoint http://127.0.0.1:50052
```

Chạy worker ở terminal khác với `RSJUDGE_ENDPOINT=127.0.0.1:50051` trong `.env`:

```bash
npm run dev:worker
```

Để dùng local sandbox, bỏ `RSJUDGE_ENDPOINT`; bubblewrap vẫn bắt buộc. Chi tiết triển khai, drain và rollback: [pilot runbook](docs/pilot-runbook.md).

## Kiểm tra

```bash
npm run build
npm --prefix apps/judge-worker test
npm --prefix apps/judge-worker run smoke
npm run test:db
npm run test:ops
npx --prefix e2e playwright install chromium
npm run test:e2e
npm run test:pilot
```

`test:db`, `test:ops`, `test:pilot` dùng container/fixture tạm. Playwright mặc định build web rồi chạy preview cổng 3101 với API fixture. `test:pilot` cần binary engine đã build; kiểm tra local và Rust sandbox, không dùng DB staging. Các lệnh staging phải chạy riêng theo [runbook](docs/pilot-runbook.md).

## Tài liệu

Bắt đầu từ [mục lục tài liệu](docs/README.md): hướng dẫn học sinh/giáo viên/admin, định dạng testcase, DB/migrations, kiến trúc, quyền contest, rich text, vận hành và kiểm chứng. Phần chấm theo trọng số testcase; chưa cung cấp SPJ, interactive, nhóm subtask hoặc kiểm tra đạo văn hoàn chỉnh.

## Dọn sản phẩm sinh ra

`npm run clean` xóa build web/worker, preview E2E và báo cáo Playwright; giữ dependency đã cài, cấu hình local và dữ liệu DB. Chạy `npm run build` trước khi dùng lại bản build/triển khai. Engine nguồn và patch là thành phần bắt buộc; bộ tài liệu không phụ thuộc checkout frontend tham khảo.
