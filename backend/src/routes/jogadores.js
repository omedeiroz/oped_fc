const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { requireAuth, requireAdmin, requireBetAdmin } = require('../middleware/auth');
const { TIERS_VALIDOS } = require('../services/apostas');

const USUARIO_REGEX = /^[a-z0-9._-]{3,60}$/;

const router = express.Router();

// GET /api/jogadores  -> lista de jogadores ativos (para sugerir ao montar pelada)
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT j."Id", j."Nome", j."UsuarioId", j."Tier", (j."UsuarioId" IS NOT NULL) AS "TemLogin"
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

// PATCH /api/jogadores/:id/tier  { tier: 'S+'|'A'|'B' }  (bet-admin) -> define o tier
// usado só pra sugerir a odd inicial dos mercados de aposta.
router.patch('/:id/tier', requireAuth, requireBetAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const tier = String(req.body.tier || '').toUpperCase();
    if (!TIERS_VALIDOS.has(tier)) {
      return res.status(400).json({ error: "Tier inválido (use 'S+', 'A' ou 'B')." });
    }
    await query('UPDATE "Jogadores" SET "Tier" = $1 WHERE "Id" = $2', [tier, id]);
    res.json({ ok: true, tier });
  } catch (err) {
    console.error('[jogadores:tier]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar tier.' });
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

// POST /api/jogadores/:id/criar-login  { usuario, senha, email? }  (admin) -> cria uma
// conta pra um jogador avulso (sem login) e vincula a ele — não cria um Jogador novo,
// então todo o histórico de participações/estatísticas já registradas é preservado.
router.post('/:id/criar-login', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const usuario = String(req.body.usuario || '').trim().toLowerCase();
    const email = String(req.body.email || '').trim().toLowerCase() || null;
    const senha = String(req.body.senha || '');

    const jog = await query('SELECT "Id","Nome","UsuarioId" FROM "Jogadores" WHERE "Id" = $1 AND "Ativo" = true', [id]);
    if (jog.rows.length === 0) return res.status(404).json({ error: 'Jogador não encontrado.' });
    if (jog.rows[0].UsuarioId) return res.status(400).json({ error: 'Esse jogador já tem login.' });

    if (!USUARIO_REGEX.test(usuario)) {
      return res.status(400).json({
        error: 'Usuário deve ter 3+ caracteres (letras, números, ponto, hífen ou _), sem espaços.',
      });
    }
    if (senha.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

    const existe = await query('SELECT "Id" FROM "Usuarios" WHERE "Usuario" = $1', [usuario]);
    if (existe.rows.length > 0) return res.status(409).json({ error: 'Esse usuário já está em uso.' });
    if (email) {
      const eEmail = await query('SELECT "Id" FROM "Usuarios" WHERE "Email" = $1', [email]);
      if (eEmail.rows.length > 0) return res.status(409).json({ error: 'Esse email já está em uso.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const novoUsuario = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO "Usuarios" ("Nome","Usuario","Email","SenhaHash","IsAdmin")
         VALUES ($1,$2,$3,$4,false) RETURNING "Id"`,
        [jog.rows[0].Nome, usuario, email, senhaHash]
      );
      await client.query('UPDATE "Jogadores" SET "UsuarioId" = $1 WHERE "Id" = $2', [ins.rows[0].Id, id]);
      return ins.rows[0];
    });

    res.status(201).json({ ok: true, usuarioId: novoUsuario.Id, usuario });
  } catch (err) {
    console.error('[jogadores:criar-login]', err.message);
    res.status(500).json({ error: 'Erro ao criar login.' });
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
