# Pre-deployment Checklist

## ✅ Code & Build Preparation

- [ ] **Code đã sẵn sàng**
  - [ ] Tất cả code đã push lên repository
  - [ ] Không có conflicts
  - [ ] Tất cả tests pass locally
  
- [ ] **Docker Images**
  - [ ] Tất cả Dockerfile có sẵn
  - [ ] Build images locally thành công: `docker build -t bookstore/api-gateway ./api-gateway`
  - [ ] Images đủ nhỏ (<500MB mỗi image nếu có thể)
  
- [ ] **Environment Variables**
  - [ ] Copy `.env.example` → `.env`
  - [ ] Cập nhật tất cả sensitive values
  - [ ] Không có defaults không an toàn
  - [ ] JWT_SECRET được generate ngẫu nhiên
  - [ ] DB password không phải default

---

## 🏗️ Infrastructure Preparation (AWS)

### EC2 Instance
- [ ] Instance type selected: t3.large (hoặc lớn hơn)
- [ ] VPC & Subnet chọn đúng
- [ ] Max storage: 20GB+
- [ ] Key pair downloaded và lưu an toàn
- [ ] **Security Group có mở ports:**
  - [ ] 22 (SSH)
  - [ ] 80 (HTTP)
  - [ ] 443 (HTTPS)
  - [ ] 8000-8012 (Services) - hoặc giới hạn IP source
  - [ ] 5432 (PostgreSQL) - **CHỈFORWARD từ services**
  - [ ] 5672 (RabbitMQ) - **CHỈ internal**
  - [ ] 15672 (RabbitMQ Admin) - **CHỈ admin IPs**

### Database
- [ ] PostgreSQL 15 ready (container hoặc RDS)
- [ ] Databases & users created (nếu RDS):
  ```sql
  CREATE USER gateway WITH PASSWORD 'strong-password';
  CREATE USER customer WITH PASSWORD 'strong-password';
  -- ... tạo cho 13 databases
  ```
- [ ] Backup strategy planned
- [ ] Multi-AZ enabled (nếu production)

### Message Broker & Cache
- [ ] RabbitMQ ready
- [ ] Redis ready
- [ ] Credentials configured

### Domain & SSL
- [ ] Domain name registered (nếu có)
- [ ] DNS updated (A record → EC2 IP)
- [ ] SSL certificate ready (Let's Encrypt hoặc AWS ACM)
- [ ] Nginx config updated với domain

---

## 🚀 Deployment

### Pre-deployment Tests
- [ ] **Local Test**
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  curl http://localhost:8000/api/books/
  # Expected: 200 OK (hoặc list books)
  ```

- [ ] **Database Migrations**
  ```bash
  docker-compose exec api-gateway python manage.py migrate
  # Check status: docker-compose ps
  ```

- [ ] **RabbitMQ Check**
  ```bash
  docker-compose logs rabbitmq | grep "started"
  curl http://localhost:15672/ -u guest:guest
  ```

### Deployment Steps
1. [ ] SSH vào EC2
2. [ ] Git clone repository: `git clone <repo> bookstore`
3. [ ] Setup script chạy: `sudo ./setup_aws_ec2.sh`
4. [ ] `.env` configured
5. [ ] docker-compose.prod.yml started: `docker-compose -f docker-compose.prod.yml up -d`
6. [ ] All services healthy: `docker-compose ps` (status: Up)
7. [ ] Test API: `curl http://localhost:8000/api/books/`
8. [ ] Check logs: `docker-compose logs -f`

---

## 🔍 Post-deployment Verification

### Health Checks
- [ ] Nginx healthy: `curl http://<EC2_IP>/health`
- [ ] API Gateway responds: `curl http://<EC2_IP>:8000/api/books/`
- [ ] Database connected:
  ```bash
  docker-compose exec postgres psql -U postgres -c "SELECT 1"
  ```
- [ ] RabbitMQ operational:
  ```bash
  docker-compose exec rabbitmq rabbitmq-diagnostics -q ping
  ```
- [ ] Redis working:
  ```bash
  docker-compose exec redis redis-cli ping
  ```

### Services Status
- [ ] Tất cả 13 services + 3 consumers running
  ```bash
  docker-compose ps | grep -c "Up"  # Should be 16+
  ```

### Logs Check
- [ ] Không có ERROR logs:
  ```bash
  docker-compose logs | grep -i error
  ```
- [ ] Services khởi động thành công:
  ```bash
  docker-compose logs api-gateway | tail -20
  ```

### Performance Check
- [ ] Response time < 500ms:
  ```bash
  time curl http://localhost:8000/api/books/
  ```
- [ ] No memory leaks: `docker stats`
- [ ] CPU usage normal

---

## 🔐 Security Verification

- [ ] **No Default Credentials**
  - [ ] Default passwords changed
  - [ ] JWT secret not leaked
  - [ ] Database credentials strong
  - [ ] RabbitMQ user changed (production)

- [ ] **Network Security**
  - [ ] SSH only via key (no password)
  - [ ] Security group rules minimalized
  - [ ] Database port not public
  - [ ] RabbitMQ admin UI protected

- [ ] **SSL/HTTPS**
  - [ ] Certificate valid & not self-signed
  - [ ] HTTP redirects to HTTPS
  - [ ] HSTS header set
  - [ ] Certificate renewal automated

- [ ] **Application Security**
  - [ ] Debug mode OFF (DEBUG=False)
  - [ ] ALLOWED_HOSTS correct
  - [ ] CORS properly configured
  - [ ] Rate limiting enabled

---

## 📊 Monitoring & Logging

- [ ] CloudWatch logs configured
- [ ] CloudWatch alarms set:
  - [ ] CPU > 80%
  - [ ] Memory > 85%
  - [ ] Disk > 90%
  - [ ] 5xx errors spike
  
- [ ] Log aggregation setup (optional)
- [ ] Database slow query logs enabled
- [ ] Error tracking (Sentry) configured

---

## 💾 Backup & Recovery

- [ ] **Database Backups**
  - [ ] RDS automated backups enabled (35 days)
  - [ ] First manual snapshot taken
  - [ ] Backup retention policy set

- [ ] **Application Data**
  - [ ] User uploads backed up (S3 or persistent volume)
  - [ ] Database exports scheduled

- [ ] **Disaster Recovery Plan**
  - [ ] Recovery time objective (RTO) defined
  - [ ] Recovery point objective (RPO) defined
  - [ ] Restore procedure documented & tested

---

## 📎 Documentation

- [ ] README updated with AWS deployment info
- [ ] Troubleshooting guide in place
- [ ] Team knows how to:
  - [ ] SSH vào server
  - [ ] View logs
  - [ ] Restart services
  - [ ] Update code
  - [ ] Manually respond to alerts

---

## 🎯 Cutover & Launch

### Go-Live Checklist
- [ ] Load testing completed
- [ ] Rollback plan documented
- [ ] On-call support scheduled
- [ ] Monitoring dashboard set up
- [ ] Team trained & ready
- [ ] DNS cutover scheduled
- [ ] Customer notification done

### Post-Launch
- [ ] Monitor metrics for 2 hours
- [ ] Check error rates & performance
- [ ] User feedback collected
- [ ] Incident response team ready
- [ ] Success metrics tracked

---

## 📞 Support Contacts

| Role | Contact | Phone |
|------|---------|-------|
| DevOps Lead | | |
| Database Admin | | |
| On-Call | | |
| Escalation | | |

---

## 🔗 Useful Links

- AWS Console: https://console.aws.amazon.com/
- EC2 Dashboard: https://console.aws.amazon.com/ec2/
- RDS Dashboard: https://console.aws.amazon.com/rds/
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- Deployment Guide: [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)
- Quick Start: [QUICK_START_AWS.md](./QUICK_START_AWS.md)

---

**Cuối cùng:** Đảm bảo rằng tất cả items đã checked trước khi go-live! ✅
