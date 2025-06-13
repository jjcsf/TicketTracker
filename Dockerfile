FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend with local auth environment
ENV NODE_ENV=production
ENV VITE_AUTH_TYPE=local
RUN npm run build

# Verify frontend build succeeded
RUN ls -la dist/ && test -f dist/index.html

# Build the container-specific server
RUN npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Remove dev dependencies but keep production ones
RUN npm prune --production

EXPOSE 5050

ENV NODE_ENV=production

CMD ["node", "dist/docker.js"]