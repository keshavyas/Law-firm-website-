# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Run the app
FROM node:18-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodeuser
RUN apk add --no-cache wget curl netcat-openbsd
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY package*.json ./
RUN mkdir -p uploads && chown -R nodeuser:nodejs /app
USER nodeuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1
COPY --chown=nodeuser:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
CMD ["/bin/sh", "/app/entrypoint.sh"]