FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend (outputs to dist/public)
RUN npm run build

# Build Docker-specific server without Vite dependencies
RUN npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Verify build outputs exist
RUN ls -la dist/
RUN ls -la dist/public/ || echo "No public directory found"

# Remove dev dependencies but keep production ones
RUN npm prune --production

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "dist/docker.js"]