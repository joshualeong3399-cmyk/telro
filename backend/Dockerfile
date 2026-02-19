FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

# Runtime directories
RUN mkdir -p data uploads/audio logs

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]

