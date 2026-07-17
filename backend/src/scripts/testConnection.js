// Testa a conexão com o SQL Server via Windows Auth.
// Uso: npm run test:db
const { getPool } = require('../db');

(async () => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT SUSER_SNAME() AS usuario_windows, DB_NAME() AS banco, @@VERSION AS versao"
    );
    const row = r.recordset[0];
    console.log('\n✅ Conexão OK!');
    console.log('   Usuário Windows :', row.usuario_windows);
    console.log('   Banco           :', row.banco);
    console.log('   Versão SQL      :', String(row.versao).split('\n')[0]);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Falha na conexão:\n');
    console.error(err.message);
    process.exit(1);
  }
})();
