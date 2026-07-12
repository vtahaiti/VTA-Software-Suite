FROM node:20-alpine AS builder

ARG BUILD_COMMIT_SHA
ARG BUILD_TIME
ARG COMMIT_SHA
ARG COOLIFY_GIT_COMMIT
ARG SOURCE_COMMIT

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY database ./database

RUN npm ci
RUN npm run prisma:generate
RUN date -u +"%Y-%m-%dT%H:%M:%SZ" > /app/build-time
RUN npm run build --workspace=@vta/api

FROM node:20-alpine AS runner

WORKDIR /app

ARG BUILD_COMMIT_SHA
ARG BUILD_TIME
ARG COMMIT_SHA
ARG COOLIFY_GIT_COMMIT
ARG SOURCE_COMMIT

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV API_PORT=3001
ENV PERF_BOOT_LOG=1
ENV PERF_REQUEST_LOG=1
ENV PERF_QUERY_LOG=1
ENV PRISMA_CONNECT_RETRIES=10
ENV BUILD_COMMIT_SHA=${BUILD_COMMIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV COMMIT_SHA=${COMMIT_SHA}
ENV COOLIFY_GIT_COMMIT=${COOLIFY_GIT_COMMIT}
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/database ./database
COPY --from=builder /app/build-time ./build-time
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN mkdir -p uploads

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/health/ready').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy --schema=database/prisma/schema.prisma && npm run start --workspace=@vta/api"]
