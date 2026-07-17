# ⚽ Pelada OPED FC

Site para gerenciar as peladas do pessoal do trabalho: cadastro de jogadores, registro de peladas (times, gols, assistências, vitórias) e rankings (artilheiros, garçons, vitórias, presença).

- **Frontend:** React + Vite (tema "Noite de Jogo" — âmbar sobre preto, inspirado no CAEd)
- **Backend:** Node.js + Express
- **Banco:** SQL Server (`OPED_FC`) com **Autenticação do Windows** (Trusted Connection via driver ODBC)

---

## Pré-requisitos

- **Node.js 18+** (testado no Node 24)
- **ODBC Driver for SQL Server** instalado (17 ou 18). Já detectado automaticamente.
- Acesso de rede ao servidor `192.168.250.8,61433` e permissão no banco `OPED_FC`
  com o **usuário Windows que roda o backend** (o backend conecta como esse usuário).

---

## Como rodar

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env      # ajuste se necessário
npm run init:db           # cria as tabelas (idempotente)
npm start                 # sobe a API em http://localhost:4000
```

Scripts úteis:
- `npm run test:db` — testa a conexão com o SQL Server
- `npm run init:db` — cria/garante as tabelas
- `node src/scripts/promoteAdmin.js email@dominio.com` — torna um usuário admin

### 2) Frontend
```bash
cd frontend
npm install
npm run dev               # abre em http://localhost:5180
```

Abra **http://localhost:5180** no navegador.

> O Vite já faz proxy de `/api` para o backend (porta 4000), então não há problema de CORS no dev.

---

## Primeiro acesso

- O **primeiro usuário cadastrado** vira **admin** automaticamente.
- Depois disso, o admin pode promover outros pela tela **Usuários**.

---

## Fluxo de uso

1. **Cadastro/Login** — todos criam conta. Ao se cadastrar, a pessoa já vira um "jogador" e aparece nas sugestões.
2. **Nova pelada (admin)** — escolhe a data, o número de times, relaciona os jogadores
   (sugeridos dos cadastrados **ou** adiciona um avulso), clica em **🎲 Sortear times**
   e preenche gols/assistências de cada um e vitórias/empates/derrotas de cada time.
3. **Ranking** — todos veem os acumulados: artilheiros, garçons, vitórias e presença.

---

## Estrutura

```
peladaOPED/
├── backend/
│   ├── sql/schema.sql            # esquema do banco
│   └── src/
│       ├── db.js                 # conexão SQL Server (Windows Auth)
│       ├── server.js             # app Express
│       ├── middleware/auth.js    # JWT + requireAdmin
│       ├── routes/               # auth, jogadores, usuarios, peladas, stats
│       └── scripts/              # testConnection, initDb, promoteAdmin
└── frontend/
    └── src/
        ├── theme.css             # paleta "Verde Campo"
        ├── api.js                # cliente HTTP
        ├── auth.jsx              # contexto de autenticação
        ├── components/           # Layout
        └── pages/                # Login, Dashboard, Peladas, PeladaDetalhe, PeladaForm, AdminUsuarios
```

## Modelo de dados (tabelas em `OPED_FC`)

| Tabela | Papel |
|---|---|
| `Usuarios` | Contas de login (email + senha, `IsAdmin`) |
| `Jogadores` | Elenco. Pode estar ligado a um `Usuario` ou ser **avulso** (sem login) |
| `Peladas` | Cada pelada (data, local, nº de times) |
| `PeladaTimes` | Times de cada pelada (vitórias/empates/derrotas) |
| `PeladaParticipacoes` | Jogador × pelada × time, com gols e assistências |
| `PeladaComentarios` | Comentários dos usuários em cada pelada |
| `PeladaPresencas` | Confirmação de presença na próxima pelada |
