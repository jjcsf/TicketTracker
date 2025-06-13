#!/bin/bash

echo "Creating GitHub repository fix..."

# Create the corrected Dockerfile content
cat > github-dockerfile-fix.txt << 'EOF'
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

echo "✓ GitHub Dockerfile fix created"
echo ""
echo "IMMEDIATE ACTION REQUIRED:"
echo "1. Open https://github.com/jjcsf/TicketTracker/blob/main/Dockerfile"
echo "2. Click 'Edit this file' (pencil icon)"
echo "3. Replace entire content with github-dockerfile-fix.txt above"
echo "4. Commit message: 'Fix container to use working dashboard server'"
echo "5. Click 'Commit changes'"
echo ""
echo "CRITICAL CHANGE:"
echo "Line 22 changes from: COPY container-complete-server.js ./"
echo "Line 22 changes to:   COPY container-dashboard-server.js ./"
echo ""
echo "This will trigger GitHub Actions to rebuild with the working dashboard."
echo "After rebuild (5-10 minutes), your container will show the full interactive dashboard."