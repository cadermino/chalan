#!/usr/bin/env bash
# Despliega chalan.pe. Corre EN el servidor de Perú; normalmente lo lanza
# `make deploy-peru` desde la laptop (deploy/peru-local.sh), que lo copia y lo
# ejecuta por SSH.
#
# Lo que hace, y por qué en este orden:
#   1. Revisa disco y swap. El host tiene ~924 MB de RAM: sin swap el build de
#      nextjs muere por OOM, y sin disco pip/npm mueren a mitad de instalar con
#      un error que parece de dependencias y no lo es.
#   2. Trae origin/master y mira qué archivos cambiaron, para construir solo los
#      servicios afectados.
#   3. Construye DE A UNO (en paralelo el host no aguanta), nginx al final porque
#      es el más pesado: compila el Vue y el backoffice adentro. Mientras tanto
#      prod sigue sirviendo con las imágenes anteriores.
#   4. Si cambió migrations/versions/, corre `flask db upgrade` ANTES de reiniciar
#      backoffice-api: su db.create_all() crearía las tablas nuevas sin los
#      índices únicos ni los CASCADE.
#   5. Reinicia los servicios, nginx al final, y prueba que cada ruta responda.
#      Si algo falla, vuelve a las imágenes y al commit anteriores. La migración
#      NO se revierte (casi siempre agrega tablas o columnas, que el código viejo
#      ignora).
#   6. Borra las imágenes reemplazadas y la caché de build de más de una semana.
#
# Uso:
#   deploy/peru.sh                 despliega lo que cambió en origin/master
#   deploy/peru.sh --dry-run       solo muestra el plan
#   deploy/peru.sh --services "flask-api nginx"   fuerza esos servicios
#   deploy/peru.sh --all           fuerza todos
#   deploy/peru.sh --rollback      vuelve al deploy anterior (imágenes y commit)
set -Eeuo pipefail

REPO_DIR=${REPO_DIR:-/home/ubuntu/chalan}
BRANCH=${BRANCH:-master}
COMPOSE_FILE=docker-compose-peru.prod.yml
ENV_FILE=.env.prod
MIN_FREE_DISK_GB=${MIN_FREE_DISK_GB:-3}
LOCK_FILE=/tmp/chalan-deploy.lock
STATE_DIR=${STATE_DIR:-$HOME/deploy-logs}
SITE=chalan.pe
# Orden de build y de arranque. nginx siempre último.
ORDER=(flask-api backoffice-api services-web nextjs nginx)
# Ruta -> qué tiene que contestar. 2xx-4xx es "vivo": un 401 del backoffice-api
# sin login prueba que el proceso arrancó; un 502/504 o nada es que no.
HEALTH_PATHS=(
  "/"                                         # nextjs
  "/order/step-one"                           # Vue, servido por nginx
  "/backoffice/"                              # backoffice React, servido por nginx
  "/api/v1/service-types/packing/materials"   # flask-api
  "/backoffice-api/api/service-types"         # backoffice-api (401 esperado)
  "/embalaje/cotizar"                         # services-web
)

DRY_RUN=0
FORCE_ALL=0
FORCED_SERVICES=""
ROLLBACK=0

usage() { sed -n '2,/^set -E/p' "$0" | sed '$d; s/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --all) FORCE_ALL=1 ;;
    --services) FORCED_SERVICES=${2:?--services necesita una lista}; shift ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
# Falta de disco o de swap: corta el deploy, pero en --dry-run solo se avisa para
# que el plan salga completo. peru-local.sh no sigue si ve "BLOQUEA".
block() {
  if [ "$DRY_RUN" -eq 1 ]; then log "BLOQUEA EL DEPLOY: $*"; else die "$*"; fi
}

cd "$REPO_DIR"

if docker info >/dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo docker); fi
compose() { "${DOCKER[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

exec 9>"$LOCK_FILE"
flock -n 9 || die "ya hay un deploy corriendo (lock en $LOCK_FILE)"

mkdir -p "$STATE_DIR"
LAST_DEPLOY="$STATE_DIR/last-deploy"
if [ "$DRY_RUN" -eq 0 ]; then
  LOG_FILE="$STATE_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
  exec > >(tee -a "$LOG_FILE") 2>&1
  log "Log en $LOG_FILE"
fi

# --- imágenes -----------------------------------------------------------------

# Guarda la imagen que está corriendo como chalan-prev/<servicio> para poder volver.
save_previous_image() {
  local svc=$1 cid
  cid=$(compose ps -q "$svc" 2>/dev/null || true)
  if [ -z "$cid" ]; then
    log "  $svc no está corriendo: no hay imagen anterior a la que volver"
    return
  fi
  "${DOCKER[@]}" tag "$("${DOCKER[@]}" inspect -f '{{.Image}}' "$cid")" "chalan-prev/$svc:latest"
  echo "$svc $("${DOCKER[@]}" inspect -f '{{.Config.Image}}' "$cid")" >> "$STATE_DIR/prev-images"
}

# Vuelve a apuntar el nombre de la imagen a la anterior. Con restart=1 además
# recrea el contenedor; sin él solo deshace un build que no llegó a arrancar.
restore_previous_image() {
  local svc=$1 restart=${2:-1} name
  name=$(awk -v s="$svc" '$1 == s { print $2 }' "$STATE_DIR/prev-images" 2>/dev/null | tail -1)
  if [ -z "$name" ] || ! "${DOCKER[@]}" image inspect "chalan-prev/$svc:latest" >/dev/null 2>&1; then
    log "  $svc: no hay imagen anterior guardada, se deja como está"
    return
  fi
  "${DOCKER[@]}" tag "chalan-prev/$svc:latest" "$name"
  if [ "$restart" -eq 1 ]; then
    compose up -d --no-deps --no-build "$svc"
  fi
}

# --- health check -------------------------------------------------------------

check_health() {
  local path code failed=0
  for path in "${HEALTH_PATHS[@]}"; do
    for _ in $(seq 1 12); do
      code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 \
        --resolve "$SITE:443:127.0.0.1" "https://$SITE$path" || true)
      if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 500 ]; then break; fi
      sleep 5
    done
    if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 500 ]; then
      log "  OK   $code $path"
    else
      log "  FALLA $code $path"
      failed=1
    fi
  done
  return $failed
}

# --- rollback manual ----------------------------------------------------------

if [ "$ROLLBACK" -eq 1 ]; then
  [ -f "$LAST_DEPLOY" ] || die "no hay registro de un deploy anterior en $LAST_DEPLOY"
  # shellcheck disable=SC1090
  . "$LAST_DEPLOY"   # define DEPLOY_FROM, DEPLOY_TO y DEPLOY_SERVICES
  log "Volviendo de ${DEPLOY_TO:0:7} a ${DEPLOY_FROM:0:7} (servicios: $DEPLOY_SERVICES)"
  [ "$DRY_RUN" -eq 1 ] && exit 0
  git reset -q --hard "$DEPLOY_FROM"
  for svc in "${ORDER[@]}"; do
    case " $DEPLOY_SERVICES " in *" $svc "*) log "Restaurando $svc"; restore_previous_image "$svc" ;; esac
  done
  check_health || die "después del rollback hay rutas que no responden; revisar a mano (docker ps -a, docker logs)"
  rm -f "$LAST_DEPLOY"
  log "Rollback listo. Ojo: si ese deploy corrió una migración, sigue aplicada."
  exit 0
fi

# --- preflight ----------------------------------------------------------------

log "Preflight"
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "el repo del servidor tiene cambios sin commitear (git status); no se pisan"
fi
for f in "$ENV_FILE" .env.backoffice.prod; do
  [ -f "$f" ] || die "falta $f en $REPO_DIR"
done

avail_kb=$(df -Pk / | awk 'NR == 2 { print $4 }')
avail_gb=$((avail_kb / 1024 / 1024))
log "  Disco libre: ${avail_gb} GB (mínimo ${MIN_FREE_DISK_GB})"
if [ "$avail_gb" -lt "$MIN_FREE_DISK_GB" ]; then
  block "poco disco. Liberar con: sudo docker builder prune -f && sudo docker image prune -f"
fi
free -h | sed 's/^/  /'
SWAP_ON=0
swapon --show --noheadings 2>/dev/null | grep -q . && SWAP_ON=1

# --- plan ---------------------------------------------------------------------

OLD=$(git rev-parse HEAD)
git fetch -q origin "$BRANCH"
NEW=$(git rev-parse "origin/$BRANCH")
git merge-base --is-ancestor "$OLD" "$NEW" \
  || die "el servidor está en un commit que no está en origin/$BRANCH (${OLD:0:7}); resolver a mano"

CHANGED=$(git diff --name-only "$OLD" "$NEW")
SELECTED=" "
add() { case "$SELECTED" in *" $1 "*) ;; *) SELECTED="$SELECTED$1 " ;; esac; }
add_all() { for s in "${ORDER[@]}"; do add "$s"; done; }

# Qué servicio se reconstruye por cada archivo cambiado (ver los COPY de cada
# Dockerfile). Lo que no aparece (docs, e2e, tests, el compose de México) no
# cambia nada en prod.
while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    app/*|migrations/*|chalan.py|config.py|requirements/*|flask-api/*) add flask-api ;;
    backoffice-api/*|Dockerfile.backoffice-api.prod) add backoffice-api ;;
    services-web/*) add services-web ;;
    frontend-react/*|Dockerfile.peru.prod) add nextjs ;;
    frontend/*|backoffice/*|nginx.conf|nginx.chalan-prod-peru.conf|Dockerfile.nginx.peru.prod) add nginx ;;
    docker-compose-peru.prod.yml) add_all ;;
  esac
done <<< "$CHANGED"

MIGRATE=0
grep -q '^migrations/versions/' <<< "$CHANGED" && MIGRATE=1

if [ "$FORCE_ALL" -eq 1 ]; then
  SELECTED=" "; add_all
elif [ -n "$FORCED_SERVICES" ]; then
  SELECTED=" "
  for s in $FORCED_SERVICES; do
    case " ${ORDER[*]} " in *" $s "*) add "$s" ;; *) die "servicio desconocido: $s" ;; esac
  done
fi
# La migración corre con la imagen nueva de flask-api.
[ "$MIGRATE" -eq 1 ] && add flask-api

TO_DEPLOY=()
for s in "${ORDER[@]}"; do
  case "$SELECTED" in *" $s "*) TO_DEPLOY+=("$s") ;; esac
done

log "Plan: ${OLD:0:7} -> ${NEW:0:7}"
if [ "$OLD" != "$NEW" ]; then
  git log --oneline "$OLD..$NEW" | sed 's/^/    /'
fi
log "  Servicios: ${TO_DEPLOY[*]:-(ninguno)}"
log "  Migración: $([ "$MIGRATE" -eq 1 ] && echo sí || echo no)"
# Línea para deploy/peru-local.sh, que decide si hace backup antes.
echo "PLAN migrate=$MIGRATE services=$(IFS=,; echo "${TO_DEPLOY[*]:-}") from=$OLD to=$NEW"

if [ "${#TO_DEPLOY[@]}" -eq 0 ]; then
  log "Nada que desplegar."
  exit 0
fi
case " ${TO_DEPLOY[*]} " in
  *" nextjs "*|*" nginx "*)
    [ "$SWAP_ON" -eq 1 ] || block "no hay swap activo: el build de nextjs/nginx muere por OOM con ~924 MB de RAM (ver /etc/fstab, /swapfile)" ;;
esac

[ "$DRY_RUN" -eq 1 ] && exit 0

# --- deploy -------------------------------------------------------------------

: > "$STATE_DIR/prev-images"
BUILT=()

# Un build o una migración que falla no llegó a reiniciar nada: prod sigue con
# las imágenes viejas. Solo hay que devolver el código y los nombres de imagen,
# para que un `up` posterior no levante a medias lo que se construyó.
abort_before_restart() {
  log "Abortando: $1"
  for svc in "${BUILT[@]}"; do restore_previous_image "$svc" 0; done
  git reset -q --hard "$OLD"
  die "$1. No se reinició ningún servicio; prod sigue en ${OLD:0:7}."
}

git merge -q --ff-only "$NEW"

log "Guardando las imágenes actuales"
for svc in "${TO_DEPLOY[@]}"; do save_previous_image "$svc"; done

for svc in "${TO_DEPLOY[@]}"; do
  log "Build $svc"
  compose build "$svc" || abort_before_restart "falló el build de $svc"
  BUILT+=("$svc")
  log "  Disco libre: $(( $(df -Pk / | awk 'NR == 2 { print $4 }') / 1024 / 1024 )) GB"
done

if [ "$MIGRATE" -eq 1 ]; then
  log "Migración (flask db upgrade)"
  compose run --rm -T -e FLASK_APP=chalan.py flask-api flask db upgrade </dev/null \
    || abort_before_restart "falló la migración (Postgres la revierte entera: es transaccional)"
fi

for svc in "${TO_DEPLOY[@]}"; do
  log "Reiniciando $svc"
  compose up -d --no-deps --no-build "$svc"
done

cat > "$LAST_DEPLOY" <<EOF
DEPLOY_FROM=$OLD
DEPLOY_TO=$NEW
DEPLOY_SERVICES="${TO_DEPLOY[*]}"
EOF

log "Health check"
if ! check_health; then
  log "Hay rutas que no responden: volviendo a la versión anterior"
  git reset -q --hard "$OLD"
  for svc in "${TO_DEPLOY[@]}"; do log "Restaurando $svc"; restore_previous_image "$svc"; done
  rm -f "$LAST_DEPLOY"
  if check_health; then
    die "deploy revertido; prod volvió a ${OLD:0:7}. Ver por qué falló: sudo docker compose -f $COMPOSE_FILE logs --tail 100 <servicio>"
  fi
  die "deploy revertido pero siguen fallando rutas; revisar a mano (docker ps -a, docker logs)"
fi

# Borra solo las imágenes sin nombre (las viejas que reemplazó este build). Las
# chalan-prev/* se quedan para --rollback hasta el próximo deploy.
"${DOCKER[@]}" image prune -f >/dev/null
# La caché de build no la borra lo anterior y en este disco de 16 GB llegó a
# 4 GB y bloqueó un deploy. Se queda la de la última semana, que es la que
# acelera el próximo build.
"${DOCKER[@]}" builder prune -f --filter until=168h >/dev/null
log "Deploy listo: ${NEW:0:7} (${TO_DEPLOY[*]}). Para volver atrás: make deploy-peru-rollback"
