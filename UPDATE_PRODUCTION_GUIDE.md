# Hướng dẫn Cập nhật Code lên Production

## 🔄 Quy trình Update Code (Manual)

### Prerequisites
- ✅ Services đang chạy trên AWS EC2
- ✅ Code đã push lên GitHub/GitLab
- ✅ SSH key sẵn sàng
- ✅ Có quyền access EC2 instance

---

## 📋 Các bước cập nhật code

### **Bước 1: Chuẩn bị & Thông báo**

```bash
# (Local) Kiểm tra code ready
git status
git log --oneline -5

# Ensure all changes are committed
git add .
git commit -m "Description of changes"
git push origin main
```

**Thông báo team:** "Sẽ update production lúc [time], có downtime ~1-2 phút"

---

### **Bước 2: SSH vào EC2 Server**

```bash
# Local machine
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Verify bạn đã SSH vào server
echo "Now on: $(hostname)"
```

---

### **Bước 3: Kiểm tra trạng thái hiện tại**

```bash
# Vào thư mục project
cd /opt/bookstore/Book_Store_BE  # hoặc thư mục của bạn

# Check current branch & commit
git status
git log --oneline -5

# View running services
docker-compose ps

# Check logs trước update
docker-compose logs --tail=50 api-gateway
```

---

### **Bước 4: Pull code mới nhất**

```bash
# Lựa chọn A: Update từ main branch
git pull origin main

# Hoặc Lựa chọn B: Update từ tag cụ thể (recommended cho production)
git fetch origin
git checkout v1.2.3  # Thay bằng version thực tế

# Xác nhận code đã update
git log --oneline -3
```

---

### **Bước 5: Rebuild Docker Images** (nếu code thay đổi)

```bash
# **Option A: Rebuild all services** (nếu nhiều thay đổi)
docker-compose -f docker-compose.prod.yml build

# **Option B: Rebuild specific services** (nếu chỉ 1-2 services bị change)
docker-compose -f docker-compose.prod.yml build api-gateway
docker-compose -f docker-compose.prod.yml build book-service

# **Option C: Skip rebuild** (nếu chỉ config/data thay đổi)
# Continue to step 6
```

**Thời gian rebuild:**
- Toàn bộ project: 3-5 phút
- 1-2 services: 1-2 phút
- Không rebuild: 0 phút

---

### **Bước 6: Update Services (Restart)**

#### **Cách A: Rolling update** (Recommended - ít downtime)

```bash
# Update từng service một để ít downtime
docker-compose -f docker-compose.prod.yml up -d api-gateway
sleep 30  # Đợi service start

docker-compose -f docker-compose.prod.yml up -d customer-service
sleep 30

docker-compose -f docker-compose.prod.yml up -d book-service
sleep 30

# ... tiếp tục với các services khác

# Cuối cùng update Nginx
docker-compose -f docker-compose.prod.yml up -d nginx
```

#### **Cách B: All at once** (Nhanh nhưng downtime ~2 phút)

```bash
# Restart toàn bộ services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

### **Bước 7: Chạy Database Migrations** (nếu có thay đổi schema)

```bash
# Kiểm tra có migration nào chưa chạy
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py showmigrations

# Chạy migrations
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py migrate

# Chạy cho các service khác nếu cần
docker-compose -f docker-compose.prod.yml exec customer-service python manage.py migrate
docker-compose -f docker-compose.prod.yml exec book-service python manage.py migrate
# ... etc
```

---

### **Bước 8: Xác thực services đã chạy**

```bash
# Kiểm tra tất cả services Up
docker-compose -f docker-compose.prod.yml ps

# Expected output:
# STATUS: "Up X seconds"

# Kiểm tra lỗi
docker-compose -f docker-compose.prod.yml ps | grep -i error

# View logs mới nhất (kiểm tra có error không)
docker-compose -f docker-compose.prod.yml logs --tail=100 api-gateway
```

---

### **Bước 9: Health Check**

```bash
# Test API Gateway
curl http://localhost:8000/api/books/
# Expected: Status 200

# Hoặc từ external
curl http://<EC2_PUBLIC_IP>:8000/api/books/

# Test database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT 1"

# Test RabbitMQ
docker-compose -f docker-compose.prod.yml exec rabbitmq rabbitmq-diagnostics -q ping

# View full logs
docker-compose -f docker-compose.prod.yml logs -f --tail=50
```

---

### **Bước 10: Thông báo hoàn thành**

```bash
# Log timestamp
echo "Update completed at: $(date)"

# Check deployment
git log --oneline -1

# Send notification
# "✅ Production updated at [time]. Services healthy."
```

---

## 🚨 Rollback (nếu có lỗi)

### **Rollback nhanh:**

```bash
# Quay lại commit trước đó
git reset --hard HEAD~1
git pull origin main --force

# Rebuild & restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### **Rollback sang tag/version cụ thể:**

```bash
# List available versions
git tag -l

# Checkout version cụ thể
git checkout v1.2.0

# Rebuild & restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### **Rollback database** (nếu migrations broken):

```bash
# Revert last migration
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py migrate <app> <previous_migration_number>

# Ví dụ:
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py migrate api_gateway 0009
```

---

## 📊 Complete Update Script (Automated)

Tạo file `update_production.sh`:

```bash
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/opt/bookstore/Book_Store_BE"
LOG_FILE="$APP_DIR/update_$(date +%Y%m%d_%H%M%S).log"

echo -e "${GREEN}Starting production update...${NC}"
echo "Log file: $LOG_FILE"

cd $APP_DIR

# Step 1: Git pull
echo -e "${YELLOW}[1/8] Pulling latest code...${NC}"
git pull origin main 2>&1 | tee -a $LOG_FILE

CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo "Current commit: $CURRENT_COMMIT" | tee -a $LOG_FILE

# Step 2: Check for changes
echo -e "${YELLOW}[2/8] Checking for Docker image changes...${NC}"
git diff HEAD~1 --name-only | grep Dockerfile > /dev/null 2>&1 && REBUILD=true || REBUILD=false
echo "Rebuild required: $REBUILD" | tee -a $LOG_FILE

# Step 3: Backup current state
echo -e "${YELLOW}[3/8] Backing up current state...${NC}"
docker-compose -f docker-compose.prod.yml ps > $APP_DIR/backup_$(date +%Y%m%d_%H%M%S).log

# Step 4: Stop services
echo -e "${YELLOW}[4/8] Stopping services...${NC}"
docker-compose -f docker-compose.prod.yml down 2>&1 | tee -a $LOG_FILE

# Step 5: Rebuild if needed
if [ "$REBUILD" = true ]; then
    echo -e "${YELLOW}[5/8] Rebuilding Docker images...${NC}"
    docker-compose -f docker-compose.prod.yml build 2>&1 | tee -a $LOG_FILE
else
    echo -e "${YELLOW}[5/8] Skipping rebuild (no Dockerfile changes)${NC}"
fi

# Step 6: Start services
echo -e "${YELLOW}[6/8] Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d 2>&1 | tee -a $LOG_FILE

# Wait for services to be healthy
sleep 30

# Step 7: Run migrations
echo -e "${YELLOW}[7/8] Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T api-gateway python manage.py migrate 2>&1 | tee -a $LOG_FILE

# Step 8: Health check
echo -e "${YELLOW}[8/8] Performing health checks...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/books/)

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ API Gateway is healthy!${NC}" | tee -a $LOG_FILE
    echo -e "${GREEN}✓ Production update completed successfully!${NC}" | tee -a $LOG_FILE
    echo "Commit: $CURRENT_COMMIT" | tee -a $LOG_FILE
    exit 0
else
    echo -e "${RED}✗ Health check failed! Status: $HEALTH_STATUS${NC}" | tee -a $LOG_FILE
    echo -e "${RED}Rolling back...${NC}"
    git reset --hard HEAD~1
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d
    exit 1
fi
```

**Sử dụng script:**

```bash
# Copy script lên server
scp -i key.pem update_production.sh ubuntu@<EC2_IP>:/opt/bookstore/

# SSH vào server
ssh -i key.pem ubuntu@<EC2_IP>

# Chạy script
cd /opt/bookstore
chmod +x update_production.sh
./update_production.sh

# Hoặc chạy in background
nohup ./update_production.sh &
```

---

## 📈 Monitoring During Update

```bash
# Terminal 1: Watch services
watch -n 1 'docker-compose -f docker-compose.prod.yml ps'

# Terminal 2: Tail logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Terminal 3: Health monitoring
watch -n 5 'curl -s http://localhost:8000/api/books/ | jq . 2>/dev/null || echo "Service down"'

# Terminal 4: System resources
docker stats --no-stream
```

---

## 🔍 Troubleshooting Common Issues

### **Issue 1: Git pull fails**
```bash
# Kiểm tra changes
git status

# Backup local changes
git stash

# Try pull again
git pull origin main

# Restore if needed
git stash pop
```

### **Issue 2: Docker build fails**
```bash
# Clean up old images
docker image prune -a -f

# Rebuild with verbose output
docker-compose -f docker-compose.prod.yml build --no-cache api-gateway

# Check logs
docker-compose -f docker-compose.prod.yml logs api-gateway
```

### **Issue 3: Services not starting**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api-gateway

# Check dependencies
docker-compose -f docker-compose.prod.yml ps

# Ensure postgres is healthy
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Restart dependent services
docker-compose -f docker-compose.prod.yml restart order-consumer
docker-compose -f docker-compose.prod.yml restart pay-consumer
```

### **Issue 4: Database migration errors**
```bash
# Check migration status
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py showmigrations

# View specific migration file
cat api_gateway/migrations/0001_initial.py

# Undo last migration
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py migrate api_gateway 0001

# Redo migration
docker-compose -f docker-compose.prod.yml exec api-gateway python manage.py migrate
```

---

## 📋 Update Checklist

```
☐ Code committed & pushed to GitHub
☐ Notified team of maintenance window
☐ SSH vào server
☐ Pulled latest code
☐ Reviewed changes: git log --oneline -5
☐ Rebuilt images (if needed)
☐ Restarted services
☐ Ran database migrations
☐ Verified all services UP
☐ Health check passed (API responds)
☐ Checked logs for errors
☐ Verified database connected
☐ Tested RabbitMQ
☐ Rollback plan ready (if needed)
☐ Notified team: "Update complete"
```

---

## 🚀 Best Practices

### **DO:**
✅ Always test code locally first
✅ Run migrations in staging environment first
✅ Keep update log for audit trail
✅ Have rollback plan ready
✅ Update during low-traffic times
✅ Use git tags for production versions
✅ Keep database backups before major updates

### **DON'T:**
❌ Force push to main branch
❌ Manually edit files on production server
❌ Skip testing locally
❌ Update without rollback plan
❌ Mix multiple features in one update
❌ Forget to run migrations
❌ Update during peak traffic

---

## 📞 Emergency Contacts

| Issue | Contact | Action |
|-------|---------|--------|
| Services down | DevOps Lead | Activate rollback |
| DB error | Database Admin | Check migrations |
| API not responding | Backend Lead | Check logs |
| Can't SSH | Infrastructure | Check security group |

---

## 🔗 Quick Commands Reference

```bash
# Navigation
cd /opt/bookstore/Book_Store_BE

# View services
docker-compose -f docker-compose.prod.yml ps

# View specific logs
docker-compose -f docker-compose.prod.yml logs -f api-gateway

# Health check
curl http://localhost:8000/ health

# Stop all
docker-compose -f docker-compose.prod.yml down

# Start all
docker-compose -f docker-compose.prod.yml up -d

# Rebuild all
docker-compose -f docker-compose.prod.yml build

# Get git history
git log --oneline -10

# Rollback to previous
git reset --hard HEAD~1

# View current commit
git rev-parse --short HEAD
```

---

**Chúc bạn update thành công!** 🎉
