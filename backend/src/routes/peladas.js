const express = require('express');
const { query, withTransaction } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Descobre o JogadorId vinculado a um usuário
async function jogadorDoUsuario(usuarioId) {
  const r = await query('SELECT "Id" FROM "Jogadores" WHERE "UsuarioId" = $1', [usuarioId]);
  return r.rows[0] ? r.rows[0].Id : null;
}

// Insere os times e participações de uma pelada dentro de uma transação já aberta.
// times: [{ nome, vitorias, empates, derrotas }]  (a ordem define o índice)
// participacoes: [{ jogadorId, timeIndex, gols, assistencias }]
async function salvarTimesEParticipacoes(client, peladaId, times, participacoes) {
  const timeIdPorIndice = {};

  for (let i = 0; i < times.length; i++) {
    const t = times[i] || {};
    const ins = await client.query(
      `INSERT INTO "PeladaTimes" ("PeladaId","Nome","Vitorias","Empates","Derrotas")
       VALUES ($1,$2,$3,$4,$5) RETURNING "Id"`,
      [
        peladaId,
        String(t.nome || `Time ${i + 1}`).slice(0, 60),
        parseInt(t.vitorias, 10) || 0,
        parseInt(t.empates, 10) || 0,
        parseInt(t.derrotas, 10) || 0,
      ]
    );
    timeIdPorIndice[i] = ins.rows[0].Id;
  }

  const vistos = new Set();
  for (const p of participacoes || []) {
    const jogadorId = parseInt(p.jogadorId, 10);
    if (!jogadorId || vistos.has(jogadorId)) continue; // ignora duplicados
    vistos.add(jogadorId);

    let timeId = null;
    if (p.timeIndex !== null && p.timeIndex !== undefined && p.timeIndex !== '') {
      const idx = parseInt(p.timeIndex, 10);
      if (timeIdPorIndice[idx] !== undefined) timeId = timeIdPorIndice[idx];
    }

    await client.query(
      `INSERT INTO "PeladaParticipacoes" ("PeladaId","JogadorId","TimeId","Gols","Assistencias")
       VALUES ($1,$2,$3,$4,$5)`,
      [peladaId, jogadorId, timeId, parseInt(p.gols, 10) || 0, parseInt(p.assistencias, 10) || 0]
    );
  }
}

// GET /api/peladas  -> lista resumida
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT p."Id", p."DataPelada", p."Local", p."NumTimes", p."Observacao", p."Finalizada",
              (SELECT COUNT(*)::int FROM "PeladaParticipacoes" pp WHERE pp."PeladaId" = p."Id") AS "QtdJogadores",
              (SELECT COALESCE(SUM(pp."Gols"),0)::int FROM "PeladaParticipacoes" pp WHERE pp."PeladaId" = p."Id") AS "TotalGols"
       FROM "Peladas" p
       ORDER BY p."DataPelada" DESC, p."Id" DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[peladas:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar peladas.' });
  }
});

// GET /api/peladas/proxima -> próxima pelada agendada (futura, não finalizada) + confirmações
router.get('/proxima', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT p."Id", p."DataPelada", p."Local", p."NumTimes"
       FROM "Peladas" p
       WHERE p."Finalizada" = false AND p."DataPelada" >= CURRENT_DATE
       ORDER BY p."DataPelada" ASC, p."Id" ASC
       LIMIT 1`
    );
    if (r.rows.length === 0) return res.json(null);
    const pelada = r.rows[0];

    const conf = await query('SELECT COUNT(*)::int AS n FROM "PeladaPresencas" WHERE "PeladaId" = $1', [pelada.Id]);
    const tot = await query('SELECT COUNT(*)::int AS n FROM "Jogadores" WHERE "Ativo" = true');

    const jog = await jogadorDoUsuario(req.user.id);
    let confirmadoPorMim = false;
    if (jog) {
      const m = await query('SELECT 1 FROM "PeladaPresencas" WHERE "PeladaId" = $1 AND "JogadorId" = $2', [pelada.Id, jog]);
      confirmadoPorMim = m.rows.length > 0;
    }

    res.json({
      ...pelada,
      confirmados: conf.rows[0].n,
      totalJogadores: tot.rows[0].n,
      confirmadoPorMim,
    });
  } catch (err) {
    console.error('[peladas:proxima]', err.message);
    res.status(500).json({ error: 'Erro ao buscar próxima pelada.' });
  }
});

// GET /api/peladas/:id -> detalhe completo
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const pelada = await query('SELECT * FROM "Peladas" WHERE "Id" = $1', [id]);
    if (pelada.rows.length === 0) {
      return res.status(404).json({ error: 'Pelada não encontrada.' });
    }

    const times = await query('SELECT * FROM "PeladaTimes" WHERE "PeladaId" = $1 ORDER BY "Id"', [id]);

    const participacoes = await query(
      `SELECT pp."Id", pp."JogadorId", pp."TimeId", pp."Gols", pp."Assistencias", j."Nome" AS "JogadorNome"
       FROM "PeladaParticipacoes" pp
       JOIN "Jogadores" j ON j."Id" = pp."JogadorId"
       WHERE pp."PeladaId" = $1
       ORDER BY j."Nome"`,
      [id]
    );

    res.json({
      pelada: pelada.rows[0],
      times: times.rows,
      participacoes: participacoes.rows,
    });
  } catch (err) {
    console.error('[peladas:get]', err.message);
    res.status(500).json({ error: 'Erro ao buscar pelada.' });
  }
});

// POST /api/peladas  (admin) -> cria pelada completa
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { dataPelada, local, observacao, finalizada } = req.body;
  const times = Array.isArray(req.body.times) ? req.body.times : [];
  const participacoes = Array.isArray(req.body.participacoes) ? req.body.participacoes : [];

  if (!dataPelada) return res.status(400).json({ error: 'Informe a data da pelada.' });
  if (times.length < 2) return res.status(400).json({ error: 'A pelada precisa de ao menos 2 times.' });

  try {
    const peladaId = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO "Peladas" ("DataPelada","Local","NumTimes","Observacao","Finalizada","CriadoPor")
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING "Id"`,
        [dataPelada, local || null, times.length, observacao || null, !!finalizada, req.user.id]
      );
      const id = ins.rows[0].Id;
      await salvarTimesEParticipacoes(client, id, times, participacoes);
      return id;
    });
    res.status(201).json({ id: peladaId });
  } catch (err) {
    console.error('[peladas:create]', err.message);
    res.status(500).json({ error: 'Erro ao salvar pelada.' });
  }
});

// PUT /api/peladas/:id  (admin) -> substitui dados/times/participações
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dataPelada, local, observacao, finalizada } = req.body;
  const times = Array.isArray(req.body.times) ? req.body.times : [];
  const participacoes = Array.isArray(req.body.participacoes) ? req.body.participacoes : [];

  if (!dataPelada) return res.status(400).json({ error: 'Informe a data da pelada.' });
  if (times.length < 2) return res.status(400).json({ error: 'A pelada precisa de ao menos 2 times.' });

  try {
    await withTransaction(async (client) => {
      // Remove participações e times antigos (ordem importa por causa das FKs)
      await client.query('DELETE FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "PeladaTimes" WHERE "PeladaId" = $1', [id]);

      await client.query(
        `UPDATE "Peladas"
         SET "DataPelada"=$1, "Local"=$2, "NumTimes"=$3, "Observacao"=$4, "Finalizada"=$5
         WHERE "Id"=$6`,
        [dataPelada, local || null, times.length, observacao || null, !!finalizada, id]
      );

      await salvarTimesEParticipacoes(client, id, times, participacoes);
    });
    res.json({ id });
  } catch (err) {
    console.error('[peladas:update]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar pelada.' });
  }
});

// DELETE /api/peladas/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM "PeladaComentarios" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "PeladaPresencas" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "PeladaTimes" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "Peladas" WHERE "Id" = $1', [id]);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[peladas:delete]', err.message);
    res.status(500).json({ error: 'Erro ao excluir pelada.' });
  }
});

// POST /api/peladas/:id/confirmar -> confirma presença do usuário logado
router.post('/:id/confirmar', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const jog = await jogadorDoUsuario(req.user.id);
    if (!jog) return res.status(400).json({ error: 'Seu usuário não tem jogador vinculado.' });
    await query(
      `INSERT INTO "PeladaPresencas" ("PeladaId","JogadorId") VALUES ($1,$2)
       ON CONFLICT ("PeladaId","JogadorId") DO NOTHING`,
      [id, jog]
    );
    res.json({ ok: true, confirmado: true });
  } catch (err) {
    console.error('[peladas:confirmar]', err.message);
    res.status(500).json({ error: 'Erro ao confirmar presença.' });
  }
});

// DELETE /api/peladas/:id/confirmar -> cancela presença
router.delete('/:id/confirmar', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const jog = await jogadorDoUsuario(req.user.id);
    if (jog) {
      await query('DELETE FROM "PeladaPresencas" WHERE "PeladaId" = $1 AND "JogadorId" = $2', [id, jog]);
    }
    res.json({ ok: true, confirmado: false });
  } catch (err) {
    console.error('[peladas:desconfirmar]', err.message);
    res.status(500).json({ error: 'Erro ao cancelar presença.' });
  }
});

// GET /api/peladas/:id/comentarios
router.get('/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = await query(
      `SELECT c."Id", c."Texto", c."CriadoEm", u."Nome" AS "AutorNome", u."Usuario" AS "AutorUsuario"
       FROM "PeladaComentarios" c
       JOIN "Usuarios" u ON u."Id" = c."UsuarioId"
       WHERE c."PeladaId" = $1 ORDER BY c."CriadoEm" ASC`,
      [id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[peladas:comentarios:list]', err.message);
    res.status(500).json({ error: 'Erro ao carregar comentários.' });
  }
});

// POST /api/peladas/:id/comentarios { texto }
router.post('/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const texto = String(req.body.texto || '').trim();
    if (!texto) return res.status(400).json({ error: 'Escreva algo antes de enviar.' });
    const r = await query(
      `INSERT INTO "PeladaComentarios" ("PeladaId","UsuarioId","Texto")
       VALUES ($1,$2,$3) RETURNING "Id","Texto","CriadoEm"`,
      [id, req.user.id, texto.slice(0, 500)]
    );
    res.status(201).json({
      ...r.rows[0],
      AutorNome: req.user.nome,
      AutorUsuario: req.user.usuario,
    });
  } catch (err) {
    console.error('[peladas:comentarios:create]', err.message);
    res.status(500).json({ error: 'Erro ao enviar comentário.' });
  }
});

module.exports = router;
