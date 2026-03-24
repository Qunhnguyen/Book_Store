# Hướng dẫn Deploy Book Store Backend lên AWS

## Tổng quan

Project là một **microservices architecture** với 13 services, RabbitMQ, PostgreSQL, Redis. Có **3 cách chính** để deploy:

| Cách | Độ phức tạp | Chi phí | Thích hợp cho |
|------|-----------|--------|--------------|
| **EC2 + Docker Compose** | Thấp | $10-30/tháng | Dev/Staging, bắt đầu nhanh |
| **ECS (Fargate)** | Cao | $50-200/tháng | Production, tự động scaled |
| **Lightsail** | Trung bình | $20-60/tháng | Small production, dễ quản lý |

---

## Cách 1: Deploy trên EC2 + Docker Compose (Đơn giản & Nhanh)

### Bước 1: Tạo EC2 Instance

**Trên AWS Console:**
1. EC2 → Launch Instances
2. Chọn **Ubuntu 22.04 LTS** (t3.large hoặc t3.xlarge - vì project chiếm ~1.5GB RAM)
3. **Security Group**: Mở các port:
   - 80 (HTTP)
   - 443 (HTTPS)
   - 8000-8012 (Services)
   - 5432 (PostgreSQL - chỉ từ app)
   - 5672 (RabbitMQ - chỉ từ app)
   - 6379 (Redis - chỉ từ app)
   - 22 (SSH)

4. **Storage**: Tối thiểu 20GB
5. Launch và download `.pem` key

### Bước 2: SSH vào EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### Bước 3: Cài đặt Docker & Docker Compose

```bash
# Cập nhật
sudo apt update && sudo apt upgrade -y

# Cài Docker
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# Verify
docker --version
docker-compose --version

# Logout rồi login lại để apply group changes
logout
# SSH lại
```

### Bước 4: Tải Code & Chuẩn bị

```bash
# Clone/Upload project
git clone <your-repo> book-store
cd book-store/Book_Store_BE

# Kiểm tra docker-compose.yml
cat docker-compose.yml
```

### Bước 5: Cấu hình Environment Variables

Tạo file `.env` trong thư mục `Book_Store_BE/`:

```env
# JWT & Security
JWT_SECRET=your-super-secure-random-key-here
DEBUG=False
ALLOWED_HOSTS=your-ec2-public-ip,your-domain.com

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-postgres-password

# RabbitMQ
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

### Bước 6: Điều chỉnh docker-compose.yml cho Production

Thêm vào `docker-compose.yml` của bạn:

```yaml
version: "3.9"

services:
  # ... existing services ...

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro  # Cho SSL certs
    depends_on:
      - api-gateway
    networks:
      - bookstore

networks:
  bookstore:
    driver: bridge

volumes:
  postgres_data:
  rabbitmq_data:
```

### Bước 7: Tạo Nginx Config

Tạo `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api_gateway {
        server api-gateway:8000;
    }

    server {
        listen 80;
        server_name _;
        client_max_body_size 10M;

        location / {
            proxy_pass http://api_gateway;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Bước 8: Start Services

```bash
# Kiểm tra syntax
docker-compose config

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api-gateway

# Check status
docker-compose ps
```

### Bước 9: Kiểm tra dịch vụ

```bash
# Test API Gateway
curl http://localhost:8000/api/books/

# Check database
docker-compose exec postgres psql -U postgres -d gateway_db -c "SELECT 1"

# Check RabbitMQ Management UI
# http://<EC2_IP>:15672 (user: guest, pass: guest)
```

### Bước 10: Setup Domain & SSL (Optional nhưng khuyến nghị)

```bash
# Cài Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

# Tạo cert (thay your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Cập nhật Nginx config với SSL paths
# certificates ở: /etc/letsencrypt/live/your-domain.com/
```

---

## Cách 2: Deploy trên AWS ECS (Fargate) - Professional

### Bước 1: Chuẩn bị Container Images

**Bước 1.1: Tạo ECR Repository**

```bash
# Đăng nhập AWS CLI
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Tạo repo cho từng service
aws ecr create-repository --repository-name bookstore/api-gateway --region us-east-1
aws ecr create-repository --repository-name bookstore/customer-service --region us-east-1
# ... tạo cho tất cả 13 services
```

**Bước 1.2: Build & Push Images**

```bash
# Build và push từng service
cd api-gateway
docker build -t bookstore/api-gateway .
docker tag bookstore/api-gateway:latest <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/bookstore/api-gateway:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/bookstore/api-gateway:latest

# Lặp lại cho tất cả services
```

### Bước 2: Tạo RDS Database (PostgreSQL)

**Trên AWS Console:**
1. RDS → Create Database
2. PostgreSQL, Version 15
3. **Instance Class**: db.t3.medium (cho dev)
4. **Storage**: 100GB, gp3
5. **Multi-AZ**: Tắt (nếu dev)
6. **Database Name**: `gateway`
7. **Master Username**: `postgres`
8. **Master Password**: Tạo strong password

Lưu ý:
- Note lại **Endpoint** (cái này thay thế `postgres` trong docker-compose)
- **Security Group**: Allow inbound từ ECS security group

### Bước 3: Tạo ElastiCache (Redis & RabbitMQ)

**Redis:**
1. ElastiCache → Redis
2. Node type: cache.t3.micro
3. Save Endpoint

**RabbitMQ (hoặc dùng Amazon MQ):**
1. Amazon MQ → Create Broker
2. RabbitMQ engine
3. Single-AZ (hoặc Multi-AZ)
4. Broker instance type: mq.t3.micro
5. Save connection details

### Bước 4: Tạo ECS Cluster

1. ECS → Clusters → Create Cluster
2. Name: `bookstore`
3. Infrastructure: **Fargate**
4. Logging: CloudWatch (enable)
5. Create

### Bước 5: Tạo Task Definitions

Tạo file `ecs-task-definition.json`:

```json
{
  "family": "bookstore-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "<AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/bookstore/api-gateway:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "your-rds-endpoint.amazonaws.com"
        },
        {
          "name": "DB_PORT",
          "value": "5432"
        },
        {
          "name": "RABBITMQ_URL",
          "value": "amqp://user:pass@your-mq-endpoint:5672/"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bookstore-api-gateway",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Tạo task definition:**
```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
```

Lặp lại cho tất cả 13 services + 3 consumers.

### Bước 6: Tạo Services trong ECS Cluster

```bash
# API Gateway Service
aws ecs create-service \
  --cluster bookstore \
  --service-name api-gateway \
  --task-definition bookstore-api-gateway:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Bước 7: Tạo Load Balancer

1. EC2 → Load Balancers → Application Load Balancer
2. Name: `bookstore-alb`
3. VPC & Subnets: Chọn đúng
4. Security Group: Allow 80, 443
5. Target Group: Chỉ tới ECS api-gateway
6. Domain: CNAME → ALB DNS

---

## Cách 3: Deploy trên AWS Lightsail

**Giới thiệu:** 

Lightsail đơn giản hơn EC2, có sẵn Docker, giống như managed container service nhẹ.

### Bước 1: Tạo Lightsail Container Service

1. Lightsail → Containers → Create container service
2. Chọn region gần nhất
3. **Power**: Medium ($20/tháng)
4. Create

### Bước 2: Deploy Container Image

```bash
# Push đến Lightsail registry
aws lightsail push-container-image \
  --service-name bookstore \
  --label api-gateway \
  --image api-gateway:latest \
  --region us-east-1
```

### Bước 3: Tạo Container Deployment

Tạo `containers.json`:

```json
{
  "api-gateway": {
    "image": ":bookstore.api-gateway.1",
    "ports": {
      "8000": "HTTP"
    },
    "environment": {
      "DB_HOST": "postgres-managed.c90n40qj2jk.us-east-1.rds.amazonaws.com"
    }
  },
  "customer-service": {
    "image": ":bookstore.customer-service.1",
    "ports": {
      "8000": "HTTP"
    }
  }
}
```

Deploy:
```bash
aws lightsail create-container-service-deployment \
  --service-name bookstore \
  --containers file://containers.json \
  --public-endpoint containerPort=8000,hostPort=8000
```

---

## So sánh Chi phí (mỗi tháng)

```
┌─────────────────────┬─────────────┬──────────────┬──────────────┐
│ Thành phần          │ EC2+Docker  │ ECS (Fargate)│ Lightsail    │
├─────────────────────┼─────────────┼──────────────┼──────────────┤
│ Compute             │ $20-30      │ $60-100      │ $20          │
│ RDS (PostgreSQL)    │ Included*   │ $50-80       │ Included*    │
│ ECR/Registry        │ Free        │ $5-10        │ Included     │
│ Load Balancer       │ N/A (Nginx) │ $16          │ Free         │
│ Data Transfer       │ $1-5        │ $10-20       │ $1           │
├─────────────────────┼─────────────┼──────────────┼──────────────┤
│ Total               │ $21-35      │ $141-226     │ $21-40       │
└─────────────────────┴─────────────┴──────────────┴──────────────┘

* RDS ngoài nếu không dùng container-managed DB
```

---

## CI/CD Pipeline (Optional)

### Dùng GitHub Actions

Tạo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push API Gateway image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd api-gateway
          docker build -t $ECR_REGISTRY/bookstore/api-gateway:$IMAGE_TAG .
          docker push $ECR_REGISTRY/bookstore/api-gateway:$IMAGE_TAG
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster bookstore \
            --service api-gateway \
            --force-new-deployment
```

---

## Best Practices cho Production

### 1. **Database Backup**

```bash
# AWS RDS tự động backup hàng ngày
# Hoặc tạo manual snapshot:
aws rds create-db-snapshot \
  --db-instance-identifier bookstore-db \
  --db-snapshot-identifier bookstore-snapshot-$(date +%Y%m%d)
```

### 2. **Monitoring & Alerting**

```bash
# CloudWatch Alarms
aws cloudwatch put-metric-alarm \
  --alarm-name bookstore-cpu-high \
  --alarm-description "Alert if CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

### 3. **Auto-scaling (ECS)**

```bash
# Tạo auto-scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/bookstore/api-gateway \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10
```

### 4. **Security**

- ✅ Dùng **AWS Secrets Manager** cho keys
- ✅ **VPC Endpoint** cho services
- ✅ **WAF** cho API Gateway (nếu dùng ALB)
- ✅ **Security Groups**: Allow chỉ những gì cần
- ✅ **IAM Roles**: Principle of least privilege

### 5. **Logging & Debugging**

```bash
# Xem logs từ CloudWatch
aws logs tail /ecs/bookstore-api-gateway --follow

# Hoặc từ Docker Compose (EC2)
docker-compose logs -f api-gateway
```

---

## Troubleshooting

### Services không kết nối tới database

```bash
# Kiểm tra security group của RDS
# Phải allow port 5432 từ ECS security group

# Test connection
psql -h your-rds-endpoint.amazonaws.com -U postgres -d gateway
```

### RabbitMQ không hoạt động

```bash
# Đảm bảo RabbitMQ management port 15672 open
# Kiểm tra connection string trong docker-compose.yml
docker-compose logs rabbitmq
```

### ECS task không start

```bash
# Xem chi tiết lỗi
aws ecs describe-tasks \
  --cluster bookstore \
  --tasks <task-arn>

# Xem logs
aws logs tail /ecs/bookstore-api-gateway --follow
```

---

## Tóm tắt Khuyến nghị

**Cho Development:**
- Dùng **EC2 + Docker Compose** (Cách 1)
- Tối thiểu, chỉ cần 1 t3.medium EC2 instance
- Database dùng RDS hoặc container trong compose

**Cho Staging:**
- Dùng **Lightsail** (Cách 3)
- Auto-backup, các công cụ monitoring đơn giản

**Cho Production:**
- Dùng **ECS + Fargate** (Cách 2)
- Thêm RDS Multi-AZ, ElastiCache
- ALB + Auto-scaling
- CI/CD + CloudFormation

---

## Công cụ & Commands Hữu ích

```bash
# AWS CLI check version
aws --version

# Configure AWS
aws configure

# Check EC2 instances
aws ec2 describe-instances --region us-east-1

# Stop services
docker-compose down

# View service logs
docker-compose logs --tail=100 -f api-gateway

# SSH vào EC2
ssh -i key.pem ubuntu@<public-ip>

# SCP upload files
scp -i key.pem -r ./Book_Store_BE ubuntu@<public-ip>:/home/ubuntu/
```

---

**Cần giúp cách nào cụ thể hơn không?**
