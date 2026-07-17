const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Descobre o JogadorId vinculado a um usuário
async function jogadorDoUsuario(pool, usuarioId) {
  const r = await pool
    .request()
    .input('u', sql.Int, usuarioId)
    .query('SELECT Id FROM dbo.Jogadores WHERE UsuarioId = @u');
  return r.recordset[0] ? r.recordset[0].Id : null;
}

// Insere os times e participações de uma pelada dentro de uma transação já aberta.
// times: [{ nome, vitorias, empates, derrotas }]  (a ordem define o índice)
// participacoes: [{ jogadorId, timeIndex, gols, assistencias }]
async function salvarTimesEParticipacoes(tx, peladaId, times, participacoes) {
  const timeIdPorIndice = {};

  for (let i = 0; i < times.length; i++) {
    const t = times[i] || {};
    const ins = await new sql.Request(tx)
      .input('peladaId', sql.Int, peladaId)
      .input('nome', sql.NVarChar(60), String(t.nome || `Time ${i + 1}`).slice(0, 60))
      .input('vitorias', sql.Int, parseInt(t.vitorias, 10) || 0)
      .input('empates', sql.Int, parseInt(t.empates, 10) || 0)
      .input('derrotas', sql.Int, parseInt(t.derrotas, 10) || 0)
      .query(
        `INSERT INTO dbo.PeladaTimes (PeladaId, Nome, Vitorias, Empates, Derrotas)
         OUTPUT INSERTED.Id
         VALUES (@peladaId, @nome, @vitorias, @empates, @derrotas)`
      );
    timeIdPorIndice[i] = ins.recordset[0].Id;
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

    await new sql.Request(tx)
      .input('peladaId', sql.Int, peladaId)
      .input('jogadorId', sql.Int, jogadorId)
      .input('timeId', sql.Int, timeId)
      .input('gols', sql.Int, parseInt(p.gols, 10) || 0)
      .input('assist', sql.Int, parseInt(p.assistencias, 10) || 0)
      .query(
        `INSERT INTO dbo.PeladaParticipacoes (PeladaId, JogadorId, TimeId, Gols, Assistencias)
         VALUES (@peladaId, @jogadorId, @timeId, @gols, @assist)`
      );
  }
}

// GET /api/peladas  -> lista resumida
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT p.Id, p.DataPelada, p.Local, p.NumTimes, p.Observacao, p.Finalizada,
              (SELECT COUNT(*) FROM dbo.PeladaParticipacoes pp WHERE pp.PeladaId = p.Id) AS QtdJogadores,
              (SELECT ISNULL(SUM(Gols),0) FROM dbo.PeladaParticipacoes pp WHERE pp.PeladaId = p.Id) AS TotalGols
       FROM dbo.Peladas p
       ORDER BY p.DataPelada DESC, p.Id DESC`
    );
    res.json(r.recordset);
  } catch (err) {
    console.error('[peladas:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar peladas.' });
  }
});

// GET /api/peladas/proxima -> próxima pelada agendada (futura, não finalizada) + confirmações
router.get('/proxima', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT TOP 1 p.Id, p.DataPelada, p.Local, p.NumTimes
       FROM dbo.Peladas p
       WHERE p.Finalizada = 0 AND p.DataPelada >= CAST(GETDATE() AS DATE)
       ORDER BY p.DataPelada ASC, p.Id ASC`
    );
    if (r.recordset.length === 0) return res.json(null);
    const pelada = r.recordset[0];

    const conf = await pool.request().input('id', sql.Int, pelada.Id)
      .query('SELECT COUNT(*) AS n FROM dbo.PeladaPresencas WHERE PeladaId = @id');
    const tot = await pool.request()
      .query('SELECT COUNT(*) AS n FROM dbo.Jogadores WHERE Ativo = 1');

    const jog = await jogadorDoUsuario(pool, req.user.id);
    let confirmadoPorMim = false;
    if (jog) {
      const m = await pool.request().input('id', sql.Int, pelada.Id).input('j', sql.Int, jog)
        .query('SELECT 1 AS ok FROM dbo.PeladaPresencas WHERE PeladaId = @id AND JogadorId = @j');
      confirmadoPorMim = m.recordset.length > 0;
    }

    res.json({
      ...pelada,
      confirmados: conf.recordset[0].n,
      totalJogadores: tot.recordset[0].n,
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
    const pool = await getPool();

    const pelada = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.Peladas WHERE Id = @id');
    if (pelada.recordset.length === 0) {
      return res.status(404).json({ error: 'Pelada não encontrada.' });
    }

    const times = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM dbo.PeladaTimes WHERE PeladaId = @id ORDER BY Id');

    const participacoes = await pool
      .request()
      .input('id', sql.Int, id)
      .query(
        `SELECT pp.Id, pp.JogadorId, pp.TimeId, pp.Gols, pp.Assistencias, j.Nome AS JogadorNome
         FROM dbo.PeladaParticipacoes pp
         JOIN dbo.Jogadores j ON j.Id = pp.JogadorId
         WHERE pp.PeladaId = @id
         ORDER BY j.Nome`
      );

    res.json({
      pelada: pelada.recordset[0],
      times: times.recordset,
      participacoes: participacoes.recordset,
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

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const ins = await new sql.Request(tx)
      .input('data', sql.Date, dataPelada)
      .input('local', sql.NVarChar(160), local || null)
      .input('numTimes', sql.Int, times.length)
      .input('obs', sql.NVarChar(400), observacao || null)
      .input('finalizada', sql.Bit, finalizada ? 1 : 0)
      .input('criadoPor', sql.Int, req.user.id)
      .query(
        `INSERT INTO dbo.Peladas (DataPelada, Local, NumTimes, Observacao, Finalizada, CriadoPor)
         OUTPUT INSERTED.Id
         VALUES (@data, @local, @numTimes, @obs, @finalizada, @criadoPor)`
      );
    const peladaId = ins.recordset[0].Id;

    await salvarTimesEParticipacoes(tx, peladaId, times, participacoes);
    await tx.commit();
    res.status(201).json({ id: peladaId });
  } catch (err) {
    await tx.rollback().catch(() => {});
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

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();

    // Remove participações e times antigos (ordem importa por causa das FKs)
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaParticipacoes WHERE PeladaId = @id');
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaTimes WHERE PeladaId = @id');

    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('data', sql.Date, dataPelada)
      .input('local', sql.NVarChar(160), local || null)
      .input('numTimes', sql.Int, times.length)
      .input('obs', sql.NVarChar(400), observacao || null)
      .input('finalizada', sql.Bit, finalizada ? 1 : 0)
      .query(
        `UPDATE dbo.Peladas
         SET DataPelada=@data, Local=@local, NumTimes=@numTimes,
             Observacao=@obs, Finalizada=@finalizada
         WHERE Id=@id`
      );

    await salvarTimesEParticipacoes(tx, id, times, participacoes);
    await tx.commit();
    res.json({ id });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error('[peladas:update]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar pelada.' });
  }
});

// DELETE /api/peladas/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaComentarios WHERE PeladaId = @id');
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaPresencas WHERE PeladaId = @id');
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaParticipacoes WHERE PeladaId = @id');
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.PeladaTimes WHERE PeladaId = @id');
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM dbo.Peladas WHERE Id = @id');
    await tx.commit();
    res.json({ ok: true });
  } catch (err) {
    await tx.rollback().catch(() => {});
    console.error('[peladas:delete]', err.message);
    res.status(500).json({ error: 'Erro ao excluir pelada.' });
  }
});

// POST /api/peladas/:id/confirmar -> confirma presença do usuário logado
router.post('/:id/confirmar', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    const jog = await jogadorDoUsuario(pool, req.user.id);
    if (!jog) return res.status(400).json({ error: 'Seu usuário não tem jogador vinculado.' });
    await pool.request().input('id', sql.Int, id).input('j', sql.Int, jog)
      .query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.PeladaPresencas WHERE PeladaId = @id AND JogadorId = @j)
         INSERT INTO dbo.PeladaPresencas (PeladaId, JogadorId) VALUES (@id, @j)`
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
    const pool = await getPool();
    const jog = await jogadorDoUsuario(pool, req.user.id);
    if (jog) {
      await pool.request().input('id', sql.Int, id).input('j', sql.Int, jog)
        .query('DELETE FROM dbo.PeladaPresencas WHERE PeladaId = @id AND JogadorId = @j');
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
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id).query(
      `SELECT c.Id, c.Texto, c.CriadoEm, u.Nome AS AutorNome, u.Usuario AS AutorUsuario
       FROM dbo.PeladaComentarios c
       JOIN dbo.Usuarios u ON u.Id = c.UsuarioId
       WHERE c.PeladaId = @id ORDER BY c.CriadoEm ASC`
    );
    res.json(r.recordset);
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
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, req.user.id)
      .input('texto', sql.NVarChar(500), texto.slice(0, 500))
      .query(
        `INSERT INTO dbo.PeladaComentarios (PeladaId, UsuarioId, Texto)
         OUTPUT INSERTED.Id, INSERTED.Texto, INSERTED.CriadoEm
         VALUES (@id, @uid, @texto)`
      );
    res.status(201).json({
      ...r.recordset[0],
      AutorNome: req.user.nome,
      AutorUsuario: req.user.usuario,
    });
  } catch (err) {
    console.error('[peladas:comentarios:create]', err.message);
    res.status(500).json({ error: 'Erro ao enviar comentário.' });
  }
});

module.exports = router;
