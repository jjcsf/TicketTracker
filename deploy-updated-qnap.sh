#!/bin/bash

# Deploy Updated Season Ticket Manager to QNAP
# This script builds and deploys the application with basic authentication

set -e

echo "🚀 Deploying Updated Season Ticket Manager to QNAP"

# Configuration
CONTAINER_NAME="season-ticket-manager"
IMAGE_NAME="season-ticket-manager:latest"
PORT="5050"

echo "📦 Building the application..."

# Build the frontend
npm run build

# Create production server build with basic auth
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server.js

# Create Dockerfile for the updated app
cat > Dockerfile.updated << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy built application
COPY dist ./dist
COPY shared ./shared

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050
ENV SESSION_SECRET=your-secure-session-secret-here

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5050/api/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]
EOF

# Build Docker image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.updated -t $IMAGE_NAME .

# Create docker-compose file for QNAP
cat > docker-compose-qnap.yml << 'EOF'
version: '3.8'

services:
  season-ticket-manager:
    image: season-ticket-manager:latest
    container_name: season-ticket-manager
    ports:
      - "5050:5050"
    environment:
      - NODE_ENV=production
      - PORT=5050
      - SESSION_SECRET=your-secure-session-secret-here
      - DATABASE_URL=postgresql://username:password@host:port/database
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5050/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  default:
    name: season-ticket-manager-network
EOF

echo "✅ Build complete!"
echo ""
echo "📋 Deployment Instructions for QNAP:"
echo ""
echo "1. Copy the following files to your QNAP:"
echo "   - docker-compose-qnap.yml"
echo "   - The Docker image (or rebuild on QNAP)"
echo ""
echo "2. Update the DATABASE_URL in docker-compose-qnap.yml with your PostgreSQL connection details"
echo ""
echo "3. Deploy using Container Station:"
echo "   - Upload docker-compose-qnap.yml to Container Station"
echo "   - Or run: docker-compose -f docker-compose-qnap.yml up -d"
echo ""
echo "4. Access your application at: http://your-qnap-ip:5050"
echo ""
echo "🔧 Environment Variables to Configure:"
echo "   - DATABASE_URL: Your PostgreSQL connection string"
echo "   - SESSION_SECRET: A secure random string for sessions"
echo ""
echo "📊 Application Features:"
echo "   - Basic authentication (no login required for development)"
echo "   - Full Season Ticket Manager functionality"
echo "   - Dashboard, Games, Finances, Reports, Seats management"
echo "   - PostgreSQL database integration"

# Clean up
rm Dockerfile.updated

echo ""
echo "🎉 Deployment package ready!"