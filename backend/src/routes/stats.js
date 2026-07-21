const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/publico -> números para o hero da tela de login (sem autenticação)
router.get('/publico', async (req, res) => {
  try {
    const r = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM "Peladas")                            AS "TotalPeladas",
         (SELECT COALESCE(SUM("Gols"),0)::int FROM "PeladaParticipacoes") AS "TotalGols",
         (SELECT COUNT(*)::int FROM "Jogadores" WHERE "Ativo" = true)     AS "TotalJogadores"`
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.json({ TotalPeladas: 0, TotalGols: 0, TotalJogadores: 0 });
  }
});

// GET /api/stats  -> ranking consolidado por jogador
// Cada linha: Jogos, Gols, Assistencias, Participacoes (G+A), Vitorias (do time em que jogou)
router.get('/', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT j."Id", j."Nome",
              COUNT(DISTINCT pp."PeladaId")::int      AS "Jogos",
              COALESCE(SUM(pp."Gols"), 0)::int         AS "Gols",
              COALESCE(SUM(pp."Assistencias"), 0)::int AS "Assistencias",
              (COALESCE(SUM(pp."Gols"), 0) + COALESCE(SUM(pp."Assistencias"), 0))::int AS "Participacoes",
              COALESCE(SUM(t."Vitorias"), 0)::int      AS "Vitorias"
       FROM "Jogadores" j
       JOIN "PeladaParticipacoes" pp ON pp."JogadorId" = j."Id"
       LEFT JOIN "PeladaTimes" t ON t."Id" = pp."TimeId"
       GROUP BY j."Id", j."Nome"
       ORDER BY "Gols" DESC, "Assistencias" DESC, j."Nome"`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[stats]', err.message);
    res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
  }
});

// GET /api/stats/resumo -> números gerais para o topo do dashboard
router.get('/resumo', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM "Peladas")                                   AS "TotalPeladas",
         (SELECT COUNT(*)::int FROM "Jogadores" WHERE "Ativo" = true)             AS "TotalJogadores",
         (SELECT COALESCE(SUM("Gols"),0)::int FROM "PeladaParticipacoes")        AS "TotalGols",
         (SELECT COALESCE(SUM("Assistencias"),0)::int FROM "PeladaParticipacoes") AS "TotalAssist"`
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[stats:resumo]', err.message);
    res.status(500).json({ error: 'Erro ao calcular resumo.' });
  }
});

// GET /api/stats/historico -> por jogador, gols/assist/vitórias por pelada (ordem cronológica)
// Usado para os mini-gráficos (sparklines) do ranking.
router.get('/historico', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT pp."JogadorId", p."Id" AS "PeladaId", p."DataPelada",
              pp."Gols", pp."Assistencias", COALESCE(t."Vitorias", 0) AS "Vitorias"
       FROM "PeladaParticipacoes" pp
       JOIN "Peladas" p ON p."Id" = pp."PeladaId"
       LEFT JOIN "PeladaTimes" t ON t."Id" = pp."TimeId"
       ORDER BY p."DataPelada" ASC, p."Id" ASC`
    );
    // agrupa por jogador
    const porJogador = {};
    for (const row of r.rows) {
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
