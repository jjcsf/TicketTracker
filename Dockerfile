# Use a more compatible base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Build the frontend (if applicable)
RUN npm run build

# Install additional production dependencies
RUN npm install pg@^8.11.3 cors@^2.8.5

# Ensure the container-start.js file exists and is copied correctly
# Adjust the path if it's located in a subdirectory
COPY server/container-start.js ./server/container-start.js

# Set environment and expose port
ENV NODE_ENV=production
EXPOSE 5000

# Start the server
CMD ["node", "server/container-start.js"]

