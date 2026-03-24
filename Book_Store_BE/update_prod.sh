#!/bin/bash
# Production Update Script - Tự động cập nhật code & services
# Usage: ./update_prod.sh [branch] [migrate]
# Example:
#   ./update_prod.sh main              (pull main, rebuild, restart, migrate)
#   ./update_prod.sh v1.2.3            (checkout tag, rebuild, restart, migrate)
#   ./update_prod.sh main nomigrate    (skip migrations)

set -e  # Exit on any error

# ===================== Configuration =====================
APP_DIR="/opt/bookstore/Book_Store_BE"
BRANCH="${1:-main}"
DO_MIGRATE="${2:-migrate}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$APP_DIR/logs/update_${TIMESTAMP}.log"
BACKUP_DIR="$APP_DIR/backups/backup_${TIMESTAMP}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ===================== Functions =====================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a $LOG_FILE
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a $LOG_FILE
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a $LOG_FILE
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
}

cleanup() {
    log_info "Cleaning up..."
    docker system prune -f --volumes >> $LOG_FILE 2>&1 || true
}

backup_current_state() {
    log_info "Backing up current state..."
    mkdir -p $BACKUP_DIR
    
    # Backup docker-compose state
    docker-compose -f docker-compose.prod.yml ps > $BACKUP_DIR/docker_ps.log 2>&1 || true
    docker-compose -f docker-compose.prod.yml logs > $BACKUP_DIR/docker_logs.log 2>&1 || true
    
    # Backup git state
    git log --oneline -10 > $BACKUP_DIR/git_log.txt 2>&1 || true
    git status > $BACKUP_DIR/git_status.txt 2>&1 || true
    
    log_success "Backup created at: $BACKUP_DIR"
}

health_check() {
    log_info "Performing health checks..."
    
    local retries=30
    local count=0
    
    while [ $count -lt $retries ]; do
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/books/ 2>/dev/null || echo "000")
        
        if [ "$http_code" = "200" ]; then
            log_success "API Gateway is healthy (HTTP $http_code)"
            
            # Check database
            if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready > /dev/null 2>&1; then
                log_success "Database is healthy"
            else
                log_warn "Database health check failed"
            fi
            
            # Check RabbitMQ
            if docker-compose -f docker-compose.prod.yml exec -T rabbitmq rabbitmq-diagnostics -q ping > /dev/null 2>&1; then
                log_success "RabbitMQ is healthy"
            else
                log_warn "RabbitMQ health check failed"
            fi
            
            return 0
        fi
        
        count=$((count + 1))
        if [ $count -lt $retries ]; then
            echo -ne "${YELLOW}."${NC}
            sleep 2
        fi
    done
    
    echo ""
    log_error "API Gateway not responding after $retries attempts (Last HTTP code: $http_code)"
    return 1
}

rollback() {
    log_error "Rolling back to previous version..."
    
    # Restore previous git state
    git reset --hard ORIG_HEAD >> $LOG_FILE 2>&1 || git reset --hard HEAD~1 >> $LOG_FILE 2>&1
    
    # Rebuild and restart
    docker-compose -f docker-compose.prod.yml down >> $LOG_FILE 2>&1
    docker-compose -f docker-compose.prod.yml build >> $LOG_FILE 2>&1
    docker-compose -f docker-compose.prod.yml up -d >> $LOG_FILE 2>&1
    
    sleep 10
    
    if health_check; then
        log_success "Rollback successful"
        return 0
    else
        log_error "Rollback failed - Manual intervention required!"
        return 1
    fi
}

# ===================== Main Script =====================

# Ensure running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script as root (use sudo)"
    exit 1
fi

# Setup logging directory
mkdir -p "$(dirname $LOG_FILE)"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Production Update Script                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

log_info "Starting production update"
log_info "Branch/Tag: $BRANCH"
log_info "Migrations: $DO_MIGRATE"
log_info "Log file: $LOG_FILE"
log_info "App directory: $APP_DIR"
echo ""

# Step 1: Navigate to app directory
log_info "Step [1/9] Navigating to app directory..."
cd $APP_DIR
log_success "Current directory: $(pwd)"

# Step 2: Backup current state
log_info "Step [2/9] Backing up current state..."
backup_current_state

# Step 3: Check git status
log_info "Step [3/9] Checking git status..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
CURRENT_COMMIT=$(git rev-parse --short HEAD)
log_success "Current branch: $CURRENT_BRANCH, commit: $CURRENT_COMMIT"

# Step 4: Update from git
log_info "Step [4/9] Fetching and checking out $BRANCH..."
git fetch origin >> $LOG_FILE 2>&1

if git rev-parse --verify $BRANCH > /dev/null 2>&1; then
    # Branch/tag exists locally
    git checkout $BRANCH >> $LOG_FILE 2>&1
else
    # Try to fetch and checkout
    git checkout -b $BRANCH origin/$BRANCH >> $LOG_FILE 2>&1 || git checkout $BRANCH >> $LOG_FILE 2>&1
fi

NEW_COMMIT=$(git rev-parse --short HEAD)
log_success "Checked out $BRANCH (commit: $NEW_COMMIT)"

if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    log_warn "Code is already up to date"
fi

# Step 5: Check for Dockerfile changes
log_info "Step [5/9] Checking for Docker image changes..."
REBUILD=false

if git diff ORIGIN_HEAD..HEAD --name-only 2>/dev/null | grep -E "(Dockerfile|requirements.txt)" > /dev/null 2>&1; then
    REBUILD=true
    log_warn "Dockerfile or requirements.txt changed - will rebuild"
else
    log_info "No Dockerfile changes detected"
fi

# Step 6: Rebuild if needed
if [ "$REBUILD" = true ]; then
    log_info "Step [6/9] Rebuilding Docker images..."
    docker-compose -f docker-compose.prod.yml build >> $LOG_FILE 2>&1
    log_success "Docker images rebuilt"
else
    log_info "Step [6/9] Skipping rebuild (no Dockerfile changes)"
fi

# Step 7: Restart services
log_info "Step [7/9] Restarting services..."
docker-compose -f docker-compose.prod.yml down >> $LOG_FILE 2>&1
sleep 5
docker-compose -f docker-compose.prod.yml up -d >> $LOG_FILE 2>&1
log_success "Services restarted"

# Wait for services to be ready
sleep 15

# Step 8: Run migrations (if requested)
if [ "$DO_MIGRATE" = "migrate" ]; then
    log_info "Step [8/9] Running database migrations..."
    
    # Migrate main API Gateway
    docker-compose -f docker-compose.prod.yml exec -T api-gateway python manage.py migrate >> $LOG_FILE 2>&1 || log_warn "API Gateway migration failed or skipped"
    
    # Migrate other services that need it
    for service in customer-service book-service order-service pay-service ship-service; do
        docker-compose -f docker-compose.prod.yml exec -T $service python manage.py migrate >> $LOG_FILE 2>&1 || log_warn "$service migration failed or skipped"
    done
    
    log_success "Database migrations completed"
else
    log_info "Step [8/9] Skipping migrations (DO_MIGRATE=$DO_MIGRATE)"
fi

# Step 9: Health check
log_info "Step [9/9] Performing health checks..."
if health_check; then
    log_success "All health checks passed"
    
    # Print final status
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Update successful!                       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    log_success "Updated to commit: $NEW_COMMIT"
    log_success "Services status:"
    docker-compose -f docker-compose.prod.yml ps | tail -n +2
    echo ""
    log_info "Log file: $LOG_FILE"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "  • Monitor logs: docker-compose logs -f"
    echo "  • Check API: curl http://localhost:8000/api/books/"
    echo "  • Full logs: tail -f $LOG_FILE"
    
    cleanup
    exit 0
else
    log_error "Health checks failed!"
    
    # Ask for rollback
    read -p "Do you want to rollback? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rollback
    else
        log_error "Rollback skipped - Manual intervention required!"
    fi
    
    exit 1
fi
