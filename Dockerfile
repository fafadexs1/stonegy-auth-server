# syntax=docker/dockerfile:1

# =========================================================================
# Etapa 1: Instalação de Dependências com Cache Inteligente
# =========================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./

RUN --mount=type=cache,target=/root/.npm \
    npm install

# =========================================================================
# Etapa 2: Build do Next.js com Cache Incremental
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
# Etapa 3: Imagem Final de Execução (Ultra Leve ~120MB)
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

# Copia artefatos standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/StonegyStats_PROTECTED.zip ./StonegyStats_PROTECTED.zip

USER nextjs

EXPOSE 2020

# Garante que HOSTNAME seja sempre 0.0.0.0 e a porta seja dinâmica de acordo com o Easypanel
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 PORT=${PORT:-2020} node server.js"]
