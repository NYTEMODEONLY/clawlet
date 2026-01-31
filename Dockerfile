# Clawlet Docker Image
# For deploying AI agent wallets in containers

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Default environment
ENV CLAWLET_NETWORK=mainnet

# Entry point - can be overridden
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]
