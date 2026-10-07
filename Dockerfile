# syntax=docker/dockerfile:1.6
# ==============================================================================
# Production Multi-Stage Dockerfile for Full-Stack Railway Block Planning System
# Stack: React 18 (Vite) + Go Fiber v2.52 API + Embedded Python 3.11 CP-SAT Engine
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build React Frontend (Vite)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies using cached npm cache
COPY --link frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit

# Build production assets
COPY --link frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Build Go Fiber API Binary
# ------------------------------------------------------------------------------
FROM golang:1.22-alpine AS go-builder
WORKDIR /app

# Download Go modules with persistent module and build caches
COPY --link backend/go.mod backend/go.sum ./backend/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && go mod download

# Compile static, stripped binary
COPY --link backend/ ./backend/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -trimpath -o /app/block_planner .

# ------------------------------------------------------------------------------
# Stage 3: Production Runtime Environment
# Note: Debian slim-bookworm is required because Google OR-Tools wheels require
# glibc (musl-based Alpine does not support precompiled ortools wheels).
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runner
WORKDIR /app

# 1. Install minimal runtime packages (curl for container healthcheck, libgomp1 for XGBoost/OpenMP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 2. Create unprivileged non-root user and group (UID/GID 10001)
RUN groupadd --system --gid 10001 appgroup && \
    useradd --system --uid 10001 --gid appgroup --no-create-home --shell /usr/sbin/nologin appuser

# 3. Install lightweight Python runtime dependencies
COPY --link engine/requirements.runtime.txt ./engine/requirements.runtime.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r engine/requirements.runtime.txt

# 4. Copy application files, static binary, and frontend assets with non-root ownership
COPY --link --chown=10001:10001 engine/ ./engine/
COPY --link --chown=10001:10001 backend/ ./backend/
COPY --link --chown=10001:10001 --from=go-builder /app/block_planner ./block_planner
COPY --link --chown=10001:10001 --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --link --chown=10001:10001 --chmod=755 docker/entrypoint.sh /entrypoint.sh

# 5. Ensure app directory permissions for generated artifacts (e.g., schedule CSVs)
RUN chown -R appuser:appgroup /app

# 6. Drop privileges to non-root user
USER appuser:appgroup

# Environment defaults
ENV PORT=3000 \
    PYTHON_PORT=8765 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_BIN=python3 \
    PYTHONPATH=/app:/app/engine:/app/backend \
    HORIZON_DAYS=7

EXPOSE 3000 8765

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-3000}/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["./block_planner"]
