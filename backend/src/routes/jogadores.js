const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/jogadores  -> lista de jogadores ativos (para sugerir ao montar pelada)
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT j."Id", j."Nome", j."UsuarioId", (j."UsuarioId" IS NOT NULL) AS "TemLogin"
       FROM "Jogadores" j
       WHERE j."Ativo" = true
       ORDER BY j."Nome"`
    );
    res.json(r.rows);
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

    const r = await query(
      `INSERT INTO "Jogadores" ("Nome") VALUES ($1)
       RETURNING "Id","Nome","UsuarioId", false AS "TemLogin"`,
      [nome]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[jogadores:create]', err.message);
    res.status(500).json({ error: 'Erro ao criar jogador.' });
  }
});

// GET /api/jogadores/:id -> dados públicos do jogador (para ver o perfil de outros)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await query(
      `SELECT j."Id", j."Nome", u."Usuario", u."Foto"
       FROM "Jogadores" j
       LEFT JOIN "Usuarios" u ON u."Id" = j."UsuarioId"
       WHERE j."Id" = $1`,
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Jogador não encontrado.' });
    const j = r.rows[0];
    res.json({ jogadorId: j.Id, nome: j.Nome, usuario: j.Usuario || null, foto: j.Foto || null });
  } catch (err) {
    console.error('[jogadores:get]', err.message);
    res.status(500).json({ error: 'Erro ao buscar jogador.' });
  }
});

// GET /api/jogadores/:id/historico -> peladas que o jogador participou, mais recente primeiro
router.get('/:id/historico', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await query(
      `SELECT p."Id" AS "PeladaId", p."DataPelada", p."Local", p."Finalizada",
              t."Nome" AS "TimeNome", t."Vitorias", t."Empates", t."Derrotas",
              pp."Gols", pp."Assistencias"
       FROM "PeladaParticipacoes" pp
       JOIN "Peladas" p ON p."Id" = pp."PeladaId"
       LEFT JOIN "PeladaTimes" t ON t."Id" = pp."TimeId"
       WHERE pp."JogadorId" = $1
       ORDER BY p."DataPelada" DESC, p."Id" DESC`,
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[jogadores:historico]', err.message);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// DELETE /api/jogadores/:id  -> desativa jogador (admin). Só desativa se for avulso e sem participações.
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('UPDATE "Jogadores" SET "Ativo" = false WHERE "Id" = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[jogadores:delete]', err.message);
    res.status(500).json({ error: 'Erro ao remover jogador.' });
  }
});

module.exports = router;
