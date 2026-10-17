# AGENTS.md — CodeJudge VN (Online Judge)

> **Governed by Polaris Engine**: Ultra-Productivity, Minimalist Code, Zero Over-Engineering.
> This file is the primary instruction set for all AI agents working in this repository.

---

## ⚡ Project Intelligence & Verified Commands

CodeJudge VN is an automated distributed Online Judge platform inspired by SASTOJ and QingdaoU OJ (`references/OnlineJudgeFE`).

### Architecture & Components

| Component | Path | Tech Stack | Key Responsibilities |
|:---|:---|:---|:---|
| **Web Frontend** | `apps/web/` | React 18, Vite 5, TS, Tailwind v3, Monaco Editor | Single SPA (`index.html`) with unified RBAC portals: `/teacher`, `/admin`. |
| **Judge Worker** | `apps/judge-worker/` | Node.js 22, TypeScript, gRPC, Supabase Client | Daemon: Realtime + 2s polling, atomic claim, CasesProvider gRPC server (`:50052`). |
| **Judging Engine** | `engine/rsjudge/` | Rust (Edition 2024), Tokio, Tonic gRPC, cgroups, rlimits | High-performance sandbox: compile & run code under `RLIMIT_*`, streaming testcase results. |
| **Database & Auth** | `supabase/` | PostgreSQL 15, Supabase Auth, Realtime, RLS, Storage | Schema (`schema.sql`), testcases private bucket, RBAC (`user_permissions`), RPC functions. |
| **E2E Testing** | `e2e/` | Playwright, TypeScript | Full end-to-end user & admin flow test suites. |

### Verified CLI Commands

| Action | Command | Scope |
|:---|:---|:---|
| **Web Dev Server** | `npm --prefix apps/web run dev` | Starts Vite on `http://localhost:3000` |
| **Web Build** | `npm --prefix apps/web run build` | Strict TypeScript check (`tsc`) + Vite production bundle |
| **Worker Dev Server** | `npm --prefix apps/judge-worker run dev` | Runs worker daemon with `tsx` |
| **Worker Build** | `npm --prefix apps/judge-worker run build` | Compiles TypeScript daemon (`tsc`) |
| **Worker Smoke Tests**| `npm --prefix apps/judge-worker run smoke` | Verifies local sandbox (AC/WA/TLE/output-cap/bwrap) |
| **Engine Tests** | `cd engine/rsjudge && cargo test` | Runs Rust unit & integration test suites (Submit/SelfTest) |
| **E2E Tests** | `npm --prefix e2e test` | Runs Playwright tests across user and admin portals |
| **Validate AG Kit** | `python3 .agents/scripts/validate_kit.py .agents` | Validates `.agents` kit integrity and frontmatter |

*Rule: Always verify code using the specific command for that component before concluding any task.*

---

## 🛡️ Critical Architecture & Safety Guardrails

### 1. Database & Security Guardrails
- **Hidden Testcase Secrecy**: Testcase inputs and outputs (`input_content`, `output_content`, and storage bucket `testcases`) MUST NEVER be exposed to anonymous or standard users. Only samples in `problems.samples` are public. RLS policies on `testcases` must never allow public `SELECT`.
- **Idempotent DB Migrations**: `supabase/schema.sql` must remain idempotent (safe to re-run multiple times). Always use `IF NOT EXISTS`, `DO $$ BEGIN ... END $$`, and `CREATE OR REPLACE FUNCTION`.
- **Security Definer Functions**: Sensitive functions like `claim_submission`, `get_contest_rank`, `get_problem_rank`, and `judge_problem_code` must have `SECURITY DEFINER SET search_path = public`.
- **Granular RBAC & Role Separation**:
  - Roles: `user` (default student), `teacher` (educator), `admin` (system administrator).
  - Permissions are managed via table `user_permissions` (`problems.manage`, `testcases.manage`, `contests.manage`, `announcements.manage`, `submissions.view_all`, `users.manage`).
  - Super admin (`role === 'admin'`) bypasses all granular permission checks.
  - Role `teacher` defaults to (`problems.manage`, `testcases.manage`, `contests.manage`, `submissions.view_all`) via trigger `on_profile_role_sync`. Teachers MUST NOT have `users.manage` or `announcements.manage` by default. Demoting a teacher to `user` immediately wipes granted permissions.
  - Database RLS policies and RPC functions must check `has_user_permission(auth.uid(), '<permission>')` instead of hardcoded role checks, while keeping `admin` bypass.

### 2. Judging Pipeline Guardrails
- **Atomic Submission Claim**: Submissions must always be claimed atomically using `claim_submission(uuid)` (`UPDATE submissions SET status='JUDGING' WHERE id=... AND status='PENDING' RETURNING id`). Never judge without atomic claiming to prevent race conditions.
- **Single Worker Assumption**: Only run 1 worker daemon per database instance unless an explicit distributed queue (PG notify / Redis / AMQP) is active.
- **Sandbox Isolation**: Never execute user code unsandboxed on the host. Always execute through `rsjudge` (cgroups/rlimits) or bubblewrap sandbox (`bwrap --unshare-all`, read-only fs, isolated net/pid/ipc/uts, wiped env). Enforce CPU time, memory limit, output cap (1MB), and hard timeout kill.
- **Trial Runs (`is_run = true`)**: Custom test runs must set `is_run = true` so they never pollute ranklists, user stats, or submission history.

### 3. Frontend & UI Directives
- **Unified RBAC SPA**: Single entry `index.html`; admin/teacher portals are routes (`/admin`, `/teacher`) inside the main SPA, protected by `AdminGate`/RBAC. No domain/subdomain separation.
- **Structure Review Before Growth**: Before major feature work, review folder/module layout against scalable standards; when the codebase is still small, refactor into a feature-based structure (`src/features/*`, shared `lib/`, `components/`) early to avoid large-scale churn later.
- **Role & Portal Separation**:
  - User portal (`/`): Standard student learning, problem-solving, contests, and rankings.
  - Teacher Workspace (`/teacher`): Dedicated educator workspace inside the main SPA React app (`TeacherPortal.tsx`). NEVER route teachers to a separate admin bundle/domain. Reuses problem/contest management components gated with granular permissions.
  - Admin Console (`/admin` route): Strictly restricted to `role === 'admin'` (RBAC). Non-admins must be blocked by `AdminGate.tsx` and redirected away (unified domain).
  - Clean Header Navbar: Top navigation header must NEVER contain cluttered portal switch buttons. Access to Teacher Workspace (`/teacher`) or Admin Console (`/admin`) must strictly reside inside the user avatar profile dropdown menu.
- **Tailwind CSS v3**: Stick to Tailwind v3 conventions. Do not use unconfigured Tailwind v4 syntax.
- **Monaco Editor Stability**: Handle editor lifecycle, cleanup listeners, and keep Monaco language mapping (`cpp`, `python`, `rust`, `java`) synchronized.
- **Visual Standards & Single Dominant Accent**:
  - Stick to **one single primary accent color** (`--accent` / #16A34A) backed by neutral tokens (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`).
  - **No Rainbow Styling**: Strictly prohibit scattering ad-hoc colors (`amber`, `purple`, `sky`, `blue`, `indigo`, `pink`) across labels, headings, inputs, and borders. Status colors (`--danger`, `--warning`) are reserved strictly for critical alerts or difficulty badges, never general decoration.
  - **Strict Icon Restraint**: Zero decorative icon clutter. Do NOT place icons beside every text label, section title, or field name. Icons are permitted only for functional user actions (e.g. search, edit, delete, close, back, upload). NEVER use emojis (`⚖️`, `🎉`, `★`) in production UI text.

---

## 📋 Mandatory Workflow: Read Docs ➔ Plan ➔ Execute ➔ Verify

> **ABSOLUTE RULE:** Never write or modify code without completing Phase 1 and Phase 2 first.

1. **Phase 1: Read Docs & Context First**
   - Read `README.md`, `plan.md`, `supabase/schema.sql`, and relevant source files.
   - Grep all callers before modifying any function or schema column.
   - Never code on assumptions; trace data flow from UI -> Supabase -> Worker -> Engine -> DB.

2. **Phase 2: Plan (Scope & Minimalist Blueprint)**
   - Outline a concise plan before editing any file.
   - Identify exact blast radius (only files and functions that strictly need modification).
   - Apply Polaris Ladder: determine what complexity can be skipped (YAGNI).
   - Define exact verification command (e.g. `npm --prefix apps/web run build`, `npm --prefix apps/judge-worker run smoke`).

3. **Phase 3: Execute (Surgical Execution)**
   - Follow the Polaris Ladder strictly. Write the minimum working code.
   - Keep diffs small and surgical; no gratuitous reformatting or unsolicited refactoring.

4. **Phase 4: Verify (Proof of Work)**
   - Run the verified project test or build command to prove correctness before concluding.

---

## 🧭 The Polaris Ladder (Mandatory for ALL Changes)

Before writing any code or proposing architecture, stop at the first rung that holds:

1. **YAGNI (You Aren't Gonna Need It)**: Does this really need to exist? If speculative, delete/skip it.
2. **Reuse Existing Code**: Check utils, components, and types already in this project before writing new ones.
3. **Standard Library First**: If the language stdlib can do it, use stdlib (no external dependencies).
4. **Native Platform Features**: Prefer native platform capabilities (HTML5 controls, CSS flex/grid, DB constraints, PostgreSQL triggers/views) over custom JS/code.
5. **Existing Dependencies**: Leverage already-installed libraries (`@supabase/supabase-js`, `lucide-react`, `@monaco-editor/react`, `@grpc/grpc-js`). Do NOT install new packages without explicit user consent.
6. **One-Liner**: Can it be written cleanly in one readable line? Make it one line.
7. **Minimal Robust Code**: Only write the minimum necessary code that solves the problem.

---

## 🛑 Anti-Overengineering Mandates

- **No Unrequested Abstractions**: Never create interfaces with a single implementation, abstract factories, or wrapper classes nobody asked for.
- **Root-Cause Bug Fixing**: Grep all callers of the function you touch and fix the root cause once at the source.
- **Deletion Over Addition**: The cleanest diff is a deletion. Prefer removing obsolete code over patching around it.
- **Surgical Changes**: Do not refactor unrelated files or reformat untouched blocks. Keep diffs focused and small.
- **Preserve Documentation**: Never strip existing comments, docstrings, or SQL documentation unless explicitly requested.

---

## 💬 Communication Protocol

- **Code First**: Deliver concise, working solutions.
- **No Fluff**: Skip pleasantries, self-evident explanations, and narrative tutorials.
- **Format Summary**: After making code edits, summarize concisely:
  - `Code change`: What was updated.
  - `Skipped`: What unneeded complexity was avoided.
  - `Verified`: The exact command run to prove it works.
