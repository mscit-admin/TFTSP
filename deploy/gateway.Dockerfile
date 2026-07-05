# TFTSP web gateway — builds both Angular panels and serves them behind one nginx.
# Build context is the repo root.

# ---- Tribe Admin panel (served at /) ----
FROM node:22-alpine AS admin
WORKDIR /app
COPY apps/admin-web/package.json apps/admin-web/package-lock.json* ./
RUN npm ci
COPY apps/admin-web/ ./
RUN npm run build -- --base-href=/

# ---- Super-Admin panel (served under /platform/) ----
FROM node:22-alpine AS platform
WORKDIR /app
COPY apps/platform-web/package.json apps/platform-web/package-lock.json* ./
RUN npm ci
COPY apps/platform-web/ ./
RUN npm run build -- --base-href=/platform/

# ---- nginx serving both + proxying the API ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=admin    /app/dist/admin-web/browser    /usr/share/nginx/admin
COPY --from=platform /app/dist/platform-web/browser /usr/share/nginx/platform
EXPOSE 80
