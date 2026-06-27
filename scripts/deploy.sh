#!/bin/bash
# ════════════════════════════════════════════════════════════════
# CAMRAIL — Script de Déploiement Intranet
# Usage : ./scripts/deploy.sh [prod|dev|update|rollback|status]
# Prérequis : Docker 24+, Docker Compose v2, Ubuntu 22.04
# ════════════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="/opt/camrail"
COMPOSE="docker compose"
LOG_FILE="/var/log/camrail_deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Couleurs terminal ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${GREEN}[✅ $TIMESTAMP]${NC} $1" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[⚠️  $TIMESTAMP]${NC} $1" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[❌ $TIMESTAMP]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
section() { echo -e "\n${BLUE}${BOLD}══ $1 ══${NC}\n"; }

# ── Vérification des prérequis ────────────────────────────────────
check_requirements() {
    section "Vérification des prérequis"
    command -v docker  >/dev/null 2>&1 || error "Docker non installé"
    command -v openssl >/dev/null 2>&1 || error "OpenSSL non installé"
    [ -f "$APP_DIR/.env" ]            || error "Fichier .env manquant — copiez .env.example"
    log "Prérequis OK"
}

# ── Génération certificat SSL auto-signé (intranet) ───────────────
generate_ssl() {
    section "Certificats SSL"
    mkdir -p "$APP_DIR/nginx/ssl"
    if [ ! -f "$APP_DIR/nginx/ssl/camrail.crt" ]; then
        warn "Génération d'un certificat auto-signé pour l'intranet..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
            -keyout "$APP_DIR/nginx/ssl/camrail.key" \
            -out    "$APP_DIR/nginx/ssl/camrail.crt" \
            -subj "/C=CM/ST=Littoral/L=Douala/O=CAMRAIL/OU=IT/CN=camrail-predict.intranet.cm" \
            -addext "subjectAltName=DNS:camrail-predict.intranet.cm,IP:127.0.0.1" 2>/dev/null
        chmod 600 "$APP_DIR/nginx/ssl/camrail.key"
        log "Certificat SSL généré (valide 10 ans)"
    else
        log "Certificat SSL existant conservé"
    fi
}

# ── Sauvegarde des données avant mise à jour ──────────────────────
backup_data() {
    section "Sauvegarde des données"
    BACKUP_DIR="/opt/camrail_backups/$(date '+%Y%m%d_%H%M%S')"
    mkdir -p "$BACKUP_DIR"

    # Sauvegarder les volumes Docker
    docker run --rm \
        -v camrail_data:/source \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf /backup/camrail_data.tar.gz -C /source . 2>/dev/null || true

    docker run --rm \
        -v camrail_models:/source \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf /backup/camrail_models.tar.gz -C /source . 2>/dev/null || true

    docker run --rm \
        -v camrail_auth:/source \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf /backup/camrail_auth.tar.gz -C /source . 2>/dev/null || true

    log "Sauvegarde créée : $BACKUP_DIR"
}

# ── Déploiement complet ───────────────────────────────────────────
deploy_prod() {
    section "Déploiement Production CAMRAIL"
    check_requirements
    generate_ssl

    cd "$APP_DIR"
    source .env

    log "Build des images Docker..."
    $COMPOSE build --no-cache

    log "Arrêt des services existants..."
    $COMPOSE down --remove-orphans 2>/dev/null || true

    log "Démarrage des services..."
    $COMPOSE up -d

    log "Attente de la disponibilité de l'API (max 60s)..."
    for i in $(seq 1 12); do
        if curl -sf http://localhost:8000/ >/dev/null 2>&1; then
            log "API disponible !"
            break
        fi
        [ $i -eq 12 ] && error "API non disponible après 60s"
        sleep 5
    done

    section "Déploiement terminé"
    echo -e "${GREEN}${BOLD}"
    echo "  🚂 CAMRAIL Predictive API — DÉPLOYÉE"
    echo "  🌐 URL Intranet : https://camrail-predict.intranet.cm"
    echo "  📖 API Docs    : https://camrail-predict.intranet.cm/api/docs"
    echo -e "${NC}"
    show_status
}

# ── Déploiement développement ─────────────────────────────────────
deploy_dev() {
    section "Démarrage en mode Développement"
    cd "$APP_DIR"
    $COMPOSE up camrail-api --build
}

# ── Mise à jour sans interruption (rolling update) ────────────────
update() {
    section "Mise à jour des services"
    check_requirements
    backup_data
    cd "$APP_DIR"

    log "Pull des dernières images..."
    git pull origin main 2>/dev/null || warn "Git pull ignoré (pas de repo configuré)"

    log "Rebuild et redémarrage de l'API..."
    $COMPOSE build camrail-api
    $COMPOSE up -d --no-deps camrail-api

    log "Rebuild et redémarrage du Frontend..."
    $COMPOSE build camrail-frontend
    $COMPOSE up -d --no-deps camrail-frontend

    $COMPOSE exec camrail-nginx nginx -s reload 2>/dev/null || true
    log "Mise à jour terminée sans interruption de service"
}

# ── Rollback vers la sauvegarde précédente ────────────────────────
rollback() {
    section "Rollback"
    LATEST_BACKUP=$(ls -td /opt/camrail_backups/*/ 2>/dev/null | head -1)
    [ -z "$LATEST_BACKUP" ] && error "Aucune sauvegarde trouvée"
    warn "Rollback vers : $LATEST_BACKUP"
    read -p "Confirmer ? (oui/non) : " confirm
    [ "$confirm" != "oui" ] && { log "Rollback annulé"; exit 0; }

    cd "$APP_DIR"
    $COMPOSE down

    docker run --rm -v camrail_data:/target   -v "$LATEST_BACKUP":/backup alpine tar xzf /backup/camrail_data.tar.gz   -C /target
    docker run --rm -v camrail_models:/target -v "$LATEST_BACKUP":/backup alpine tar xzf /backup/camrail_models.tar.gz -C /target
    docker run --rm -v camrail_auth:/target   -v "$LATEST_BACKUP":/backup alpine tar xzf /backup/camrail_auth.tar.gz   -C /target

    $COMPOSE up -d
    log "Rollback effectué depuis $LATEST_BACKUP"
}

# ── Statut des services ───────────────────────────────────────────
show_status() {
    section "Statut des services"
    cd "$APP_DIR"
    $COMPOSE ps
    echo ""
    echo -e "${BOLD}Logs récents API :${NC}"
    $COMPOSE logs --tail=10 camrail-api 2>/dev/null || true
}

# ── Arrêt complet ─────────────────────────────────────────────────
stop_all() {
    section "Arrêt de tous les services"
    cd "$APP_DIR"
    $COMPOSE down
    log "Services arrêtés"
}

# ── Point d'entrée ────────────────────────────────────────────────
case "${1:-help}" in
    prod)     deploy_prod ;;
    dev)      deploy_dev ;;
    update)   update ;;
    rollback) rollback ;;
    status)   show_status ;;
    stop)     stop_all ;;
    backup)   backup_data ;;
    ssl)      generate_ssl ;;
    *)
        echo -e "${BOLD}CAMRAIL Deploy Script${NC}"
        echo ""
        echo "Usage : ./scripts/deploy.sh <commande>"
        echo ""
        echo "Commandes :"
        echo "  prod      Déploiement complet production"
        echo "  dev       Mode développement local"
        echo "  update    Mise à jour sans interruption"
        echo "  rollback  Retour à la version précédente"
        echo "  status    Statut des conteneurs"
        echo "  stop      Arrêt de tous les services"
        echo "  backup    Sauvegarde des données uniquement"
        echo "  ssl       (Re)générer le certificat SSL"
        ;;
esac
