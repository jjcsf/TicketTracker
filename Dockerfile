FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend with production settings
ENV VITE_AUTH_TYPE=local
RUN npm run build

# Verify frontend build succeeded  
RUN ls -la dist/ && test -f dist/index.html

# Create public directory structure for container serving
RUN mkdir -p dist/public && cp -r dist/* dist/public/ && ls -la dist/public/

# Build Docker-specific server without Vite dependencies
RUN npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Remove dev dependencies but keep production ones
RUN npm prune --production

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "dist/docker.js"]