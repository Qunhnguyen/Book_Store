# Hướng dẫn: Thay thế Project Cũ bằng Project Mới

## 🎯 Tổng quan

Sẽ:
1. ✅ Dừng project cũ (Docker Compose)
2. ✅ Xóa sạch containers, volumes, images
3. ✅ Xóa thư mục project cũ
4. ✅ Clone project mới
5. ✅ Setup & start services mới

**Thời gian:** ~10-15 phút (tùy tốc độ clone & build)

---

## 📋 Step-by-step Guide

### **Bước 1: SSH vào Server**

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd ~
```

---

### **Bước 2: Tìm Project Cũ**

```bash
# Tìm project cũ đang chạy
docker-compose ls

# Output sẽ show tất cả projects đang active
# Ví dụ:
# NAME                 STATUS              CONFIG FILE
# old-bookstore        running(13 services) /path/to/docker-compose.yml

# Hoặc tìm bằng cách list directories
ls -la /opt/
ls -la ~/
```

**Ghi nhớ đường dẫn project cũ**, ví dụ: `/opt/old-bookstore`

---

### **Bước 3: Navigate tới Project Cũ**

```bash
# Ví dụ (thay đúng đường dẫn của bạn)
cd /opt/old-bookstore

# Hoặc nếu project ở thư mục khác
cd ~/projects/old-bookstore

# Xác nhận
pwd
ls -la
```

---

### **Bước 4: Stop Project Cũ**

```bash
# View services đang chạy
docker-compose ps

# Expected output:
# NAME                    STATUS
# customer-service        Up 3 days
# book-service            Up 3 days
# ...

# Stop all containers (keep volumes)
docker-compose down

# Hoặc nếu muốn xóa LUÔN volumes/data
docker-compose down -v

# Xác nhận đã stop
docker-compose ps
# Output: Should be empty (No services)
```

---

### **Bước 5: Xóa Docker Resources (Optional nhưng khuyên dùng)**

```bash
# Xóa tất cả containers liên quan tới project cũ
docker container prune -f  # Xóa tất cả stopped containers

# Xóa tất cả volumes (nếu muốn sạch hoàn toàn)
docker volume prune -f

# Xóa images của project cũ (optional)
docker images | grep -E "(old-bookstore|bookstore:old)" | awk '{print $3}' | xargs docker rmi -f

# Hoặc xóa từng image
docker rmi bookstore/api-gateway:latest
docker rmi bookstore/customer-service:latest
# ... các images khác

# Clean up everything (nuclear option)
docker system prune -a -f --volumes  # ⚠️ CẢNH BÁO: Xóa ALL unused
```

---

### **Bước 6: Xóa Project Cũ**

```bash
# Remove project directory
cd ~  # Escape project directory first
sudo rm -rf /opt/old-bookstore
# hoặc
sudo rm -rf ~/projects/old-bookstore

# Xác nhận đã xóa
ls -la /opt/
ls -la ~/
# Project cũ không còn
```

---

### **Bước 7: Kiểm tra Ports Trống**

```bash
# Check which ports are in use
sudo lsof -i -P -n | grep LISTEN

# Hoặc check ports cụ thể
sudo lsof -i :80    # Port 80
sudo lsof -i :8000  # Port 8000
sudo lsof -i :5432  # Port 5432
sudo lsof -i :5672  # Port 5672

# Output should be empty hoặc không show project cũ
```

---

### **Bước 8: Clone Project Mới**

```bash
# Navigate tới directory để clone project mới
cd /opt/  # Hoặc ~/projects/ - tuỳ bạn

# Clone repository
git clone https://github.com/your-repo/Book_Store.git

# Hoặc clone với specific branch
git clone -b main https://github.com/your-repo/Book_Store.git

# Enter project directory
cd Book_Store/Book_Store_BE

# Verify git status
git status
git log --oneline -3
```

---

### **Bước 9: Setup Environment**

```bash
# Create .env file từ template
cp .env.example .env

# Edit .env với values thực tế
nano .env
# Hoặc
vim .env
# Hoặc
cat > .env << 'EOF'
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=postgres
DB_PORT=5432

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# Application
DEBUG=False
ALLOWED_HOSTS=*

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
EOF
```

---

### **Bước 10: Build Docker Images** (nếu cần)

```bash
# Option A: Build all images
docker-compose -f docker-compose.prod.yml build

# Option B: Build specific services
docker-compose -f docker-compose.prod.yml build api-gateway

# Option C: Skip rebuilding (nếu images sẵn trên repo)
# Continue to step 11
```

**Thời gian:** 3-10 phút (tuỳ kích thước image)

---

### **Bước 11: Start Project Mới**

```bash
# Create/start all services
docker-compose -f docker-compose.prod.yml up -d

# Hoặc nếu chỉ dùng docker-compose.yml thông thường
docker-compose up -d

# Verify all services are running
docker-compose ps

# Expected: All services "Up X seconds"
```

**Thời gian:** 30-90 giây

---

### **Bước 12: Run Database Migrations**

```bash
# Chạy migrations cho api-gateway
docker-compose exec -T api-gateway python manage.py migrate

# Chạy migrations cho các services khác nếu cần
docker-compose exec -T customer-service python manage.py migrate
docker-compose exec -T book-service python manage.py migrate
# ... etc
```

---

### **Bước 13: Health Check**

```bash
# Test API Gateway
curl http://localhost:8000/api/books/
# Expected: 200 OK hoặc list books

# Test từ public IP
curl http://<EC2_PUBLIC_IP>:8000/api/books/

# Check all services
docker-compose ps

# View logs
docker-compose logs -f api-gateway

# Check database
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Check RabbitMQ
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping
```

---

## 🚀 Tất cả trong 1 script

Tạo file `switch_projects.sh`:

```bash
#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting project migration...${NC}"
echo ""

# Configuration
OLD_PROJECT_PATH="${1:-.}"  # Current directory if not specified
NEW_REPO_URL="${2:-https://github.com/your-repo/Book_Store.git}"
NEW_PROJECT_PATH="/opt/bookstore"

echo -e "${YELLOW}[1/9] Stopping old project...${NC}"
cd "$OLD_PROJECT_PATH"
docker-compose down -v || true
sleep 5

echo -e "${YELLOW}[2/9] Removing Docker resources...${NC}"
docker container prune -f || true
docker volume prune -f || true

echo -e "${YELLOW}[3/9] Removing old project directory...${NC}"
cd ~
sudo rm -rf "$OLD_PROJECT_PATH" || true

echo -e "${YELLOW}[4/9] Creating new project directory...${NC}"
sudo mkdir -p "$NEW_PROJECT_PATH"
sudo chown ubuntu:ubuntu "$NEW_PROJECT_PATH"

echo -e "${YELLOW}[5/9] Cloning new project...${NC}"
cd "$NEW_PROJECT_PATH"
git clone "$NEW_REPO_URL" .

echo -e "${YELLOW}[6/9] Setting up environment...${NC}"
cd Book_Store_BE
cp .env.example .env

echo "Please edit .env with your actual values:"
echo "  nano .env"
echo ""
read -p "Press Enter when done editing .env..."

echo -e "${YELLOW}[7/9] Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build

echo -e "${YELLOW}[8/9] Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d
sleep 30

echo -e "${YELLOW}[9/9] Running migrations...${NC}"
docker-compose exec -T api-gateway python manage.py migrate || true

echo ""
echo -e "${GREEN}=== Migration Complete ====${NC}"
echo "Services:"
docker-compose ps
echo ""
echo "Test API:"
echo "  curl http://localhost:8000/api/books/"
echo ""
echo "View logs:"
echo "  docker-compose logs -f"
```

**Sử dụng:**
```bash
chmod +x switch_projects.sh
./switch_projects.sh "/opt/old-bookstore" "https://github.com/your-repo/Book_Store.git"
```

---

## 🔍 Troubleshooting

### **Port still in use?**
```bash
# Find what's using port
sudo lsof -i :8000
sudo netstat -tulpn | grep :8000

# Kill process (if needed)
sudo kill -9 <PID>
```

### **Docker build fails?**
```bash
# Clean up and retry
docker system prune -a -f
docker-compose -f docker-compose.prod.yml build --no-cache api-gateway
```

### **Services not starting?**
```bash
# Check logs
docker-compose logs -f

# Stop and check for errors
docker-compose down
docker-compose up -d
docker-compose logs

# Try rebuilding
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### **Permission denied errors?**
```bash
# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Apply group changes
newgrp docker

# Or restart terminal
```

---

## ✅ Verification Checklist

```
☐ Old project stopped
☐ Docker containers removed
☐ Docker volumes removed (if xóa data)
☐ Old project directory deleted
☐ New project cloned
☐ .env file created & configured
☐ Docker images built
☐ Services started (docker-compose ps)
☐ All services showing "Up"
☐ Database migrations ran successfully
☐ API responding to requests
☐ No error logs
☐ Health check passed
```

---

## 📊 Disk Space Cleanup

```bash
# Check disk usage before
df -h

# After cleanup, typically frees 1-10GB (tuỳ image sizes)
docker system prune -a -f --volumes

# Check disk usage after
df -h
```

---

## 🔐 Important Notes

⚠️ **Warning:**
- If project cũ was using production data, backup trước khi xóa!
- Make sure bạn có git history nếu cần revert
- Test project mới trên staging trước khi production

✅ **Safe practices:**
- Check `docker-compose ps` trước khi down
- Backup .env file của project cũ (nếu có sensitive config)
- Keep git clone của repo cũ somewhere (backup)
- Test API sau khi start trước khi declare success

---

## 📞 Quick Reference

```bash
# Navigate to new project
cd /opt/bookstore/Book_Store_BE

# View services
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs api-gateway

# Stop all
docker-compose down

# Restart services
docker-compose restart

# Rebuild & start
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose exec -T api-gateway python manage.py migrate

# Check status
curl http://localhost:8000/api/books/
```

---

**Ready?** Start từ Bước 1! 🚀
