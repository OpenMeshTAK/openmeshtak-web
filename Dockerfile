# syntax=docker/dockerfile:1
# OpenMeshTak Web: the built PWA served by Caddy, which also terminates public HTTPS with
# Let's Encrypt and forwards /api to Core on the same origin.

FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443
