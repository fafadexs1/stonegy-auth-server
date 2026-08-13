# syntax=docker/dockerfile:1

# =========================================================================
# Etapa 1: Instalação de Dependências com Cache Inteligente
# =========================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copia apenas os manifestos de dependência primeiro para aproveitar o cache do Docker.
# Se o package.json não mudar, o Docker NÃO baixa nada novamente!
COPY package.json package-lock.json* ./

# Utiliza cache mount no diretório do npm para reutilizar downloads entre builds
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

# Utiliza cache mount no .next/cache para compilações incrementais ultra-rápidas
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# =========================================================================
# Etapa 3: Imagem Final de Execução (Ultra Leve ~120MB)
# =========================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 2020
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copia os artefatos standalone otimizados
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/StonegyStats_PROTECTED.zip ./StonegyStats_PROTECTED.zip

USER nextjs

EXPOSE 2020

CMD ["node", "server.js"]
