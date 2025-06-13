#!/bin/bash

echo "Creating corrected Dockerfile for GitHub upload..."

cat > Dockerfile.corrected << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files and install ALL dependencies (including dev deps for build)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend (creates dist folder)
RUN npm run build

# Install additional production dependencies for container server
RUN npm install pg@^8.11.3 cors@^2.8.5

# Verify dist folder was created and list contents
RUN ls -la dist/ || echo "dist folder not found"

# Copy the dashboard server to root
COPY container-dashboard-server.js ./

EXPOSE 5050
ENV NODE_ENV=production

CMD ["node", "container-dashboard-server.js"]
EOF

echo "Corrected Dockerfile created."
echo ""
echo "Upload instructions:"
echo "1. Go to https://github.com/jjcsf/TicketTracker"
echo "2. Click on 'Dockerfile'"
echo "3. Click 'Edit' button (pencil icon)"
echo "4. Replace entire content with Dockerfile.corrected content above"
echo "5. Commit message: 'Fix Dockerfile to use working dashboard server'"
echo "6. Click 'Commit changes'"
echo ""
echo "This changes line 22 from:"
echo "COPY container-complete-server.js ./"
echo "to:"
echo "COPY container-dashboard-server.js ./"
echo ""
echo "GitHub Actions will rebuild and the container will show the working dashboard."