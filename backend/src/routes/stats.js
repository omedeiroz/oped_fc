const express = require('express');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/publico -> números para o hero da tela de login (sem autenticação)
router.get('/publico', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT
         (SELECT COUNT(*) FROM dbo.Peladas)                        AS TotalPeladas,
         (SELECT ISNULL(SUM(Gols),0) FROM dbo.PeladaParticipacoes) AS TotalGols,
         (SELECT COUNT(*) FROM dbo.Jogadores WHERE Ativo = 1)      AS TotalJogadores`
    );
    res.json(r.recordset[0]);
  } catch (err) {
    res.json({ TotalPeladas: 0, TotalGols: 0, TotalJogadores: 0 });
  }
});

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

// GET /api/stats/historico -> por jogador, gols/assist/vitórias por pelada (ordem cronológica)
// Usado para os mini-gráficos (sparklines) do ranking.
router.get('/historico', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT pp.JogadorId, p.Id AS PeladaId, p.DataPelada,
              pp.Gols, pp.Assistencias, ISNULL(t.Vitorias, 0) AS Vitorias
       FROM dbo.PeladaParticipacoes pp
       JOIN dbo.Peladas p ON p.Id = pp.PeladaId
       LEFT JOIN dbo.PeladaTimes t ON t.Id = pp.TimeId
       ORDER BY p.DataPelada ASC, p.Id ASC`
    );
    // agrupa por jogador
    const porJogador = {};
    for (const row of r.recordset) {
      (porJogador[row.JogadorId] = porJogador[row.JogadorId] || []).push({
        gols: row.Gols, assist: row.Assistencias, vitorias: row.Vitorias, jogos: 1,
      });
    }
    res.json(porJogador);
  } catch (err) {
    console.error('[stats:historico]', err.message);
    res.status(500).json({ error: 'Erro ao calcular histórico.' });
  }
});

module.exports = router;
