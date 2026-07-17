// Cria as tabelas no banco OPED_FC executando sql/schema.sql.
// Idempotente (usa IF NOT EXISTS). Uso: npm run init:db
const fs = require('fs');
const path = require('path');
const { getPool } = require('../db');

(async () => {
  try {
    const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
    const raw = fs.readFileSync(schemaPath, 'utf8');

    // Divide em lotes por linhas contendo apenas GO
    const batches = raw
      .split(/^\s*GO\s*$/gim)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const pool = await getPool();
    for (let i = 0; i < batches.length; i++) {
      await pool.request().batch(batches[i]);
      console.log(`[init:db] Lote ${i + 1}/${batches.length} executado.`);
    }

    // Confere tabelas criadas
    const r = await pool.request().query(
      "SELECT name FROM sys.tables WHERE name IN " +
        "('Usuarios','Jogadores','Peladas','PeladaTimes','PeladaParticipacoes') ORDER BY name"
    );
    console.log('\n✅ Tabelas presentes no OPED_FC:');
    r.recordset.forEach((t) => console.log('   -', t.name));
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro ao inicializar o banco:\n', err.message);
    process.exit(1);
  }
})();
