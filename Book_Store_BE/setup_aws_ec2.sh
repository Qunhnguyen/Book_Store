#!/bin/bash
# AWS EC2 Auto Setup Script for Book Store Backend
# Chạy lệnh này ngay sau khi SSH vào EC2:
# chmod +x setup_aws_ec2.sh && ./setup_aws_ec2.sh

set -e

echo "========================================="
echo "Book Store Backend - AWS EC2 Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}Please run this script as root (use sudo)${NC}"
   exit 1
fi

# Variables
REPO_URL="${1:-https://github.com/your-repo/Book_Store.git}"
APP_DIR="/opt/bookstore"
DB_PASSWORD="${2:-bookstore123!@#}"

echo -e "${GREEN}[1/7]${NC} Updating system packages..."
apt-get update && apt-get upgrade -y

echo -e "${GREEN}[2/7]${NC} Installing Docker..."
apt-get install -y docker.io docker-compose git curl wget software-properties-common

echo -e "${GREEN}[3/7]${NC} Starting Docker daemon..."
systemctl start docker
systemctl enable docker

echo -e "${GREEN}[4/7]${NC} Adding ubuntu user to docker group..."
usermod -aG docker ubuntu
newgrp docker

echo -e "${GREEN}[5/7]${NC} Cloning repository..."
mkdir -p $APP_DIR
cd $APP_DIR

# Nếu repo không tồn tại, clone. Nếu có, pull latest
if [ -d ".git" ]; then
    echo "Repository already exists. Pulling latest..."
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL .
fi

echo -e "${GREEN}[6/7]${NC} Creating environment configuration..."
cd Book_Store_BE

# Tạo .env file
cat > .env << EOF
# Database Configuration
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_HOST=postgres
DB_PORT=5432

# JWT Security
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

echo "✓ Created .env file with secure defaults"
echo "  Database Password: $DB_PASSWORD"

echo -e "${GREEN}[7/7]${NC} Starting services with docker-compose..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}========================================="
echo "✓ Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Services Status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "Available endpoints:"
echo "  • API Gateway: http://$(hostname -I | awk '{print $1}'):8000"
echo "  • RabbitMQ Admin: http://$(hostname -I | awk '{print $1}'):15672"
echo "  • PostgreSQL: localhost:5432"
echo ""
echo "Useful commands:"
echo "  • View logs: cd $APP_DIR/Book_Store_BE && docker-compose -f docker-compose.prod.yml logs -f"
echo "  • Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  • Restart service: docker-compose -f docker-compose.prod.yml restart <service>"
echo "  • Update code: cd $APP_DIR && git pull && docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "Documentation: $APP_DIR/AWS_DEPLOYMENT_GUIDE.md"
echo ""

# Test services
echo -e "${YELLOW}Testing API Gateway...${NC}"
sleep 10
if curl -s http://localhost:8000/api/books/ > /dev/null; then
    echo -e "${GREEN}✓ API Gateway is responding${NC}"
else
    echo -e "${RED}✗ API Gateway is not responding (may still be initializing)${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Configure database if using external RDS"
echo "2. Setup domain and SSL certificate"
echo "3. Configure AWS Security Groups"
echo "4. Setup CloudWatch monitoring"
echo "5. Configure auto-backup for database"
