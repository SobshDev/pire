# pire: one image that serves the API at /api and the built frontend everywhere else.

# 1. Frontend
FROM oven/bun:1 AS web
WORKDIR /src
COPY package.json bun.lock ./
COPY web/package.json web/
COPY content/package.json content/
RUN bun install --frozen-lockfile
COPY content content
COPY web web
RUN bun run --cwd web build

# 2. API
FROM rust:1-slim-bookworm AS api
WORKDIR /src/api
COPY api/Cargo.toml api/Cargo.lock ./
# Cache dependencies separately from our own code.
RUN mkdir -p src/bin && echo "fn main() {}" > src/main.rs && echo "fn main() {}" > src/bin/openapi.rs && touch src/lib.rs \
    && cargo build --release --bin pire-api \
    && rm -rf src
COPY api/src src
COPY api/migrations migrations
RUN touch src/main.rs src/lib.rs && cargo build --release --bin pire-api

# 3. Runtime
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 pire
WORKDIR /app
COPY --from=api /src/api/target/release/pire-api /app/pire-api
COPY --from=web /src/web/dist /app/web
ENV BIND_ADDR=0.0.0.0:8080 \
    STATIC_DIR=/app/web \
    COOKIE_SECURE=true \
    RUST_LOG=pire_api=info,tower_http=info
USER pire
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
CMD ["/app/pire-api"]
