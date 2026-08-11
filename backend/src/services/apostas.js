const { query } = require('../db');

const TIER_COLUNA = { 'S+': 'OddSPlus', A: 'OddA', B: 'OddB' };
const TIERS_VALIDOS = new Set(['S+', 'A', 'B']);

// Linhas de handicap tipo casa de apostas ("+1.5 gols" = precisa de 2+ pra ganhar).
// O fator escala a odd base do tier: quanto maior a linha, mais raro o evento.
const LINHAS = [
  { valor: 0.5, fator: 1 },
  { valor: 1.5, fator: 2.2 },
  { valor: 4.5, fator: 6 },
];
const SEM_LINHA = { valor: 0, fator: 1 };

function oddBase(tipo, tier) {
  const coluna = TIER_COLUNA[tier] || TIER_COLUNA.B;
  return Number(tipo[coluna]);
}

// Cria, dentro de uma transação já aberta, os mercados de uma pelada — um por
// (jogador × categoria ativa), ou vários (um por linha de handicap) quando a
// categoria tem TemLinha=true. Chamado ao criar/editar a pelada (Parte 1).
// Idempotente: mercados que já existem não são tocados (não reseta odd customizada).
async function gerarMercadosApostas(client, peladaId, jogadorIds) {
  if (!jogadorIds || jogadorIds.length === 0) return;
  const tipos = (await client.query('SELECT * FROM "TiposAposta" WHERE "Ativo" = true')).rows;
  if (tipos.length === 0) return;

  for (const jogadorId of jogadorIds) {
    const jog = await client.query('SELECT "Tier" FROM "Jogadores" WHERE "Id" = $1', [jogadorId]);
    const tier = jog.rows[0] && TIERS_VALIDOS.has(jog.rows[0].Tier) ? jog.rows[0].Tier : 'B';
    for (const tipo of tipos) {
      const linhas = tipo.TemLinha ? LINHAS : [SEM_LINHA];
      const base = oddBase(tipo, tier);
      for (const l of linhas) {
        const odd = Math.round(base * l.fator * 100) / 100;
        await client.query(
          `INSERT INTO "PeladaApostaMercados" ("PeladaId","JogadorId","TipoApostaId","Linha","Odd")
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT ("PeladaId","JogadorId","TipoApostaId","Linha") DO NOTHING`,
          [peladaId, jogadorId, tipo.Id, l.valor, odd]
        );
      }
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
// AutoResolve=true (gol, assistência, defesa) comparando a estatística do jogador
// contra a linha do mercado (ex.: Gols=2, Linha=1.5 -> 2 > 1.5 -> ganhou).
async function resolverMercadosAutomaticos(client, peladaId) {
  const mercados = await client.query(
    `SELECT m."Id", m."JogadorId", m."Linha", t."Chave"
     FROM "PeladaApostaMercados" m
     JOIN "TiposAposta" t ON t."Id" = m."TipoApostaId"
     WHERE m."PeladaId" = $1 AND m."Resolvido" = false AND t."AutoResolve" = true`,
    [peladaId]
  );

  for (const m of mercados.rows) {
    const part = await client.query(
      'SELECT "Gols","Assistencias","Defesas" FROM "PeladaParticipacoes" WHERE "PeladaId" = $1 AND "JogadorId" = $2',
      [peladaId, m.JogadorId]
    );
    const p = part.rows[0] || { Gols: 0, Assistencias: 0, Defesas: 0 };
    let valor = 0;
    if (m.Chave === 'gol') valor = p.Gols;
    else if (m.Chave === 'assistencia') valor = p.Assistencias;
    else if (m.Chave === 'defesa') valor = p.Defesas;
    const resultado = valor > Number(m.Linha);
    await liquidarMercado(client, m.Id, resultado);
  }
}

module.exports = { gerarMercadosApostas, liquidarMercado, resolverMercadosAutomaticos, TIERS_VALIDOS, LINHAS };
