# Multi-stage lightweight production image
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install dependencies first for better caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application files
COPY server.js data.js app.js router.js api-client.js index.html style.css ./
COPY routes/ ./routes/
COPY data/ ./data/

# Ensure directory permissions for node user
RUN chown -R node:node /app

# Run as non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
