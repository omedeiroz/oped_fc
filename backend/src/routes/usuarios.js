const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios  -> lista de usuários (admin) para gerenciar quem é admin
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT Id, Nome, Usuario, Email, IsAdmin, Ativo, CriadoEm
       FROM dbo.Usuarios ORDER BY Nome`
    );
    res.json(r.recordset);
  } catch (err) {
    console.error('[usuarios:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

// PATCH /api/usuarios/:id/admin  { isAdmin: true|false }  (admin)
router.patch('/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const isAdmin = req.body.isAdmin ? 1 : 0;

    // Impede remover o último admin do sistema
    if (!isAdmin) {
      const pool0 = await getPool();
      const c = await pool0
        .request()
        .query('SELECT COUNT(*) AS total FROM dbo.Usuarios WHERE IsAdmin = 1 AND Ativo = 1');
      if (c.recordset[0].total <= 1) {
        return res
          .status(400)
          .json({ error: 'Não é possível remover o último administrador.' });
      }
    }

    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.Int, id)
      .input('isAdmin', sql.Bit, isAdmin)
      .query('UPDATE dbo.Usuarios SET IsAdmin = @isAdmin WHERE Id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('[usuarios:admin]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar permissão.' });
  }
});

module.exports = router;
