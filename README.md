# ⚔️ Stonegy Auth & Leaderboard Server

Backend de Autenticação, Gerenciamento de Sessões e Leaderboard para a extensão **Stonegy Pro Tracker**, com persistência no **PostgreSQL** e suporte a deploy via **Docker / Easypanel**.

---

## 🌐 Domínio de Produção
* **URL:** `https://authtibia.klyraai.com.br`

---

## 🚀 Como subir para o seu GitHub (Passo a Passo)

Abra o terminal dentro da pasta `StonegyAuthServer` e execute:

```bash
git init
git add .
git commit -m "feat: Stonegy Auth Server com Postgres e Docker para Easypanel"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/stonegy-auth-server.git
git push -u origin main
```

*(Substitua `https://github.com/SEU_USUARIO/stonegy-auth-server.git` pelo link do seu repositório criado no GitHub).*

---

## 📦 Como implantar no Easypanel (VPS)

1. No painel do seu **Easypanel**, clique em **"+ New App"** -> **"App from Git"**.
2. Cole o link do seu repositório do GitHub (ou configure via Deploy Key/GitHub App).
3. Em **Build Settings**:
   * **Build Type**: `Dockerfile` ou `Nixpacks`
   * **Port**: `3333`
4. Em **Environment (Variáveis de Ambiente)**, adicione:
   ```env
   PORT=3333
   DATABASE_URL=postgres://postgres:d409ep9pbk6sz698cyd8@easypanel.vps1.klyraai.com.br:4264/nexusflow?sslmode=disable
   SALT=_stonegy_salt_2026
   ```
5. Em **Domains (Domínios)**:
   * Adicione o domínio: `authtibia.klyraai.com.br`
   * Certifique-se de que o DNS do domínio `authtibia.klyraai.com.br` (Registro tipo **A**) aponta para o IP da sua VPS.
6. Clique em **Deploy**.

---

## 🧪 Endpoints da API

* `GET /` -> Status do servidor.
* `GET /api/health` -> Diagnóstico e status da conexão com o PostgreSQL em tempo real.
* `POST /api/login` -> Autenticação de usuário com hash SHA-256 e emissão de token.
* `POST /api/register` -> Criação de nova conta com plano VIP PRO.
* `POST /api/verify` -> Validação de token de sessão ativa.
* `POST /api/hunt/record` -> Gravação de relatório de hunt no banco.
* `GET /api/hunt/leaderboard` -> Ranking dos Top 10 Hunters do servidor.
