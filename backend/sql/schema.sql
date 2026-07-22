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

CREATE TABLE IF NOT EXISTS "Jogadores" (
    "Id"        SERIAL PRIMARY KEY,
    "Nome"      VARCHAR(120) NOT NULL,
    "UsuarioId" INT REFERENCES "Usuarios"("Id"),
    "Ativo"     BOOLEAN NOT NULL DEFAULT TRUE,
    "CriadoEm"  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Jogadores_UsuarioId" ON "Jogadores"("UsuarioId") WHERE "UsuarioId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Peladas" (
    "Id"         SERIAL PRIMARY KEY,
    "DataPelada" DATE NOT NULL,
    "Local"      VARCHAR(160),
    "NumTimes"   INT NOT NULL DEFAULT 2,
    "Observacao" VARCHAR(400),
    "Finalizada" BOOLEAN NOT NULL DEFAULT FALSE,
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
