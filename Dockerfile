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

# Copy the complete container server to root
COPY container-complete-server.js ./

EXPOSE 5050
ENV NODE_ENV=production

CMD ["node", "container-complete-server.js"]
