# ============================================================
# CodeJudge VN — Judge Worker + rsjudge engine (multi-stage)
# Build từ ROOT của repo (compose đã đặt context: .):
#   docker compose -f docker-compose.yml build worker
# Run modes:
#   worker: node dist/worker.js            (RSJUDGE_ENDPOINT=engine:50051)
#   engine: rsjudge --config-dir /etc/rsjudge --cases-endpoint http://worker:50052
# ============================================================

# ---- Stage 1: build TypeScript worker -----------------------
FROM node:22-bookworm-slim AS tsbuild
WORKDIR /app
COPY apps/judge-worker/package*.json ./
RUN npm ci || npm install
COPY apps/judge-worker/tsconfig.json ./
COPY apps/judge-worker/src ./src
RUN npm run build

# ---- Stage 2: build rsjudge engine (Rust) -------------------
FROM rust:1-bookworm AS rustbuild
RUN apt-get update && apt-get install -y --no-install-recommends \
      protobuf-compiler libprotobuf-dev curl \
      libseccomp-dev \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSL -o /usr/local/bin/buf \
      "https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64" \
    && chmod +x /usr/local/bin/buf
WORKDIR /src
COPY engine/rsjudge .
RUN CARGO_TARGET_DIR=/tmp/rsjudge-target cargo build --release --bin rsjudge

# ---- Stage 3: runtime ---------------------------------------
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ \
      gcc \
      rustc \
      python3 \
      time \
      coreutils \
      tar \
      zstd \
      bubblewrap \
      libseccomp2 \
    && rm -rf /var/lib/apt/lists/*

# rsjudge binary + executor config
COPY --from=rustbuild /tmp/rsjudge-target/release/rsjudge /usr/local/bin/rsjudge
RUN chmod 755 /usr/local/bin/rsjudge
COPY apps/judge-worker/engine-config /etc/rsjudge

WORKDIR /app
COPY --from=tsbuild /app/dist ./dist
COPY apps/judge-worker/proto ./proto
COPY apps/judge-worker/package*.json ./
COPY apps/judge-worker/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]
