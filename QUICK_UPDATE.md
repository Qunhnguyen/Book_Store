# Cách nhanh cho Production Update

## 🚀 Cách 1: Chỉ vài dòng lệnh (nhanh nhất)

### SSH vào server & update

```bash
# 1. SSH vào EC2
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# 2. Update code & restart services (1 lệnh)
cd /opt/bookstore/Book_Store_BE && \
git pull origin main && \
docker-compose -f docker-compose.prod.yml down && \
docker-compose -f docker-compose.prod.yml up -d && \
docker-compose -f docker-compose.prod.yml exec -T api-gateway python manage.py migrate && \
curl http://localhost:8000/api/books/

# Done! ✅
```

**Thời gian:** ~2-5 phút

---

## 🎯 Cách 2: Dùng script tự động (Recommended)

### Copy & chạy script

```bash
# 1. SSH & navigate
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd /opt/bookstore/Book_Store_BE

# 2. Make script executable
sudo chmod +x update_prod.sh

# 3. Chạy script (nó tự handle hết)
sudo ./update_prod.sh main              # Update từ main branch
# hoặc
sudo ./update_prod.sh v1.2.3            # Update từ tag cụ thể

# 4. Script tự động:
#    - Backup current state
#    - Git pull
#    - Rebuild images
#    - Restart services
#    - Run migrations
#    - Health check
#    - Rollback if failed
```

**Advantages:**
- ✅ Tự động backup trước khi update
- ✅ Tự động rollback nếu có lỗi
- ✅ Chi tiết logs của tất cả bước
- ✅ Health check tự động

---

## 📋 Cách 3: Step-by-step (Với kiểm soát đầy đủ)

Xem file **[UPDATE_PRODUCTION_GUIDE.md](UPDATE_PRODUCTION_GUIDE.md)** để hướng dẫn chi tiết từng bước.

---

## 🔍 Commands để kiểm tra

```bash
# Xem services running
docker-compose -f docker-compose.prod.yml ps

# View logs của service
docker-compose -f docker-compose.prod.yml logs -f api-gateway

# Test API
curl http://localhost:8000/api/books/
curl http://<EC2_IP>:8000/api/books/

# Check database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SELECT 1"

# View update logs
tail -f /opt/bookstore/Book_Store_BE/logs/update_*.log
```

---

## 🚨 Nếu có lỗi?

### Xem logs
```bash
docker-compose -f docker-compose.prod.yml logs --tail=100
docker-compose -f docker-compose.prod.yml logs api-gateway
```

### Rollback nhanh
```bash
cd /opt/bookstore/Book_Store_BE
git reset --hard HEAD~1
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Restart service cụ thể
```bash
docker-compose -f docker-compose.prod.yml restart api-gateway
docker-compose -f docker-compose.prod.yml restart order-consumer
```

---

## 🔄 Workflow đề nghị

### 1️⃣ **Local - Code thay đổi**
```bash
# Tạo branch & commit code
git checkout -b feature/my-feature
# ... code changes ...
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
```

### 2️⃣ **GitHub - Review & Test**
- Tạo Pull Request
- Code review
- Merge vào main
- CI/CD runs tests

### 3️⃣ **Production - Deploy**
```bash
# SSH vào server
ssh -i key.pem ubuntu@<EC2_IP>
cd /opt/bookstore/Book_Store_BE

# Update (1 lệnh)
sudo ./update_prod.sh main

# Verify
curl http://localhost:8000/api/books/
docker-compose -f docker-compose.prod.yml ps
```

### 4️⃣ **Monitor**
```bash
# Watch logs
docker-compose -f docker-compose.prod.yml logs -f

# Check metrics
docker stats
```

---

## 📊 Version Control Best Practices

### Tagging for Production
```bash
# Local
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# Production
cd /opt/bookstore/Book_Store_BE
sudo ./update_prod.sh v1.2.3
```

### Git log
```bash
git log --oneline -10
git show <commit-hash>
git diff <commit1> <commit2>
```

---

## 🕐 Timing Guide

| Action | Time |
|--------|------|
| Git pull | < 10s |
| Docker rebuild (full) | 3-5 min |
| Docker rebuild (partial) | 1-2 min |
| Services restart | 30-60s |
| DB migrations | 1-5 min |
| Health check | 30-90s |
| **Total (with rebuild)** | **5-10 min** |
| **Total (without rebuild)** | **2-3 min** |

---

## 🔐 Security Notes

✅ **Always:**
- Use SSH keys (not passwords)
- Pull from main branch (after review)
- Keep backups
- Test locally first
- Have rollback ready

❌ **Never:**
- Push directly to production
- Manual edits on server
- Hardcode secrets
- Skip migrations
- Ignore errors

---

## 📞 Quick Help

```bash
# Current commit on production
git rev-parse --short HEAD

# What changed?
git log --oneline -5

# Rebuild single service
docker-compose -f docker-compose.prod.yml build api-gateway

# Down but keep data
docker-compose -f docker-compose.prod.yml down

# Full clean restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

**Need more detailed guide?** → See [UPDATE_PRODUCTION_GUIDE.md](UPDATE_PRODUCTION_GUIDE.md)

**Script documentation?** → See [update_prod.sh](./update_prod.sh) comments
