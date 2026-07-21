// Cria as tabelas no Postgres (Neon) executando sql/schema.sql.
// Idempotente (usa IF NOT EXISTS). Uso: npm run init:db
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

(async () => {
  try {
    const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
    const sqlText = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(sqlText);

    const r = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    console.log('\n✅ Tabelas presentes no banco:');
    r.rows.forEach((t) => console.log('   -', t.tablename));
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro ao inicializar o banco:\n', err.message);
    process.exit(1);
  }
})();
