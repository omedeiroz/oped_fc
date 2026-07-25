const { query } = require('../db');

const TIER_COLUNA = { 'S+': 'OddSPlus', A: 'OddA', B: 'OddB' };
const TIERS_VALIDOS = new Set(['S+', 'A', 'B']);

function oddSugerida(tipo, tier) {
  const coluna = TIER_COLUNA[tier] || TIER_COLUNA.B;
  return Number(tipo[coluna]);
}

// Cria, dentro de uma transação já aberta, um mercado por (jogador × categoria ativa)
// pra uma pelada — chamado ao criar/editar a pelada (Parte 1). Idempotente: jogadores
// que já têm mercado naquela categoria não são tocados (não reseta odd customizada).
async function gerarMercadosApostas(client, peladaId, jogadorIds) {
  if (!jogadorIds || jogadorIds.length === 0) return;
  const tipos = (await client.query('SELECT * FROM "TiposAposta" WHERE "Ativo" = true')).rows;
  if (tipos.length === 0) return;

  for (const jogadorId of jogadorIds) {
    const jog = await client.query('SELECT "Tier" FROM "Jogadores" WHERE "Id" = $1', [jogadorId]);
    const tier = jog.rows[0] && TIERS_VALIDOS.has(jog.rows[0].Tier) ? jog.rows[0].Tier : 'B';
    for (const tipo of tipos) {
      await client.query(
        `INSERT INTO "PeladaApostaMercados" ("PeladaId","JogadorId","TipoApostaId","Odd")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("PeladaId","JogadorId","TipoApostaId") DO NOTHING`,
        [peladaId, jogadorId, tipo.Id, oddSugerida(tipo, tier)]
      );
    }
  }
}

// Liquida um mercado (marca resolvido + credita/perde as apostas pendentes).
// Reaproveitado tanto pela resolução manual (Arthur) quanto pelo auto-resolve.
async function liquidarMercado(client, mercadoId, resultado) {
  await client.query(
    `UPDATE "PeladaApostaMercados" SET "Resolvido" = true, "Resultado" = $1, "ResolvidoEm" = NOW() WHERE "Id" = $2`,
    [resultado, mercadoId]
  );

  const apostas = await client.query(
    `SELECT "Id","UsuarioId","Valor","Odd" FROM "PeladaApostas" WHERE "MercadoId" = $1 AND "Status" = 'pendente'`,
    [mercadoId]
  );

  for (const a of apostas.rows) {
    if (resultado) {
      const premio = Math.round(a.Valor * Number(a.Odd));
      await client.query(
        `UPDATE "PeladaApostas" SET "Status" = 'ganhou', "Premio" = $1, "ResolvidoEm" = NOW() WHERE "Id" = $2`,
        [premio, a.Id]
      );
      await client.query('UPDATE "Usuarios" SET "SaldoFichas" = "SaldoFichas" + $1 WHERE "Id" = $2', [premio, a.UsuarioId]);
      await client.query(
        `INSERT INTO "FichasTransacoes" ("UsuarioId","Valor","Tipo","ApostaId","Descricao")
         VALUES ($1,$2,'premio_aposta',$3,'Aposta vencedora')`,
        [a.UsuarioId, premio, a.Id]
      );
    } else {
      await client.query(
        `UPDATE "PeladaApostas" SET "Status" = 'perdeu', "Premio" = 0, "ResolvidoEm" = NOW() WHERE "Id" = $1`,
        [a.Id]
      );
    }
  }
}

// Ao finalizar uma pelada: resolve automaticamente os mercados de categorias com
// AutoResolve=true (hoje: gol e assistência) a partir das estatísticas já preenchidas.
async function resolverMercadosAutomaticos(client, peladaId) {
  const mercados = await client.query(
    `SELECT m."Id", m."JogadorId", t."Chave"
     FROM "PeladaApostaMercados" m
     JOIN "TiposAposta" t ON t."Id" = m."TipoApostaId"
     WHERE m."PeladaId" = $1 AND m."Resolvido" = false AND t."AutoResolve" = true`,
    [peladaId]
  );

  for (const m of mercados.rows) {
    const part = await client.query(
      'SELECT "Gols","Assistencias" FROM "PeladaParticipacoes" WHERE "PeladaId" = $1 AND "JogadorId" = $2',
      [peladaId, m.JogadorId]
    );
    const p = part.rows[0] || { Gols: 0, Assistencias: 0 };
    let resultado = false;
    if (m.Chave === 'gol') resultado = p.Gols > 0;
    else if (m.Chave === 'assistencia') resultado = p.Assistencias > 0;
    await liquidarMercado(client, m.Id, resultado);
  }
}

module.exports = { gerarMercadosApostas, liquidarMercado, resolverMercadosAutomaticos, TIERS_VALIDOS };
