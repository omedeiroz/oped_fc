// Promove um usuário a administrador pelo email.
// Uso: node src/scripts/promoteAdmin.js email@dominio.com
const { sql, getPool } = require('../db');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Uso: node src/scripts/promoteAdmin.js email@dominio.com');
    process.exit(1);
  }
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input('email', sql.NVarChar(160), email)
      .query('UPDATE dbo.Usuarios SET IsAdmin = 1 WHERE Email = @email');
    if (r.rowsAffected[0] > 0) {
      console.log(`✅ ${email} agora é administrador.`);
    } else {
      console.log(`⚠️  Nenhum usuário encontrado com o email ${email}.`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
