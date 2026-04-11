# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY dashboard-next/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard-next/ .
RUN npm run build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)throw r;process.exit(0)}).catch(()=>process.exit(1))"
USER nextjs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
CMD ["node", "server.js"]
