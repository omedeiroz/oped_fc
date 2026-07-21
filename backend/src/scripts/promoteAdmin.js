// Promove um usuário a administrador pelo nome de usuário (login).
// Uso: node src/scripts/promoteAdmin.js arthur.pereira
const { pool } = require('../db');

(async () => {
  const usuario = (process.argv[2] || '').trim().toLowerCase();
  if (!usuario) {
    console.error('Uso: node src/scripts/promoteAdmin.js nome.usuario');
    process.exit(1);
  }
  try {
    const r = await pool.query('UPDATE "Usuarios" SET "IsAdmin" = true WHERE "Usuario" = $1', [usuario]);
    if (r.rowCount > 0) {
      console.log(`✅ ${usuario} agora é administrador.`);
    } else {
      console.log(`⚠️  Nenhum usuário encontrado com o login ${usuario}.`);
    }
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
