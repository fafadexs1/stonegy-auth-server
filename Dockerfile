# syntax=docker/dockerfile:1

# =========================================================================
# Etapa 1: Instalação de Dependências
# =========================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm install

# =========================================================================
# Etapa 2: Build do Next.js
# =========================================================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# =========================================================================
# Etapa 3: Imagem Final de Execução
# =========================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV HOSTNAME "0.0.0.0"
ENV PORT 2020

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia arquivos estáticos públicos e bundles do Next.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/start.js ./start.js
COPY --from=builder /app/StonegyStats_PROTECTED.zip ./StonegyStats_PROTECTED.zip

# Copia artefatos do Next.js Standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./.next/standalone/public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/standalone/.next/static

USER nextjs

EXPOSE 2020

CMD ["node", "start.js"]
