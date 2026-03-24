# Quick Start: Deploy Book Store lên AWS

## 🚀 Cách nhanh nhất (5 phút)

### Bước 1: Tạo EC2 Instance

```bash
# Trên AWS Console
EC2 → Launch Instances
- Image: Ubuntu 22.04 LTS
- Instance Type: t3.large (hoặc lớn hơn)
- Storage: 20GB
- Security Group: Mở ports 22, 80, 443, 8000-8012, 5432
- Download .pem key
```

### Bước 2: SSH vào server

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Bước 3: Chạy setup script (tự động hết)

```bash
# Tải setup script
wget https://raw.githubusercontent.com/your-repo/Book_Store/main/Book_Store_BE/setup_aws_ec2.sh
sudo chmod +x setup_aws_ec2.sh

# Chạy (với repo URL và password database)
sudo ./setup_aws_ec2.sh "https://github.com/your-repo/Book_Store.git" "your-secure-db-password"

# Hoặc dùng defaults
sudo ./setup_aws_ec2.sh
```

### Bước 4: Kiểm tra

```bash
# Xem services
docker-compose ps

# Test API
curl http://localhost:8000/api/books/

# View logs
docker-compose logs -f api-gateway
```

### Bước 5: Domain & SSL (Optional)

```bash
# Cài certbot
sudo apt-get install certbot python3-certbot-nginx

# Tạo certificate (thay your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Update Nginx config với SSL paths
```

---

## 📊 Port Mapping

```
Port 80    → Nginx reverse proxy
Port 443   → Nginx HTTPS
Port 8000  → API Gateway
Port 8001  → Customer Service
Port 8002  → Book Service
Port 8003  → Cart Service
Port 8004  → Staff Service
Port 8005  → Order Service
Port 8006  → Pay Service
Port 8007  → Ship Service
Port 8008  → Comment/Rate Service
Port 8009  → Manager Service
Port 8010  → Catalog Service
Port 8011  → Recommender AI Service
Port 8012  → Image Service
Port 5432  → PostgreSQL
Port 5672  → RabbitMQ
Port 15672 → RabbitMQ Management UI
Port 6379  → Redis
```

---

## 🐛 Troubleshooting

### Services không start?
```bash
# Kiểm tra logs
docker-compose logs -f

# Restart services
docker-compose down
docker-compose -f docker-compose.prod.yml up -d
```

### Database connection error?
```bash
# Kiểm tra database
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Kiểm tra environment variables
docker-compose config | grep DB_
```

### RabbitMQ không kết nối?
```bash
# Check rabbitmq health
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping

# View rabbitmq logs
docker-compose logs rabbitmq
```

### Port đã bị dùng?
```bash
# Tìm service dùng port
lsof -i :8000

# Hoặc thay đổi port trong docker-compose.yml
```

---

## 📈 Scaling (Khi cần)

### Tăng số lượng workers
```bash
# Tạo nhiều instances của service
docker-compose up -d --scale order-service=2 order-consumer=2
```

### Dùng AWS RDS thay vì container PostgreSQL
```bash
# Tạo RDS instance
AWS Console → RDS → Create Database
- Engine: PostgreSQL 15
- Instance: db.t3.micro (dev)
- Multi-AZ: No (dev)

# Update .env
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USER=postgres
DB_PASSWORD=your-strong-password

# Run migration
docker-compose exec api-gateway python manage.py migrate
```

### Dùng ElastiCache (Redis)
```bash
# Create ElastiCache cluster
AWS → ElastiCache → Create Cluster
- Engine: Redis
- Node type: cache.t3.micro

# Update .env
REDIS_HOST=your-elasticache-endpoint.amazonaws.com
```

---

## 🔒 Security Checklist

- [ ] Đổi password database khỏi default
- [ ] Đổi JWT_SECRET khỏi default
- [ ] Update ALLOWED_HOSTS với domain thực tế
- [ ] Enable SSL/HTTPS
- [ ] Limit security group ingress chỉ port cần thiết
- [ ] Setup AWS backup strategy
- [ ] Enable CloudWatch logs
- [ ] Disable SSH password (chỉ key)
- [ ] Setup firewall rules
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`

---

## 💰 Chi phí (ước tính/tháng)

```
EC2 t3.large:           $30
Data Transfer (1 TB):   $10
(RDS PostgreSQL):       $0-50
(Network Load Balancer): $0-20
────────────────────────────
Tổng:                   $40-110
```

---

## 📝 Logging & Monitoring

### View logs của service
```bash
docker-compose logs api-gateway
docker-compose logs --tail=100 -f order-consumer
```

### Setup AWS CloudWatch
```bash
# Tạo log group
aws logs create-log-group --log-group-name /bookstore/api-gateway

# Push logs từ container
docker-compose exec api-gateway tail -f /var/log/app.log | \
  aws logs put-log-events --log-group-name /bookstore/api-gateway
```

---

## 🔄 Continuous Deployment (CI/CD)

Xem `.github/workflows/deploy.yml` trong main guide để setup GitHub Actions auto-deploy.

---

## 📚 Chi tiết thêm

Xem [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) để:
- Deployment options chi tiết (EC2, ECS, Lightsail)
- Infrastructure as Code (CloudFormation)
- Auto-scaling configs
- Backup & disaster recovery
- Multi-region deployment
