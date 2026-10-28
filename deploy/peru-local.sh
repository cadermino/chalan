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
#     db-backup.yml) y espera a que termine bien. Si el deploy falla o se cancela
#     y lo repites, reutiliza ese backup (mismo commit destino, mismo punto de
#     partida del servidor, menos de BACKUP_MAX_AGE_H horas) en vez de hacer otro.
#   - Si el plan trae nextjs, construye su imagen acá (linux/amd64, desde una copia
#     limpia de origin/master) y la sube por SSH: en el servidor, con 924 MB de RAM,
#     el build de Next se quedaba trabado en el swap. Necesita Docker corriendo.
#
# Opciones propias: --yes (no pregunta), --skip-tests, --skip-backup,
# --new-backup (fuerza un backup nuevo aunque haya uno reutilizable),
# --build-on-server (construye nextjs en el servidor, como antes).
# Las demás (--dry-run, --services "...", --all, --rollback) pasan a deploy/peru.sh.
#
# Escrito para el bash 3.2 de macOS: sin arrays asociativos ni ${var,,}.
set -euo pipefail

HOST=${CHALAN_PERU_HOST:-ubuntu@ec2-34-223-226-9.us-west-2.compute.amazonaws.com}
REMOTE_DIR=${CHALAN_PERU_DIR:-/home/ubuntu/chalan}
REMOTE_SCRIPT=/tmp/chalan-deploy.sh
BRANCH=master
LOCAL_COMPOSE=docker-compose.local.yml
BACKUP_MARKER=.cache/deploy-backup   # ignorado por git (.cache/)
BACKUP_MAX_AGE_H=${CHALAN_BACKUP_MAX_AGE_H:-12}

YES=0
SKIP_TESTS=0
SKIP_BACKUP=0
NEW_BACKUP=0
BUILD_ON_SERVER=0
DRY_RUN=0
ROLLBACK=0
PASS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    --new-backup) NEW_BACKUP=1 ;;
    --build-on-server) BUILD_ON_SERVER=1 ;;
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

# Construye la imagen de nextjs para el commit que se despliega y la deja en el
# servidor como chalan-prebuilt/nextjs:<commit>, que es lo que busca peru.sh.
# Las NEXT_PUBLIC_* quedan dentro del bundle: se leen del .env.prod del servidor
# para no tener otra copia que se desactualice. No se imprimen.
build_nextjs_here() {
  local image="chalan-prebuilt/nextjs:${TARGET:0:12}" wt line key val
  local args=()
  docker info >/dev/null 2>&1 || die "Docker no está corriendo en esta laptop (o usa --build-on-server)"
  say "Build de nextjs en esta laptop (linux/amd64)"
  while IFS= read -r line; do
    key=${line%%=*}; val=${line#*=}
    val=${val%\"}; val=${val#\"}; val=${val%\'}; val=${val#\'}
    args+=(--build-arg "$key=$val")
  done < <(ssh "$HOST" "grep -E '^NEXT_PUBLIC_(PLACES_API_KEY|CHAT_TENANT_ID|CHAT_API_URL)=' $REMOTE_DIR/.env.prod" || true)
  # El mismo valor por defecto que el compose de Perú.
  case " ${args[*]-} " in *NEXT_PUBLIC_CHAT_API_URL=*) ;; *)
    args+=(--build-arg NEXT_PUBLIC_CHAT_API_URL=https://api.automajob.com/chat/message) ;;
  esac
  wt=$(mktemp -d /tmp/chalan-build.XXXXXX)
  git worktree add -q --detach "$wt" "$TARGET"
  if ! docker buildx build --platform linux/amd64 -f "$wt/Dockerfile.peru.prod" \
      "${args[@]}" -t "$image" --load "$wt"; then
    git worktree remove --force "$wt"
    die "falló el build de nextjs"
  fi
  git worktree remove --force "$wt"
  say "Subiendo la imagen al servidor"
  docker save "$image" | gzip -1 | ssh "$HOST" "gunzip | sudo docker load" \
    || die "no se pudo subir la imagen de nextjs"
  docker image rm "$image" >/dev/null
}

if [ "$ROLLBACK" -eq 1 ]; then
  say "Rollback en el servidor"
  remote "--dry-run --rollback"
  confirm "¿Volver a la versión anterior?" || die "cancelado"
  remote "--rollback"
  exit 0
fi

# El servidor no construye nextjs si viene en el plan: lo hace esta laptop.
[ "$BUILD_ON_SERVER" -eq 0 ] && PASS+=(--prebuilt nextjs)

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
  RUN_MAIN=0; RUN_BO=0; RUN_NEXT=0
  echo "$CHANGED" | grep -qE '^(app|migrations|tests)/|^(chalan|config)\.py$' && RUN_MAIN=1
  echo "$CHANGED" | grep -q '^backoffice-api/' && RUN_BO=1
  echo "$CHANGED" | grep -q '^frontend-react/' && RUN_NEXT=1
  if [ "$RUN_MAIN" -eq 1 ] || [ "$RUN_BO" -eq 1 ] || [ "$RUN_NEXT" -eq 1 ]; then
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
    # El build de Next en el servidor ya no revisa tipos (tardaba 26 minutos).
    if [ "$RUN_NEXT" -eq 1 ]; then
      [ -d frontend-react/node_modules ] || die "falta frontend-react/node_modules para revisar los tipos de Next: cd frontend-react && npm ci"
      (cd frontend-react && npx --no-install tsc --noEmit) || die "fallan los tipos de Next (cd frontend-react && npx tsc --noEmit)"
    fi
  fi
fi

if [ "$MIGRATE" = "1" ] && [ "$SKIP_BACKUP" -eq 0 ]; then
  # Un deploy que falla o se cancela y se repite no vuelve a hacer backup: el de
  # antes sigue siendo el punto de restauración previo a esta migración. Vale si
  # el destino y el punto de partida del servidor son los mismos y es reciente.
  REUSE=""
  if [ "$NEW_BACKUP" -eq 0 ] && [ -f "$BACKUP_MARKER" ]; then
    read -r M_TARGET M_FROM M_RUN M_TIME < "$BACKUP_MARKER" || true
    AGE_H=$(( ( $(date +%s) - ${M_TIME:-0} ) / 3600 ))
    if [ "${M_TARGET:-}" = "$TARGET" ] && [ "${M_FROM:-}" = "$FROM" ] && [ "$AGE_H" -lt "$BACKUP_MAX_AGE_H" ]; then
      REUSE=$M_RUN
    fi
  fi
  if [ -n "$REUSE" ]; then
    say "Hay migración: se reutiliza el backup del intento anterior (run $REUSE, hace $(( ( $(date +%s) - M_TIME ) / 60 )) min). Para uno nuevo: --new-backup"
  else
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
    mkdir -p "$(dirname "$BACKUP_MARKER")"
    echo "$TARGET $FROM $RUN_ID $(date +%s)" > "$BACKUP_MARKER"
  fi
fi

confirm "¿Desplegar ${TARGET:0:7} en chalan.pe ($SERVICES)?" || die "cancelado"

case ",$SERVICES," in
  *,nextjs,*) [ "$BUILD_ON_SERVER" -eq 0 ] && build_nextjs_here ;;
esac

say "Deploy"
remote "$(quote_args ${PASS[@]+"${PASS[@]}"})"
