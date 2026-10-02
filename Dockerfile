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
# Third-party notices and the CycloneDX SBOM, served next to the app.
RUN pnpm release:notices

FROM caddy:2
LABEL org.opencontainers.image.title="OpenMeshTak Web" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.source="https://github.com/OpenMeshTAK/openmeshtak-web"
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443
