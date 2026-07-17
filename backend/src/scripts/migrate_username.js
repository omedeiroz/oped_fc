// Migração: adiciona coluna de login por usuário (ex.: "arthur.pereira")
// e torna o email opcional. Idempotente. Uso: node src/scripts/migrate_username.js
const { getPool } = require('../db');

const steps = [
  // 1) Coluna Usuario
  `IF COL_LENGTH('dbo.Usuarios','Usuario') IS NULL
     ALTER TABLE dbo.Usuarios ADD Usuario NVARCHAR(60) NULL;`,
  // 2) Remove UNIQUE antigo do email (vira índice filtrado, permitindo emails nulos)
  `IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_Usuarios_Email')
     ALTER TABLE dbo.Usuarios DROP CONSTRAINT UQ_Usuarios_Email;`,
  // 3) Email passa a aceitar NULL
  `ALTER TABLE dbo.Usuarios ALTER COLUMN Email NVARCHAR(160) NULL;`,
  // 4) Índices únicos filtrados
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Usuarios_Usuario')
     CREATE UNIQUE INDEX UX_Usuarios_Usuario ON dbo.Usuarios(Usuario) WHERE Usuario IS NOT NULL;`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Usuarios_Email')
     CREATE UNIQUE INDEX UX_Usuarios_Email ON dbo.Usuarios(Email) WHERE Email IS NOT NULL;`,
];

(async () => {
  try {
    const pool = await getPool();
    for (let i = 0; i < steps.length; i++) {
      await pool.request().batch(steps[i]);
      console.log(`[migrate] passo ${i + 1}/${steps.length} ok`);
    }
    console.log('\n✅ Migração concluída.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
})();
