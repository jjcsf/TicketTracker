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

# Copy the container server
COPY server/container-start.js ./server/container-start.js

EXPOSE 5000
ENV NODE_ENV=production

# Use the container server that serves the built React app
CMD ["node", "server/container-start.js"]
