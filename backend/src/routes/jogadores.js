const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/jogadores  -> lista de jogadores ativos (para sugerir ao montar pelada)
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT j.Id, j.Nome, j.UsuarioId,
              CAST(CASE WHEN j.UsuarioId IS NULL THEN 0 ELSE 1 END AS BIT) AS TemLogin
       FROM dbo.Jogadores j
       WHERE j.Ativo = 1
       ORDER BY j.Nome`
    );
    res.json(r.recordset);
  } catch (err) {
    console.error('[jogadores:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar jogadores.' });
  }
});

// POST /api/jogadores  { nome }  -> cria jogador avulso (admin)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Informe o nome do jogador.' });

    const pool = await getPool();
    const r = await pool
      .request()
      .input('nome', sql.NVarChar(120), nome)
      .query(
        `INSERT INTO dbo.Jogadores (Nome)
         OUTPUT INSERTED.Id, INSERTED.Nome, INSERTED.UsuarioId,
                CAST(0 AS BIT) AS TemLogin
         VALUES (@nome)`
      );
    res.status(201).json(r.recordset[0]);
  } catch (err) {
    console.error('[jogadores:create]', err.message);
    res.status(500).json({ error: 'Erro ao criar jogador.' });
  }
});

// DELETE /api/jogadores/:id  -> desativa jogador (admin). Só desativa se for avulso e sem participações.
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.Int, id)
      .query('UPDATE dbo.Jogadores SET Ativo = 0 WHERE Id = @id');
    res.json({ ok: true });
  } catch (err) {
    console.error('[jogadores:delete]', err.message);
    res.status(500).json({ error: 'Erro ao remover jogador.' });
  }
});

module.exports = router;
