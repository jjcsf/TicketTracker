#!/bin/bash
# Container Station Interactive Fix Commands

echo "Stopping current container..."
cd /share/Container/projects/SeasonTicketTracker
docker-compose down

echo "Clearing old files..."
rm -rf *

echo "Pulling latest interactive code..."
git clone https://github.com/jjcsf/TicketTracker.git .

echo "Building with interactive server..."
docker-compose up -d --build --no-cache

echo "Waiting for services to start..."
sleep 30

echo "Checking container status..."
docker-compose ps

echo "Container should now be interactive at http://your-nas-ip:5050"
echo "Features available:"
echo "- Click on any dashboard card"
echo "- Authentication bypassed for container admin"
echo "- Full React routing enabled"
echo "- Database connected with sample data"