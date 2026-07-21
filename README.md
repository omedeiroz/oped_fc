# ⚽ Pelada OPED FC

Site para gerenciar as peladas do pessoal do trabalho: cadastro de jogadores, registro de peladas (times, gols, assistências, vitórias), rankings (artilheiros, garçons, vitórias, presença), confirmação de presença, comentários e perfil com foto.

- **Frontend:** React + Vite (tema "Esportivo/Energético" — laranja/lime sobre navy, com alternância light/dark)
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL (Neon), via `@neondatabase/serverless` (tuneliza o protocolo Postgres por WebSocket na porta 443 — importante em redes corporativas que bloqueiam a porta 5432)

---

## Pré-requisitos

- **Node.js 18+** (testado no Node 24)
- Uma connection string do [Neon](https://neon.tech) (ou outro Postgres compatível)

---

## Como rodar

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env      # preencha DATABASE_URL com sua connection string do Neon
npm run init:db           # cria as tabelas (idempotente)
npm start                 # sobe a API em http://localhost:4000
```

Scripts úteis:
- `npm run test:db` — testa a conexão com o Postgres
- `npm run init:db` — cria/garante as tabelas
- `node src/scripts/promoteAdmin.js nome.usuario` — torna um usuário admin

### 2) Frontend
```bash
cd frontend
npm install
npm run dev               # abre em http://localhost:5180
```

Abra **http://localhost:5180** no navegador.

> O Vite já faz proxy de `/api` para o backend (porta 4000), então não há problema de CORS no dev.
> O Vite também escuta em `0.0.0.0` (`host: true`), então dá para acessar pelo IP da máquina na rede local (ex.: `http://192.168.x.x:5180`) — útil para o pessoal do trabalho testar.

---

## Deploy em produção (Render + Vercel)

Banco já é remoto (Neon), então dá pra publicar o site inteiro na nuvem — não depende de nenhuma máquina ficar ligada.

### Backend → Render
1. Crie uma conta em [render.com](https://render.com) e conecte o GitHub.
2. **New → Blueprint**, aponte para este repositório — o Render lê o `render.yaml` da raiz automaticamente.
3. Preencha os secrets pedidos: `DATABASE_URL` (a connection string do Neon), `JWT_SECRET`, e `CORS_ORIGIN` (pode deixar só com o `localhost` por enquanto — a Vercel é liberada automaticamente via regex `*.vercel.app`).
4. Copie a URL pública gerada (ex.: `https://pelada-oped-backend.onrender.com`).

> No plano free do Render, o serviço "dorme" após um tempo sem uso e demora ~30s para acordar na primeira requisição depois disso.

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
```
Configure a env var `VITE_API_URL` no projeto da Vercel apontando para `https://SEU-BACKEND.onrender.com/api` (a URL do passo anterior) e faça o redeploy.

---

## Primeiro acesso

- Login é feito por **usuário** (ex.: `arthur.pereira`), não por email — email é opcional no cadastro.
- O **primeiro usuário cadastrado** vira **admin** automaticamente.
- Depois disso, o admin pode promover/remover outros admins e excluir usuários pela tela **Usuários**.

---

## Fluxo de uso

1. **Cadastro/Login** — todos criam conta com usuário + senha. Ao se cadastrar, a pessoa já vira um "jogador" e aparece nas sugestões.
2. **Nova pelada (admin)** — wizard de 4 etapas: dados básicos → jogadores (sugeridos dos cadastrados **ou** avulso) → **🎲 Sortear times** → revisão. Preenche gols/assistências de cada um e vitórias/empates/derrotas de cada time.
3. **Ranking** — todos veem os acumulados: artilheiros, garçons, vitórias e presença.
4. **Peladas** — banner da próxima pelada com confirmação de presença; detalhe de cada pelada tem placar, MVP e comentários.
5. **Perfil** — cada jogador tem uma página com foto (upload com redimensionamento no navegador) e histórico pessoal de peladas.

---

## Estrutura

```
peladaOPED/
├── backend/
│   ├── sql/schema.sql            # esquema do banco (Postgres)
│   └── src/
│       ├── db.js                 # pool Postgres (Neon serverless) + helper de transação
│       ├── server.js             # app Express
│       ├── middleware/auth.js    # JWT + requireAdmin
│       ├── routes/               # auth, jogadores, usuarios, peladas, stats
│       └── scripts/              # testConnection, initDb, promoteAdmin
└── frontend/
    └── src/
        ├── theme.css             # paleta "Esportivo/Energético" (light + dark)
        ├── api.js                # cliente HTTP
        ├── auth.jsx              # contexto de autenticação
        ├── utils.js              # avatares, datas, redimensionar imagem
        ├── components/           # Layout (navbar + toggle de tema)
        └── pages/                # Login, Dashboard, Peladas, PeladaDetalhe, PeladaForm, AdminUsuarios, Perfil
```

## Modelo de dados

| Tabela | Papel |
|---|---|
| `Usuarios` | Contas de login (usuário + senha, email opcional, `IsAdmin`, `Foto`) |
| `Jogadores` | Elenco. Pode estar ligado a um `Usuario` ou ser **avulso** (sem login) |
| `Peladas` | Cada pelada (data, local, nº de times) |
| `PeladaTimes` | Times de cada pelada (vitórias/empates/derrotas) |
| `PeladaParticipacoes` | Jogador × pelada × time, com gols e assistências |
| `PeladaComentarios` | Comentários dos usuários em cada pelada |
| `PeladaPresencas` | Confirmação de presença na próxima pelada |
