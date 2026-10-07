#!/usr/bin/env bash
# Lanza el deploy de chalan.pe desde la laptop. Lo usan los targets del Makefile:
#   make deploy-peru            plan, confirmación y deploy
#   make deploy-peru-plan       solo el plan (no toca nada)
#   make deploy-peru-rollback   vuelve al deploy anterior
#
# Antes de tocar el servidor:
#   - Despliega origin/master, no tu copia local: avisa si tienes commits sin push.
#   - Corre los tests de los dos APIs en los contenedores locales, si tu copia
#     local es exactamente origin/master (si no, probaría otro código).
#   - Si el plan trae una migración, dispara el backup de la base (workflow
#     db-backup.yml) y espera a que termine bien.
#
# Opciones propias: --yes (no pregunta), --skip-tests, --skip-backup.
# Las demás (--dry-run, --services "...", --all, --rollback) pasan a deploy/peru.sh.
#
# Escrito para el bash 3.2 de macOS: sin arrays asociativos ni ${var,,}.
set -euo pipefail

HOST=${CHALAN_PERU_HOST:-ubuntu@ec2-34-223-226-9.us-west-2.compute.amazonaws.com}
REMOTE_DIR=${CHALAN_PERU_DIR:-/home/ubuntu/chalan}
REMOTE_SCRIPT=/tmp/chalan-deploy.sh
BRANCH=master
LOCAL_COMPOSE=docker-compose.local.yml

YES=0
SKIP_TESTS=0
SKIP_BACKUP=0
DRY_RUN=0
ROLLBACK=0
PASS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    --dry-run) DRY_RUN=1; PASS+=("$1") ;;
    --rollback) ROLLBACK=1; PASS+=("$1") ;;
    --services) PASS+=("$1" "${2:?--services necesita una lista}"); shift ;;
    *) PASS+=("$1") ;;
  esac
  shift
done

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
confirm() {
  [ "$YES" -eq 1 ] && return 0
  printf '%s [y/N] ' "$1"
  read -r answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ]
}

cd "$(git rev-parse --show-toplevel)"

say "Trayendo origin/$BRANCH"
git fetch -q origin "$BRANCH"
TARGET=$(git rev-parse "origin/$BRANCH")
UNPUSHED=$(git rev-list --count "origin/$BRANCH..$BRANCH" 2>/dev/null || echo 0)
if [ "$UNPUSHED" -gt 0 ]; then
  echo "Ojo: $BRANCH local tiene $UNPUSHED commit(s) sin push. No se van a desplegar:"
  git log --oneline "origin/$BRANCH..$BRANCH" | sed 's/^/    /'
fi

# El script del servidor sale de origin/master, igual que el código: así un
# cambio al propio script se usa en el mismo deploy que lo trae.
git cat-file -e "origin/$BRANCH:deploy/peru.sh" 2>/dev/null \
  || die "deploy/peru.sh todavía no está en origin/$BRANCH: hay que mergearlo primero"
git show "origin/$BRANCH:deploy/peru.sh" | ssh "$HOST" "cat > $REMOTE_SCRIPT"

remote() { ssh "$HOST" "REPO_DIR=$REMOTE_DIR bash $REMOTE_SCRIPT $*"; }

quote_args() {
  local out="" a
  for a in "$@"; do out="$out $(printf '%q' "$a")"; done
  echo "$out"
}

if [ "$ROLLBACK" -eq 1 ]; then
  say "Rollback en el servidor"
  remote "--dry-run --rollback"
  confirm "¿Volver a la versión anterior?" || die "cancelado"
  remote "--rollback"
  exit 0
fi

say "Plan (dry-run en el servidor)"
PLAN_OUTPUT=$(remote "--dry-run$(quote_args ${PASS[@]+"${PASS[@]}"})") || { echo "$PLAN_OUTPUT"; die "el plan falló"; }
echo "$PLAN_OUTPUT" | grep -v '^PLAN '
if echo "$PLAN_OUTPUT" | grep -q 'BLOQUEA EL DEPLOY'; then
  die "el servidor no está en condiciones de construir (ver arriba)"
fi
PLAN=$(echo "$PLAN_OUTPUT" | grep '^PLAN ' || true)
[ -n "$PLAN" ] || exit 0   # nada que desplegar, o se cortó en el preflight
SERVICES=$(echo "$PLAN" | sed -n 's/.*services=\([^ ]*\).*/\1/p')
MIGRATE=$(echo "$PLAN" | sed -n 's/.*migrate=\([01]\).*/\1/p')
FROM=$(echo "$PLAN" | sed -n 's/.*from=\([0-9a-f]*\).*/\1/p')
[ -n "$SERVICES" ] || exit 0
[ "$DRY_RUN" -eq 1 ] && exit 0

if [ "$SKIP_TESTS" -eq 0 ]; then
  CHANGED=$(git diff --name-only "$FROM" "$TARGET" 2>/dev/null || echo "app/ backoffice-api/")
  RUN_MAIN=0; RUN_BO=0
  echo "$CHANGED" | grep -qE '^(app|migrations|tests)/|^(chalan|config)\.py$' && RUN_MAIN=1
  echo "$CHANGED" | grep -q '^backoffice-api/' && RUN_BO=1
  if [ "$RUN_MAIN" -eq 1 ] || [ "$RUN_BO" -eq 1 ]; then
    say "Tests"
    if [ "$(git rev-parse HEAD)" != "$TARGET" ] || [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      die "tu copia local no es origin/$BRANCH, así que los tests probarían otro código. Haz checkout de $BRANCH al día, o usa --skip-tests"
    fi
    if [ "$RUN_MAIN" -eq 1 ]; then
      docker-compose -f "$LOCAL_COMPOSE" exec -T flask python -m pytest -q \
        || die "fallan los tests del API principal"
    fi
    if [ "$RUN_BO" -eq 1 ]; then
      docker-compose -f "$LOCAL_COMPOSE" exec -T backoffice-api python -m pytest -q \
        || die "fallan los tests del backoffice-api"
    fi
  fi
fi

if [ "$MIGRATE" = "1" ] && [ "$SKIP_BACKUP" -eq 0 ]; then
  say "Hay migración: backup de la base antes"
  STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  gh workflow run db-backup.yml --ref "$BRANCH"
  RUN_ID=""
  for _ in $(seq 1 20); do
    sleep 3
    RUN_ID=$(gh run list --workflow=db-backup.yml --event=workflow_dispatch --limit 1 \
      --json databaseId,createdAt --jq ".[] | select(.createdAt >= \"$STARTED\") | .databaseId")
    [ -n "$RUN_ID" ] && break
  done
  [ -n "$RUN_ID" ] || die "no encontré la corrida del backup; revisar en GitHub Actions o usar --skip-backup"
  gh run watch "$RUN_ID" --exit-status >/dev/null || die "el backup falló (gh run view $RUN_ID); no se despliega"
  echo "Backup OK (run $RUN_ID)"
fi

confirm "¿Desplegar ${TARGET:0:7} en chalan.pe ($SERVICES)?" || die "cancelado"

say "Deploy"
remote "$(quote_args ${PASS[@]+"${PASS[@]}"})"
