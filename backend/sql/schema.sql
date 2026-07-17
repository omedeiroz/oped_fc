/* ============================================================
   Pelada OPED FC - Esquema do banco (OPED_FC)
   Seguro para rodar várias vezes (IF NOT EXISTS).
   Separador de lotes: GO
   ============================================================ */

/* ---------- Usuários (contas de login) ---------- */
IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Nome      NVARCHAR(120) NOT NULL,
        Usuario   NVARCHAR(60)  NULL,   -- login, ex.: "arthur.pereira"
        Email     NVARCHAR(160) NULL,   -- opcional
        SenhaHash NVARCHAR(200) NOT NULL,
        IsAdmin   BIT NOT NULL CONSTRAINT DF_Usuarios_IsAdmin DEFAULT (0),
        Ativo     BIT NOT NULL CONSTRAINT DF_Usuarios_Ativo DEFAULT (1),
        CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Usuarios_CriadoEm DEFAULT (SYSDATETIME())
    );
    CREATE UNIQUE INDEX UX_Usuarios_Usuario ON dbo.Usuarios(Usuario) WHERE Usuario IS NOT NULL;
    CREATE UNIQUE INDEX UX_Usuarios_Email   ON dbo.Usuarios(Email)   WHERE Email IS NOT NULL;
END
GO

/* ---------- Jogadores (elenco; pode estar ligado a um usuário ou ser avulso) ---------- */
IF OBJECT_ID('dbo.Jogadores', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Jogadores (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        Nome      NVARCHAR(120) NOT NULL,
        UsuarioId INT NULL,
        Ativo     BIT NOT NULL CONSTRAINT DF_Jogadores_Ativo DEFAULT (1),
        CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Jogadores_CriadoEm DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Jogadores_Usuarios FOREIGN KEY (UsuarioId)
            REFERENCES dbo.Usuarios (Id)
    );
    CREATE UNIQUE INDEX UX_Jogadores_UsuarioId
        ON dbo.Jogadores (UsuarioId) WHERE UsuarioId IS NOT NULL;
END
GO

/* ---------- Peladas ---------- */
IF OBJECT_ID('dbo.Peladas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Peladas (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        DataPelada  DATE NOT NULL,
        Local       NVARCHAR(160) NULL,
        NumTimes    INT NOT NULL CONSTRAINT DF_Peladas_NumTimes DEFAULT (2),
        Observacao  NVARCHAR(400) NULL,
        Finalizada  BIT NOT NULL CONSTRAINT DF_Peladas_Finalizada DEFAULT (0),
        CriadoPor   INT NULL,
        CriadoEm    DATETIME2 NOT NULL CONSTRAINT DF_Peladas_CriadoEm DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Peladas_Usuarios FOREIGN KEY (CriadoPor)
            REFERENCES dbo.Usuarios (Id)
    );
END
GO

/* ---------- Times de cada pelada ---------- */
IF OBJECT_ID('dbo.PeladaTimes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeladaTimes (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        PeladaId  INT NOT NULL,
        Nome      NVARCHAR(60) NOT NULL,
        Vitorias  INT NOT NULL CONSTRAINT DF_PeladaTimes_Vitorias DEFAULT (0),
        Empates   INT NOT NULL CONSTRAINT DF_PeladaTimes_Empates DEFAULT (0),
        Derrotas  INT NOT NULL CONSTRAINT DF_PeladaTimes_Derrotas DEFAULT (0),
        CONSTRAINT FK_PeladaTimes_Peladas FOREIGN KEY (PeladaId)
            REFERENCES dbo.Peladas (Id)
    );
    CREATE INDEX IX_PeladaTimes_PeladaId ON dbo.PeladaTimes (PeladaId);
END
GO

/* ---------- Participação de cada jogador numa pelada (gols/assistências/time) ---------- */
IF OBJECT_ID('dbo.PeladaParticipacoes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeladaParticipacoes (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        PeladaId     INT NOT NULL,
        JogadorId    INT NOT NULL,
        TimeId       INT NULL,
        Gols         INT NOT NULL CONSTRAINT DF_Part_Gols DEFAULT (0),
        Assistencias INT NOT NULL CONSTRAINT DF_Part_Assist DEFAULT (0),
        CONSTRAINT FK_Part_Peladas FOREIGN KEY (PeladaId)
            REFERENCES dbo.Peladas (Id),
        CONSTRAINT FK_Part_Jogadores FOREIGN KEY (JogadorId)
            REFERENCES dbo.Jogadores (Id),
        CONSTRAINT FK_Part_Times FOREIGN KEY (TimeId)
            REFERENCES dbo.PeladaTimes (Id),
        CONSTRAINT UQ_Part_Pelada_Jogador UNIQUE (PeladaId, JogadorId)
    );
    CREATE INDEX IX_Part_PeladaId ON dbo.PeladaParticipacoes (PeladaId);
    CREATE INDEX IX_Part_JogadorId ON dbo.PeladaParticipacoes (JogadorId);
END
GO

/* ---------- Comentários das peladas ---------- */
IF OBJECT_ID('dbo.PeladaComentarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeladaComentarios (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        PeladaId  INT NOT NULL,
        UsuarioId INT NOT NULL,
        Texto     NVARCHAR(500) NOT NULL,
        CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Coment_CriadoEm DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Coment_Peladas  FOREIGN KEY (PeladaId)  REFERENCES dbo.Peladas (Id),
        CONSTRAINT FK_Coment_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id)
    );
    CREATE INDEX IX_Coment_PeladaId ON dbo.PeladaComentarios (PeladaId);
END
GO

/* ---------- Confirmação de presença (próxima pelada) ---------- */
IF OBJECT_ID('dbo.PeladaPresencas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeladaPresencas (
        Id        INT IDENTITY(1,1) PRIMARY KEY,
        PeladaId  INT NOT NULL,
        JogadorId INT NOT NULL,
        CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Presenca_CriadoEm DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Presenca_Peladas   FOREIGN KEY (PeladaId)  REFERENCES dbo.Peladas (Id),
        CONSTRAINT FK_Presenca_Jogadores FOREIGN KEY (JogadorId) REFERENCES dbo.Jogadores (Id),
        CONSTRAINT UQ_Presenca UNIQUE (PeladaId, JogadorId)
    );
END
GO
