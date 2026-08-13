# syntax=docker/dockerfile:1

# =========================================================================
# Etapa 1: Instalação de Dependências com Cache
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

COPY --from=builder /app/public ./public
COPY --from=builder /app/start.js ./start.js

# Copia arquivos do standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/StonegyStats_PROTECTED.zip ./StonegyStats_PROTECTED.zip

USER nextjs

EXPOSE 2020

CMD ["node", "start.js"]
