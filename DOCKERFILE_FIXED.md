# Fixed Dockerfile for Container Station

The build failed because `npm ci --only=production` doesn't install development dependencies needed for Vite build.

## Updated Dockerfile.simple
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files and install ALL dependencies (including dev deps for build)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend
RUN npm run build

# Install additional production dependencies for container server
RUN npm install pg@^8.11.3 cors@^2.8.5

# Copy the interactive container server
COPY container-interactive-server.js ./

EXPOSE 5050
ENV NODE_ENV=production

CMD ["node", "container-interactive-server.js"]
```

## To Deploy
1. Upload updated project files to `/share/Container/projects/SeasonTicketTracker`
2. Ensure the fixed `Dockerfile.simple` is included
3. Use the same local Docker Compose from before
4. Build will now succeed with all dependencies available

The key change: `npm ci` installs all dependencies including Vite and build tools.