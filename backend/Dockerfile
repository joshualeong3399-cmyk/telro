FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

# Runtime directories
RUN mkdir -p data uploads/audio logs

# Create startup script that runs migrate, seed, then starts the app
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "🔄 Running database migration..."' >> /app/start.sh && \
    echo 'node src/db/migrate.js || true' >> /app/start.sh && \
    echo 'echo "🌱 Running database seed..."' >> /app/start.sh && \
    echo 'node src/db/seed.js || true' >> /app/start.sh && \
    echo 'echo "🚀 Starting application..."' >> /app/start.sh && \
    echo 'exec node src/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["/app/start.sh"]

