const express = require('express');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats  -> ranking consolidado por jogador
// Cada linha: Jogos, Gols, Assistencias, Participacoes (G+A), Vitorias (do time em que jogou)
router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT j.Id, j.Nome,
              COUNT(DISTINCT pp.PeladaId)              AS Jogos,
              ISNULL(SUM(pp.Gols), 0)                  AS Gols,
              ISNULL(SUM(pp.Assistencias), 0)          AS Assistencias,
              ISNULL(SUM(pp.Gols), 0) + ISNULL(SUM(pp.Assistencias), 0) AS Participacoes,
              ISNULL(SUM(t.Vitorias), 0)               AS Vitorias
       FROM dbo.Jogadores j
       JOIN dbo.PeladaParticipacoes pp ON pp.JogadorId = j.Id
       LEFT JOIN dbo.PeladaTimes t ON t.Id = pp.TimeId
       GROUP BY j.Id, j.Nome
       ORDER BY Gols DESC, Assistencias DESC, j.Nome`
    );
    res.json(r.recordset);
  } catch (err) {
    console.error('[stats]', err.message);
    res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
  }
});

// GET /api/stats/resumo -> números gerais para o topo do dashboard
router.get('/resumo', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT
         (SELECT COUNT(*) FROM dbo.Peladas)                       AS TotalPeladas,
         (SELECT COUNT(*) FROM dbo.Jogadores WHERE Ativo = 1)     AS TotalJogadores,
         (SELECT ISNULL(SUM(Gols),0) FROM dbo.PeladaParticipacoes) AS TotalGols,
         (SELECT ISNULL(SUM(Assistencias),0) FROM dbo.PeladaParticipacoes) AS TotalAssist`
    );
    res.json(r.recordset[0]);
  } catch (err) {
    console.error('[stats:resumo]', err.message);
    res.status(500).json({ error: 'Erro ao calcular resumo.' });
  }
});

module.exports = router;
