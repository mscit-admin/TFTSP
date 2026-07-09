#!/usr/bin/env bash
#
# TFTSP — interactive installer.
# Asks WHERE to install and WHICH port, then brings up the whole system
# (PostgreSQL, Redis, MinIO, MailHog, API, and both web panels behind one
# gateway) with Docker Compose. One port for everything.
#
# Usage:   ./install.sh
#
set -euo pipefail

BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; NC=$'\e[0m'
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$NC" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$NC" "$*"; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$NC" >&2; exit 1; }

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say "${BOLD}TFTSP — تنصيب النظام / System installer${NC}"
say "${DIM}منصة شجرة العائلات والقبائل${NC}"
say ""

# ---- prerequisites ----
command -v docker >/dev/null 2>&1 || die "Docker غير مثبّت / Docker is not installed. Install Docker first."
if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else die "Docker Compose غير متوفّر / Docker Compose not found."; fi
docker info >/dev/null 2>&1 || die "Docker daemon لا يعمل / Docker daemon is not running."
ok "Docker + Compose جاهزان"

# ---- 1) install directory ----
DEFAULT_DIR="/opt/tftsp"
read -r -p "أين تريد تنصيب النظام؟ / Install directory [${DEFAULT_DIR}]: " DEST_DIR
DEST_DIR="${DEST_DIR:-$DEFAULT_DIR}"
DEST_DIR="${DEST_DIR/#\~/$HOME}"

# ---- 2) port ----
DEFAULT_PORT="8080"
read -r -p "على أي منفذ يعمل النظام؟ / Port [${DEFAULT_PORT}]: " TFTSP_PORT
TFTSP_PORT="${TFTSP_PORT:-$DEFAULT_PORT}"
[[ "$TFTSP_PORT" =~ ^[0-9]+$ ]] && [ "$TFTSP_PORT" -ge 1 ] && [ "$TFTSP_PORT" -le 65535 ] \
  || die "منفذ غير صالح / Invalid port: $TFTSP_PORT"

# ---- 2b) public host / IP (for browser-reachable document & photo URLs) ----
DETECTED_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || echo localhost)"
read -r -p "العنوان العام للخادم (IP)؟ / Public host/IP [${DETECTED_IP}]: " PUBLIC_HOST
PUBLIC_HOST="${PUBLIC_HOST:-$DETECTED_IP}"

# ---- 3) seed demo data? ----
read -r -p "بذر بيانات تجريبية (Super Admin + قبيلتان)؟ / Seed demo data? [Y/n]: " SEED_ANS
SEED_ANS="${SEED_ANS:-Y}"

say ""
say "الوجهة / Destination : ${BOLD}${DEST_DIR}${NC}"
say "المنفذ / Port        : ${BOLD}${TFTSP_PORT}${NC}"
say "بذر تجريبي / Seed    : ${BOLD}${SEED_ANS}${NC}"
read -r -p "متابعة؟ / Continue? [Y/n]: " GO; GO="${GO:-Y}"
[[ "$GO" =~ ^[Yy]$ ]] || die "أُلغيَ / Aborted."

# ---- copy sources into the install dir (skip if already there) ----
mkdir -p "$DEST_DIR"
if [ "$(cd "$DEST_DIR" && pwd)" != "$SRC_DIR" ]; then
  say "نسخ الملفات إلى ${DEST_DIR} …"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist' \
          --exclude '.angular' --exclude 'build' "$SRC_DIR"/ "$DEST_DIR"/
  else
    (cd "$SRC_DIR" && tar --exclude='.git' --exclude='node_modules' --exclude='dist' \
          --exclude='.angular' --exclude='build' -cf - .) | (cd "$DEST_DIR" && tar -xf -)
  fi
  ok "نُسخت الملفات"
fi
cd "$DEST_DIR"
[ -f docker-compose.yml ] || die "docker-compose.yml غير موجود في $DEST_DIR"

# ---- generate .env (port + fresh secrets) ----
rand() { openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
if [ ! -f .env ]; then cp .env.example .env; ok "أُنشئ .env من .env.example"; fi
set_env() { # key value
  if grep -qE "^${1}=" .env; then
    sed -i.bak -E "s|^${1}=.*|${1}=\"${2}\"|" .env && rm -f .env.bak
  else printf '%s="%s"\n' "$1" "$2" >> .env; fi
}
set_env TFTSP_PORT "$TFTSP_PORT"
set_env PUBLIC_HOST "$PUBLIC_HOST"
set_env JWT_ACCESS_SECRET  "$(rand)"
set_env JWT_REFRESH_SECRET "$(rand)"
ok "ضُبط المنفذ والعنوان العام وأسرار JWT في .env"

# ---- build & start ----
say "بناء وتشغيل الحاويات (قد يستغرق عدة دقائق أول مرة) …"
$COMPOSE up -d --build

# ---- wait for readiness ----
say "بانتظار جاهزية النظام …"
URL="http://localhost:${TFTSP_PORT}"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "${URL}/api/docs" 2>/dev/null || curl -fsS -o /dev/null "${URL}/" 2>/dev/null; then
    ok "النظام يستجيب"; READY=1; break
  fi
  sleep 3
done
[ "${READY:-0}" = 1 ] || warn "لم يستجب بعد — راجع السجلات: ${COMPOSE} logs -f api gateway"

# ---- seed ----
if [[ "$SEED_ANS" =~ ^[Yy]$ ]]; then
  say "بذر البيانات التجريبية …"
  $COMPOSE run --rm seed && ok "تمّ البذر" || warn "فشل البذر — جرّب لاحقًا: ${COMPOSE} run --rm seed"
fi

# ---- done ----
PUBURL="http://${PUBLIC_HOST}:${TFTSP_PORT}"
say ""
say "${GREEN}${BOLD}اكتمل التنصيب / Installation complete${NC}"
say "لوحة القبيلة  / Tribe Admin panel : ${BOLD}${PUBURL}/${NC}"
say "لوحة المنصّة  / Super-Admin panel  : ${BOLD}${PUBURL}/platform/${NC}"
say "توثيق الـ API / API docs (Swagger) : ${BOLD}${PUBURL}/api/docs${NC}"
say ""
say "${YELLOW}افتح المنفذين في الجدار الناري / open these ports in the firewall & cloud security group:${NC}"
say "  ${BOLD}${TFTSP_PORT}${NC} (الواجهة+الـAPI / web+API)   ${BOLD}9000${NC} (الوثائق والصور / documents & photos)"
if [[ "$SEED_ANS" =~ ^[Yy]$ ]]; then
  say ""
  say "دخول تجريبي / Demo login (Super Admin):"
  say "  ${BOLD}superadmin@tftsp.local${NC} / ${BOLD}ChangeMe!2026_seed${NC}"
  say "  ${DIM}(غيّر كلمة المرور فورًا خارج التجربة / change it outside a trial)${NC}"
fi
say ""
say "${DIM}أوامر مفيدة / handy: ${COMPOSE} ps · ${COMPOSE} logs -f api · ${COMPOSE} down${NC}"
