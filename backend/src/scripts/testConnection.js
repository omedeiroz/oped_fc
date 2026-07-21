// Testa a conexão com o Postgres (Neon).
// Uso: npm run test:db
const { pool } = require('../db');

(async () => {
  try {
    const r = await pool.query(
      'SELECT current_database() AS banco, current_user AS usuario, version() AS versao'
    );
    const row = r.rows[0];
    console.log('\n✅ Conexão OK!');
    console.log('   Banco   :', row.banco);
    console.log('   Usuário :', row.usuario);
    console.log('   Versão  :', row.versao.split(',')[0]);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Falha na conexão:\n');
    console.error(err.message);
    process.exit(1);
  }
})();
