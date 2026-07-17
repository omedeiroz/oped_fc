const express = require('express');
const { sql, getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
