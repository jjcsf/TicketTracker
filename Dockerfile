FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the container-specific frontend (outputs to dist/public)
RUN npx vite build --config vite.config.container.ts

# Verify frontend build succeeded
RUN ls -la dist/public/ && test -f dist/public/index.html

# Build Docker-specific server without Vite dependencies
RUN npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Remove dev dependencies but keep production ones
RUN npm prune --production

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "dist/docker.js"]