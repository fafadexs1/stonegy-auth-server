# ⚔️ Stonegy Pro Tracker - Next.js Auth Server & Updates Hub

Backend de Autenticação, Leaderboards e Website Oficial de Atualizações desenvolvido em **Next.js (App Router)** com **PostgreSQL** e suporte a deploy via **Docker / Easypanel**.

---

## 🌐 Domínios do Sistema

* 🔑 **Auth API**: `https://authtibia.klyraai.com.br`
* 🚀 **Website Oficial & Updates**: `https://tibiaonline.dialogy.klyraai.com.br`
* 🎮 **Jogo Stonegy Online**: `https://stonegy-online.com`

---

## 🐳 Como Implantar no Easypanel (Next.js)

1. No **Easypanel**, clique em **"+ Service"** (ou **"+ New App"**) ➔ **"App from Git"**.
2. Selecione o repositório: **`fafadexs1/stonegy-auth-server`** (branch `main`).
3. Em **Build Settings**:
   * **Build Type**: `Dockerfile`
   * **Port**: `3333`
4. Em **Environment (Variáveis de Ambiente)**:
   ```env
   PORT=3333
   NODE_ENV=production
   DATABASE_URL=postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable
   SALT=_stonegy_salt_2026
   AUTH_URL=https://authtibia.klyraai.com.br
   WEBSITE_URL=https://tibiaonline.dialogy.klyraai.com.br
   TARGET_GAME_URL=https://stonegy-online.com
   ```
5. Em **Domains (Domínios)**, adicione:
   * **`authtibia.klyraai.com.br`**
   * **`tibiaonline.dialogy.klyraai.com.br`**
6. Clique em **Deploy**.

---

## 🚀 Páginas e Recursos

* `/` ➔ Página inicial oficial com histórico de versões, download direto da extensão e status da conexão.
* `/admin` ➔ Painel administrativo para publicar novas atualizações com changelog e notificações em tempo real para as extensões dos jogadores.
* `/download/latest` ➔ Download direto do pacote ZIP protegido da extensão (`StonegyStats_PROTECTED.zip`).
* `/api/*` ➔ Rotas de API completas com CORS liberado para o jogo (`login`, `register`, `verify`, `hunt/record`, `hunt/leaderboard`, `version/check`).
