# Multi-stage build for React app
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - serve with Node.js
FROM node:18-alpine AS production

# Install a simple HTTP server
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 3000
EXPOSE 3000

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "3000"]