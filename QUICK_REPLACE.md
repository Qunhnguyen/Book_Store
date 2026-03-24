# Quick: Thay thế Project Cũ bằng Project Mới

## ⚡ Cách nhanh nhất (1 script)

### Tùy chọn A: Script tự động (Recommended)

```bash
# SSH vào server
ssh -i your-key.pem ubuntu@<EC2_IP>

# Download script
cd /opt/bookstore
sudo chmod +x replace_project.sh

# Chạy script với path cũ và repo mới
sudo ./replace_project.sh /opt/old-bookstore https://github.com/your-repo/Book_Store.git

# Script sẽ tự động:
# ✓ Stop & remove old project
# ✓ Cleanup Docker resources
# ✓ Clone new project
# ✓ Setup environment
# ✓ Build images
# ✓ Start services
# ✓ Run migrations
# ✓ Health check
```

**Thời gian:** ~15-20 phút (tùy kích thước)

---

## 📋 Tùy chọn B: Step-by-step (Manual control)

```bash
# 1. Stop project cũ
cd /opt/old-bookstore
docker-compose down -v

# 2. Remove old project
cd ~
sudo rm -rf /opt/old-bookstore

# 3. Clone project mới
cd /opt
git clone https://github.com/your-repo/Book_Store.git bookstore
cd bookstore/Book_Store_BE

# 4. Setup env
cp .env.example .env
nano .env  # Edit với values thực tế

# 5. Build & start
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 6. Migrations
docker-compose exec -T api-gateway python manage.py migrate

# 7. Verify
curl http://localhost:8000/api/books/
```

---

## 🔍 Verification Commands

```bash
# Check services running
docker-compose ps

# View logs
docker-compose logs -f

# Test API
curl http://localhost:8000/api/books/

# Check database
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Monitor resources
docker stats
```

---

## 🚨 Troubleshooting

### Services not starting?
```bash
# View logs
docker-compose logs -f

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Port conflict?
```bash
# Find what's using port 8000
sudo lsof -i :8000

# Kill if needed
sudo kill -9 <PID>
```

### Build fails?
```bash
# Clean up
docker system prune -a -f

# Rebuild
docker-compose -f docker-compose.prod.yml build
```

---

## ✅ Checklist

```
☐ Old project stopped
☐ Old Docker containers removed
☐ Old project directory deleted
☐ New project cloned
☐ .env file created & edited
☐ Docker images built
☐ All services started (ps shows "Up")
☐ Migrations ran successfully
☐ API responding (curl test)
☐ No error logs
```

---

**⏱️ Expected Timeline:**
- Scripts load: 1-2 min
- Docker build: 5-10 min
- Services start: 1-2 min
- Migrations: 1-5 min
- **Total:** 8-20 min

**See:** [REPLACE_OLD_PROJECT.md](REPLACE_OLD_PROJECT.md) for detailed guide
