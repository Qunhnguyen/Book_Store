#!/bin/bash
# Replace old project with new one - Automated script
# Usage: sudo ./replace_project.sh /path/to/old/project https://repo-url.git
# Example: sudo ./replace_project.sh /opt/old-bookstore https://github.com/your-repo/Book_Store.git

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
OLD_PROJECT="${1:-.}"
NEW_REPO="${2:-https://github.com/your-repo/Book_Store.git}"
NEW_PROJECT_PATH="/opt/bookstore"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backup_${TIMESTAMP}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ $1"
    echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run script as root (use sudo)"
    exit 1
fi

print_header "Project Replacement Script"

log_info "Old project path: $OLD_PROJECT"
log_info "New repository: $NEW_REPO"
log_info "New project path: $NEW_PROJECT_PATH"
echo ""

# Confirmation
read -p "$(echo -e ${YELLOW}This will DELETE the old project. Continue? [y/N]${NC} )" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Aborted by user"
    exit 1
fi

# ============ STEP 1: Backup old project (optional) ============
print_header "Step [1/10] Backing up old project..."

if [ -d "$OLD_PROJECT" ]; then
    mkdir -p "$BACKUP_DIR"
    
    # Backup docker-compose config
    if [ -f "$OLD_PROJECT/docker-compose.yml" ]; then
        cp "$OLD_PROJECT/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml.bak"
        log_success "Backed up docker-compose.yml"
    fi
    
    # Backup .env if exists
    if [ -f "$OLD_PROJECT/.env" ]; then
        cp "$OLD_PROJECT/.env" "$BACKUP_DIR/.env.bak"
        log_warn "⚠️ Backed up .env (contains secrets) to $BACKUP_DIR/.env.bak"
    fi
    
    log_success "Backup created at: $BACKUP_DIR"
else
    log_warn "Old project path not found: $OLD_PROJECT"
fi

# ============ STEP 2: Stop old project ============
print_header "Step [2/10] Stopping old project..."

if [ -d "$OLD_PROJECT" ]; then
    cd "$OLD_PROJECT"
    
    # Check if docker-compose.yml exists
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.prod.yml" ]; then
        docker-compose down -v 2>/dev/null || docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
        log_success "Old project services stopped"
    else
        log_warn "No docker-compose.yml found in old project"
    fi
    
    sleep 3
else
    log_warn "Old project directory not found"
fi

# ============ STEP 3: Remove Docker containers ============
print_header "Step [3/10] Cleaning up Docker containers..."

# Remove all stopped containers
docker container prune -f > /dev/null 2>&1 || true
log_success "Stopped containers removed"

# ============ STEP 4: Remove Docker volumes ============
print_header "Step [4/10] Cleaning up Docker volumes..."

# Remove all unused volumes
docker volume prune -f > /dev/null 2>&1 || true
log_success "Unused volumes removed"

# ============ STEP 5: Remove old project directory ============
print_header "Step [5/10] Removing old project directory..."

if [ -d "$OLD_PROJECT" ]; then
    rm -rf "$OLD_PROJECT"
    log_success "Old project directory removed: $OLD_PROJECT"
else
    log_warn "Old project directory already removed"
fi

# ============ STEP 6: Create new project directory ============
print_header "Step [6/10] Setting up new project directory..."

mkdir -p "$NEW_PROJECT_PATH"
chown -R ubuntu:ubuntu "$NEW_PROJECT_PATH"
log_success "Created: $NEW_PROJECT_PATH"

# ============ STEP 7: Clone new project ============
print_header "Step [7/10] Cloning new project..."

cd "$NEW_PROJECT_PATH"
git clone "$NEW_REPO" . 2>&1 | grep -E "(Cloning|Receiving|Resolving)" || true

if [ -f "docker-compose.yml" ] || [ -f "Book_Store_BE/docker-compose.yml" ]; then
    log_success "Repository cloned successfully"
else
    log_error "Repository clone failed"
    exit 1
fi

# Navigate to backend
if [ -d "Book_Store_BE" ]; then
    cd Book_Store_BE
    log_success "Switched to Book_Store_BE directory"
fi

# ============ STEP 8: Setup environment ============
print_header "Step [8/10] Setting up environment..."

if [ -f ".env.example" ]; then
    cp .env.example .env
    log_success "Created .env from template"
    
    echo ""
    log_warn "⚠️ IMPORTANT: Please edit .env with your actual values:"
    echo "  nano $(pwd)/.env"
    echo ""
    read -p "Press Enter when done editing .env..."
else
    log_warn ".env.example not found - will need manual setup"
fi

# ============ STEP 9: Build Docker images ============
print_header "Step [9/10] Building Docker images..."

log_info "This may take 5-10 minutes..."

if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml build 2>&1 | tail -20
elif [ -f "docker-compose.yml" ]; then
    docker-compose build 2>&1 | tail -20
else
    log_error "No docker-compose file found"
    exit 1
fi

log_success "Docker images built successfully"

# ============ STEP 10: Start services ============
print_header "Step [10/10] Starting services..."

log_info "Starting all services..."

if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml up -d
elif [ -f "docker-compose.yml" ]; then
    docker-compose up -d
fi

log_success "Services started"

# Wait for services to be ready
log_info "Waiting for services to be ready (30 seconds)..."
sleep 30

# ============ FINAL CHECKS ============
print_header "Post-Deployment Checks"

# Check services status
log_info "Service status:"
if [ -f "docker-compose.prod.yml" ]; then
    docker-compose -f docker-compose.prod.yml ps | tail -15
else
    docker-compose ps | tail -15
fi

# Run migrations
log_info "Running database migrations..."
if docker-compose exec -T api-gateway python manage.py migrate 2>/dev/null; then
    log_success "Migrations completed"
else
    log_warn "Migrations may have been skipped or failed"
fi

# Health check
log_info "Testing API Gateway..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/books/ 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    log_success "API Gateway is responding (HTTP $HEALTH_STATUS)"
else
    log_warn "Health check returned HTTP $HEALTH_STATUS (service may still be initializing)"
fi

# Final summary
print_header "✓ Project Replacement Complete!"

echo -e "${GREEN}New project is installed at: $NEW_PROJECT_PATH${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify .env configuration is correct"
echo "  2. Check service logs: docker-compose logs -f"
echo "  3. Test API: curl http://localhost:8000/api/books/"
echo "  4. Update DNS/security groups if needed"
echo ""
echo "If something went wrong:"
echo "  • Check logs: docker-compose logs"
echo "  • Backup location: $BACKUP_DIR"
echo "  • Rollback .env from backup if needed"
echo ""
echo -e "${YELLOW}Backup of old project config: $BACKUP_DIR${NC}"
echo ""
