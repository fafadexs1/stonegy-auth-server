# Dockerfile para Stonegy Auth & Leaderboard Server
FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Expor porta da aplicação
EXPOSE 3333

# Variáveis padrão
ENV PORT=3333
ENV NODE_ENV=production

# Iniciar aplicação
CMD ["npm", "start"]
