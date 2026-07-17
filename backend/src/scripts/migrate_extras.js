// Migração: tabelas de comentários e confirmação de presença. Idempotente.
// Uso: node src/scripts/migrate_extras.js
const { getPool } = require('../db');

const steps = [
  `IF OBJECT_ID('dbo.PeladaComentarios','U') IS NULL
   CREATE TABLE dbo.PeladaComentarios (
     Id        INT IDENTITY(1,1) PRIMARY KEY,
     PeladaId  INT NOT NULL,
     UsuarioId INT NOT NULL,
     Texto     NVARCHAR(500) NOT NULL,
     CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Coment_CriadoEm DEFAULT (SYSDATETIME()),
     CONSTRAINT FK_Coment_Peladas  FOREIGN KEY (PeladaId)  REFERENCES dbo.Peladas(Id),
     CONSTRAINT FK_Coment_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id)
   );`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Coment_PeladaId')
   CREATE INDEX IX_Coment_PeladaId ON dbo.PeladaComentarios(PeladaId);`,
  `IF OBJECT_ID('dbo.PeladaPresencas','U') IS NULL
   CREATE TABLE dbo.PeladaPresencas (
     Id        INT IDENTITY(1,1) PRIMARY KEY,
     PeladaId  INT NOT NULL,
     JogadorId INT NOT NULL,
     CriadoEm  DATETIME2 NOT NULL CONSTRAINT DF_Presenca_CriadoEm DEFAULT (SYSDATETIME()),
     CONSTRAINT FK_Presenca_Peladas   FOREIGN KEY (PeladaId)  REFERENCES dbo.Peladas(Id),
     CONSTRAINT FK_Presenca_Jogadores FOREIGN KEY (JogadorId) REFERENCES dbo.Jogadores(Id),
     CONSTRAINT UQ_Presenca UNIQUE (PeladaId, JogadorId)
   );`,
];

(async () => {
  try {
    const pool = await getPool();
    for (let i = 0; i < steps.length; i++) {
      await pool.request().batch(steps[i]);
      console.log(`[migrate:extras] passo ${i + 1}/${steps.length} ok`);
    }
    console.log('\n✅ Tabelas de comentários e presenças prontas.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
