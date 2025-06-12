<<<<<<< HEAD
# --- Build Stage ---
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Build the frontend and server
RUN npm run build

# --- Production Stage ---
FROM node:20-slim

WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built app and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Set environment and expose port
ENV NODE_ENV=production
EXPOSE 5000

# Start the server
CMD ["node", "server/container-start.js"]
=======
FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

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

# Use the interactive container server that handles React routing
CMD ["node", "container-interactive-server.js"]
>>>>>>> 21aa58d (Initial commit)
