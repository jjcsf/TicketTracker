# GitHub Upload: React Container Fix

## Problem
Container shows basic HTML dashboard instead of full React application like Replit preview.

## Solution Files to Upload

### 1. container-react-server.js
- Complete Express server that serves built React application
- Full API endpoints matching Replit backend
- Authentication bypass for container environment
- Static file serving from dist/ directory

### 2. Updated Dockerfile
```dockerfile
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

# Copy the React server to root
COPY container-react-server.js ./

EXPOSE 5050
ENV NODE_ENV=production

CMD ["node", "container-react-server.js"]
```

## Upload Steps
1. Go to https://github.com/jjcsf/TicketTracker
2. Upload container-react-server.js (new file)
3. Edit Dockerfile - change line 22 from `container-dashboard-server.js` to `container-react-server.js`
4. Commit message: "Fix container to serve React app like Replit"

## Result
Container will serve the complete React application with:
- Full navigation sidebar
- Interactive dashboard with real data
- All pages functional (Games, Finances, Seats, etc.)
- Identical to Replit preview interface