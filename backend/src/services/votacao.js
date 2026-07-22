const { query } = require('../db');

const NOTAS_VALIDAS = new Set([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);

// Participantes de uma pelada (todos os jogadores, com ou sem login)
async function participantesDaPelada(peladaId) {
  const r = await query(
    `SELECT j."Id", j."Nome", j."UsuarioId"
     FROM "PeladaParticipacoes" pp
     JOIN "Jogadores" j ON j."Id" = pp."JogadorId"
     WHERE pp."PeladaId" = $1`,
    [peladaId]
  );
  return r.rows;
}

// Calcula o estado da votação de uma pelada: quantos votos faltam,
// se já está completa e, se sim, a média de cada jogador + MVP/LVP.
// "Eleitores" = participantes com login (só eles conseguem votar).
async function calcularResultado(peladaId) {
  const participantes = await participantesDaPelada(peladaId);
  const eleitores = participantes.filter((p) => p.UsuarioId);
  const esperado = eleitores.length * Math.max(participantes.length - 1, 0);

  const votosRes = await query(
    'SELECT "VotanteJogadorId","AvaliadoJogadorId","Nota" FROM "PeladaVotos" WHERE "PeladaId" = $1',
    [peladaId]
  );
  const votos = votosRes.rows;
  const completo = esperado > 0 && votos.length === esperado;

  let medias = [];
  let mvp = null;
  let lvp = null;

  if (completo) {
    const porAvaliado = {};
    for (const v of votos) {
      (porAvaliado[v.AvaliadoJogadorId] = porAvaliado[v.AvaliadoJogadorId] || []).push(Number(v.Nota));
    }
    medias = participantes
      .filter((p) => porAvaliado[p.Id])
      .map((p) => {
        const notas = porAvaliado[p.Id];
        const media = notas.reduce((a, b) => a + b, 0) / notas.length;
        return { jogadorId: p.Id, nome: p.Nome, media: Math.round(media * 100) / 100, votos: notas.length };
      })
      .sort((a, b) => b.media - a.media);

    if (medias.length > 0) {
      mvp = medias[0];
      lvp = medias[medias.length - 1];
    }
  }

  return { esperado, recebidos: votos.length, completo, medias, mvp, lvp, participantes, eleitores };
}

// Agrega nota média + contagem de MVP/LVP por jogador, considerando só
// peladas com votação completa. Usado no ranking geral.
async function calcularRankingVotos() {
  const peladasRes = await query('SELECT "Id" FROM "Peladas" WHERE "Finalizada" = true');
  const acc = {}; // jogadorId -> { soma, qtd, mvps, lvps }

  for (const p of peladasRes.rows) {
    const resultado = await calcularResultado(p.Id);
    if (!resultado.completo) continue;

    for (const m of resultado.medias) {
      if (!acc[m.jogadorId]) acc[m.jogadorId] = { soma: 0, qtd: 0, mvps: 0, lvps: 0 };
      acc[m.jogadorId].soma += m.media;
      acc[m.jogadorId].qtd += 1;
    }
    if (resultado.mvp) acc[resultado.mvp.jogadorId].mvps += 1;
    if (resultado.lvp && (!resultado.mvp || resultado.lvp.jogadorId !== resultado.mvp.jogadorId)) {
      acc[resultado.lvp.jogadorId].lvps += 1;
    }
  }

  const out = {};
  for (const [jogadorId, v] of Object.entries(acc)) {
    out[jogadorId] = { notaMedia: Math.round((v.soma / v.qtd) * 100) / 100, mvps: v.mvps, lvps: v.lvps };
  }
  return out;
}

module.exports = { participantesDaPelada, calcularResultado, calcularRankingVotos, NOTAS_VALIDAS };
