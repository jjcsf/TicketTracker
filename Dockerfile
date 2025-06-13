FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Build the backend
RUN npm run build

# Install production dependencies only
RUN npm ci --only=production

EXPOSE 5050

ENV NODE_ENV=production

CMD ["npm", "start"]