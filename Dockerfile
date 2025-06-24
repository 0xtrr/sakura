# Multi-stage build for React app
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - minimal static file server
FROM node:18-alpine AS production

# Install a simple HTTP server
RUN npm install -g serve@14

# Set working directory
WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port 3000
EXPOSE 3000

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "3000"]