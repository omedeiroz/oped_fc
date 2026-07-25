/* ============================================================
   Pelada OPED FC - Esquema Postgres (Neon)
   Identificadores entre aspas duplas para preservar o PascalCase
   exato que a API/frontend já esperam (ex.: "DataPelada", "IsAdmin").
   Idempotente: seguro rodar várias vezes.
   ============================================================ */

CREATE TABLE IF NOT EXISTS "Usuarios" (
    "Id"        SERIAL PRIMARY KEY,
    "Nome"      VARCHAR(120) NOT NULL,
    "Usuario"   VARCHAR(60),
    "Email"     VARCHAR(160),
    "SenhaHash" VARCHAR(200) NOT NULL,
    "IsAdmin"   BOOLEAN NOT NULL DEFAULT FALSE,
    "Ativo"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CriadoEm"  TIMESTAMP NOT NULL DEFAULT NOW(),
    "Foto"      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Usuarios_Usuario" ON "Usuarios"("Usuario") WHERE "Usuario" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Usuarios_Email"   ON "Usuarios"("Email")   WHERE "Email" IS NOT NULL;

-- Apostas: saldo de fichas fictícias de cada usuário e quem administra apostas
-- (permissão separada do IsAdmin — só quem tiver IsBetAdmin mexe em odds/saldo/resolução manual).
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "SaldoFichas" INT NOT NULL DEFAULT 1000;
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS "IsBetAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS "Jogadores" (
    "Id"        SERIAL PRIMARY KEY,
    "Nome"      VARCHAR(120) NOT NULL,
    "UsuarioId" INT REFERENCES "Usuarios"("Id"),
    "Ativo"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CriadoEm"  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Jogadores_UsuarioId" ON "Jogadores"("UsuarioId") WHERE "UsuarioId" IS NOT NULL;

-- Tier do jogador (S+, A, B) — usado só para sugerir a odd inicial dos mercados de aposta.
ALTER TABLE "Jogadores" ADD COLUMN IF NOT EXISTS "Tier" VARCHAR(2) NOT NULL DEFAULT 'B';

CREATE TABLE IF NOT EXISTS "Peladas" (
    "Id"         SERIAL PRIMARY KEY,
    "DataPelada" DATE NOT NULL,
    "Local"      VARCHAR(160),
    "NumTimes"   INT NOT NULL DEFAULT 2,
    "Observacao" VARCHAR(400),
    "Finalizada" BOOLEAN NOT NULL DEFAULT FALSE,
    "EstatisticasIniciadas" BOOLEAN NOT NULL DEFAULT FALSE,
    "CriadoPor"  INT REFERENCES "Usuarios"("Id"),
    "CriadoEm"   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PeladaTimes" (
    "Id"       SERIAL PRIMARY KEY,
    "PeladaId" INT NOT NULL REFERENCES "Peladas"("Id"),
    "Nome"     VARCHAR(60) NOT NULL,
    "Vitorias" INT NOT NULL DEFAULT 0,
    "Empates"  INT NOT NULL DEFAULT 0,
    "Derrotas" INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "IX_PeladaTimes_PeladaId" ON "PeladaTimes"("PeladaId");

CREATE TABLE IF NOT EXISTS "PeladaParticipacoes" (
    "Id"           SERIAL PRIMARY KEY,
    "PeladaId"     INT NOT NULL REFERENCES "Peladas"("Id"),
    "JogadorId"    INT NOT NULL REFERENCES "Jogadores"("Id"),
    "TimeId"       INT REFERENCES "PeladaTimes"("Id"),
    "Gols"         INT NOT NULL DEFAULT 0,
    "Assistencias" INT NOT NULL DEFAULT 0,
    CONSTRAINT "UQ_Part_Pelada_Jogador" UNIQUE ("PeladaId", "JogadorId")
);
CREATE INDEX IF NOT EXISTS "IX_Part_PeladaId"  ON "PeladaParticipacoes"("PeladaId");
CREATE INDEX IF NOT EXISTS "IX_Part_JogadorId" ON "PeladaParticipacoes"("JogadorId");

CREATE TABLE IF NOT EXISTS "PeladaComentarios" (
    "Id"        SERIAL PRIMARY KEY,
    "PeladaId"  INT NOT NULL REFERENCES "Peladas"("Id"),
    "UsuarioId" INT NOT NULL REFERENCES "Usuarios"("Id"),
    "Texto"     VARCHAR(500) NOT NULL,
    "CriadoEm"  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "IX_Coment_PeladaId" ON "PeladaComentarios"("PeladaId");

CREATE TABLE IF NOT EXISTS "PeladaPresencas" (
    "Id"        SERIAL PRIMARY KEY,
    "PeladaId"  INT NOT NULL REFERENCES "Peladas"("Id"),
    "JogadorId" INT NOT NULL REFERENCES "Jogadores"("Id"),
    "CriadoEm"  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "UQ_Presenca" UNIQUE ("PeladaId", "JogadorId")
);

-- Avaliação de 0.5 a 5 estrelas (MVP/LVP): cada jogador avalia os demais
-- participantes de uma pelada finalizada, exceto a si mesmo.
CREATE TABLE IF NOT EXISTS "PeladaVotos" (
    "Id"                SERIAL PRIMARY KEY,
    "PeladaId"          INT NOT NULL REFERENCES "Peladas"("Id"),
    "VotanteJogadorId"  INT NOT NULL REFERENCES "Jogadores"("Id"),
    "AvaliadoJogadorId" INT NOT NULL REFERENCES "Jogadores"("Id"),
    "Nota"              NUMERIC(2,1) NOT NULL,
    "CriadoEm"          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "UQ_Voto" UNIQUE ("PeladaId", "VotanteJogadorId", "AvaliadoJogadorId"),
    CONSTRAINT "CK_Voto_NaoSelf" CHECK ("VotanteJogadorId" <> "AvaliadoJogadorId"),
    CONSTRAINT "CK_Voto_Nota" CHECK ("Nota" IN (0.5,1,1.5,2,2.5,3,3.5,4,4.5,5))
);
CREATE INDEX IF NOT EXISTS "IX_Voto_PeladaId" ON "PeladaVotos"("PeladaId");

/* ============================================================
   Apostas — fichas fictícias em cima de estatísticas da pelada.
   ============================================================ */

-- Catálogo de categorias de aposta (Gol, Assistência, Defesa, Gol Contra, Cair no
-- Chão, ...). AutoResolve = true significa que o próprio sistema liquida a partir das
-- estatísticas da pelada (hoje só Gols/Assistencias existem); o resto é resolvido
-- manualmente por quem tiver IsBetAdmin. OddSPlus/OddA/OddB são a odd sugerida ao
-- criar o mercado, de acordo com o tier do jogador — só um ponto de partida editável.
CREATE TABLE IF NOT EXISTS "TiposAposta" (
    "Id"          SERIAL PRIMARY KEY,
    "Nome"        VARCHAR(60) NOT NULL,
    "Chave"       VARCHAR(30) NOT NULL,
    "AutoResolve" BOOLEAN NOT NULL DEFAULT FALSE,
    "OddSPlus"    NUMERIC(5,2) NOT NULL DEFAULT 3.00,
    "OddA"        NUMERIC(5,2) NOT NULL DEFAULT 4.00,
    "OddB"        NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    "Ativo"       BOOLEAN NOT NULL DEFAULT TRUE,
    "CriadoEm"    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_TiposAposta_Chave" ON "TiposAposta"("Chave");

-- Um mercado por (pelada, jogador, categoria). Gerado automaticamente quando a
-- pelada é criada/editada (Parte 1), com a odd sugerida pelo tier do jogador.
CREATE TABLE IF NOT EXISTS "PeladaApostaMercados" (
    "Id"           SERIAL PRIMARY KEY,
    "PeladaId"     INT NOT NULL REFERENCES "Peladas"("Id"),
    "JogadorId"    INT NOT NULL REFERENCES "Jogadores"("Id"),
    "TipoApostaId" INT NOT NULL REFERENCES "TiposAposta"("Id"),
    "Odd"          NUMERIC(5,2) NOT NULL,
    "Resolvido"    BOOLEAN NOT NULL DEFAULT FALSE,
    "Resultado"    BOOLEAN,
    "ResolvidoEm"  TIMESTAMP,
    "CriadoEm"     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "UQ_Mercado" UNIQUE ("PeladaId", "JogadorId", "TipoApostaId")
);
CREATE INDEX IF NOT EXISTS "IX_Mercado_PeladaId" ON "PeladaApostaMercados"("PeladaId");

-- Aposta individual: uma por usuário por mercado. A odd é congelada no momento da
-- aposta (editar a odd do mercado depois não afeta quem já apostou).
CREATE TABLE IF NOT EXISTS "PeladaApostas" (
    "Id"          SERIAL PRIMARY KEY,
    "MercadoId"   INT NOT NULL REFERENCES "PeladaApostaMercados"("Id"),
    "UsuarioId"   INT NOT NULL REFERENCES "Usuarios"("Id"),
    "Valor"       INT NOT NULL CHECK ("Valor" > 0),
    "Odd"         NUMERIC(5,2) NOT NULL,
    "Status"      VARCHAR(10) NOT NULL DEFAULT 'pendente',
    "Premio"      INT,
    "CriadoEm"    TIMESTAMP NOT NULL DEFAULT NOW(),
    "ResolvidoEm" TIMESTAMP,
    CONSTRAINT "UQ_Aposta_Usuario_Mercado" UNIQUE ("MercadoId", "UsuarioId")
);
CREATE INDEX IF NOT EXISTS "IX_Aposta_UsuarioId" ON "PeladaApostas"("UsuarioId");

-- Ledger de auditoria de toda mudança de saldo (ajuste manual, aposta, prêmio).
CREATE TABLE IF NOT EXISTS "FichasTransacoes" (
    "Id"          SERIAL PRIMARY KEY,
    "UsuarioId"   INT NOT NULL REFERENCES "Usuarios"("Id"),
    "Valor"       INT NOT NULL,
    "Tipo"        VARCHAR(20) NOT NULL,
    "ApostaId"    INT REFERENCES "PeladaApostas"("Id"),
    "Descricao"   VARCHAR(200),
    "CriadoEm"    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "IX_Transacao_UsuarioId" ON "FichasTransacoes"("UsuarioId");
