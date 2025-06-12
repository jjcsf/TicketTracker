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
