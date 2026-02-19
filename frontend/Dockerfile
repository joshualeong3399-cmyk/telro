FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Accept build-time env vars for Vite
ARG VITE_API_URL=http://localhost/api
ARG VITE_WS_URL=http://localhost
ARG VITE_ASTERISK_HOST=localhost
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_ASTERISK_HOST=$VITE_ASTERISK_HOST

RUN npm run build

# ---- Production stage ----
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]

