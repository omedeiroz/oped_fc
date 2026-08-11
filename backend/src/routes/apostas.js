const express = require('express');
const { query, withTransaction } = require('../db');
const { requireAuth, requireBetAdmin } = require('../middleware/auth');
const { liquidarMercado } = require('../services/apostas');

const router = express.Router();

// GET /api/apostas/tipos -> lista de categorias de aposta (qualquer autenticado)
router.get('/tipos', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT * FROM "TiposAposta" ORDER BY "Nome"');
    res.json(r.rows);
  } catch (err) {
    console.error('[apostas:tipos:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar categorias de aposta.' });
  }
});

// POST /api/apostas/tipos  (bet-admin) -> cria categoria nova
router.post('/tipos', requireAuth, requireBetAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const chave = String(req.body.chave || '').trim().toLowerCase();
    const autoResolve = !!req.body.autoResolve;
    const temLinha = req.body.temLinha !== undefined ? !!req.body.temLinha : true;
    const oddSPlus = Number(req.body.oddSPlus);
    const oddA = Number(req.body.oddA);
    const oddB = Number(req.body.oddB);
    if (!nome || !chave) return res.status(400).json({ error: 'Informe nome e chave da categoria.' });
    if (![oddSPlus, oddA, oddB].every((n) => Number.isFinite(n) && n > 1)) {
      return res.status(400).json({ error: 'Informe odds válidas (maiores que 1) para os 3 tiers.' });
    }

    const r = await query(
      `INSERT INTO "TiposAposta" ("Nome","Chave","AutoResolve","TemLinha","OddSPlus","OddA","OddB")
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nome, chave, autoResolve, temLinha, oddSPlus, oddA, oddB]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma categoria com essa chave.' });
    console.error('[apostas:tipos:create]', err.message);
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
});

// PUT /api/apostas/tipos/:id  (bet-admin) -> edita nome/odds base/autoResolve/ativo
router.put('/tipos/:id', requireAuth, requireBetAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const nome = String(req.body.nome || '').trim();
    const ativo = !!req.body.ativo;
    const autoResolve = !!req.body.autoResolve;
    const temLinha = !!req.body.temLinha;
    const oddSPlus = Number(req.body.oddSPlus);
    const oddA = Number(req.body.oddA);
    const oddB = Number(req.body.oddB);
    if (!nome || ![oddSPlus, oddA, oddB].every((n) => Number.isFinite(n) && n > 1)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }
    await query(
      `UPDATE "TiposAposta"
       SET "Nome"=$1,"AutoResolve"=$2,"TemLinha"=$3,"OddSPlus"=$4,"OddA"=$5,"OddB"=$6,"Ativo"=$7
       WHERE "Id"=$8`,
      [nome, autoResolve, temLinha, oddSPlus, oddA, oddB, ativo, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[apostas:tipos:update]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar categoria.' });
  }
});

// GET /api/apostas/mercados/pelada/:peladaId -> mercados da pelada agrupados por jogador,
// incluindo a aposta do usuário logado em cada um (se houver).
router.get('/mercados/pelada/:peladaId', requireAuth, async (req, res) => {
  try {
    const peladaId = parseInt(req.params.peladaId, 10);
    const pelada = await query(
      'SELECT "Id","DataPelada","Local","EstatisticasIniciadas","Finalizada" FROM "Peladas" WHERE "Id" = $1',
      [peladaId]
    );
    if (pelada.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });

    const mercados = await query(
      `SELECT m."Id" AS "MercadoId", m."JogadorId", m."Odd", m."Linha", m."Resolvido", m."Resultado",
              t."Id" AS "TipoApostaId", t."Nome" AS "CategoriaNome", t."AutoResolve", t."TemLinha",
              j."Nome" AS "JogadorNome", u."Foto"
       FROM "PeladaApostaMercados" m
       JOIN "TiposAposta" t ON t."Id" = m."TipoApostaId"
       JOIN "Jogadores" j ON j."Id" = m."JogadorId"
       LEFT JOIN "Usuarios" u ON u."Id" = j."UsuarioId"
       WHERE m."PeladaId" = $1
       ORDER BY j."Nome", t."Nome", m."Linha"`,
      [peladaId]
    );

    const minhasApostas = await query(
      `SELECT a."MercadoId", a."Valor", a."Odd", a."Status", a."Premio"
       FROM "PeladaApostas" a
       JOIN "PeladaApostaMercados" m ON m."Id" = a."MercadoId"
       WHERE m."PeladaId" = $1 AND a."UsuarioId" = $2`,
      [peladaId, req.user.id]
    );
    const apostaPorMercado = {};
    minhasApostas.rows.forEach((a) => { apostaPorMercado[a.MercadoId] = a; });

    const porJogador = {};
    for (const m of mercados.rows) {
      if (!porJogador[m.JogadorId]) {
        porJogador[m.JogadorId] = { jogadorId: m.JogadorId, nome: m.JogadorNome, foto: m.Foto || null, mercados: [] };
      }
      const minha = apostaPorMercado[m.MercadoId];
      porJogador[m.JogadorId].mercados.push({
        mercadoId: m.MercadoId,
        tipoApostaId: m.TipoApostaId,
        categoria: m.CategoriaNome,
        autoResolve: m.AutoResolve,
        temLinha: m.TemLinha,
        linha: Number(m.Linha),
        odd: Number(m.Odd),
        resolvido: m.Resolvido,
        resultado: m.Resultado,
        minhaAposta: minha
          ? { valor: minha.Valor, odd: Number(minha.Odd), status: minha.Status, premio: minha.Premio }
          : null,
      });
    }

    res.json({
      pelada: pelada.rows[0],
      apostasAbertas: !pelada.rows[0].EstatisticasIniciadas,
      jogadores: Object.values(porJogador).sort((a, b) => a.nome.localeCompare(b.nome)),
    });
  } catch (err) {
    console.error('[apostas:mercados:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar mercados de aposta.' });
  }
});

// PUT /api/apostas/mercados/:id  { odd }  (bet-admin) -> edita a odd de um mercado
// ainda não resolvido. Não afeta apostas já feitas (a odd fica congelada em cada uma).
router.put('/mercados/:id', requireAuth, requireBetAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const odd = Number(req.body.odd);
    if (!Number.isFinite(odd) || odd <= 1) {
      return res.status(400).json({ error: 'Informe uma odd válida (maior que 1).' });
    }
    const m = await query('SELECT "Resolvido" FROM "PeladaApostaMercados" WHERE "Id" = $1', [id]);
    if (m.rows.length === 0) return res.status(404).json({ error: 'Mercado não encontrado.' });
    if (m.rows[0].Resolvido) return res.status(400).json({ error: 'Esse mercado já foi resolvido.' });

    await query('UPDATE "PeladaApostaMercados" SET "Odd" = $1 WHERE "Id" = $2', [odd, id]);
    res.json({ ok: true, odd });
  } catch (err) {
    console.error('[apostas:mercado:odd]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar odd.' });
  }
});

// POST /api/apostas/mercados/:id/resolver  { resultado: bool }  (bet-admin) -> resolve
// manualmente mercados que não são AutoResolve (defesa, gol contra, cair no chão, etc).
router.post('/mercados/:id/resolver', requireAuth, requireBetAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const resultado = !!req.body.resultado;
    const m = await query(
      `SELECT mk."Resolvido", t."AutoResolve"
       FROM "PeladaApostaMercados" mk JOIN "TiposAposta" t ON t."Id" = mk."TipoApostaId"
       WHERE mk."Id" = $1`,
      [id]
    );
    if (m.rows.length === 0) return res.status(404).json({ error: 'Mercado não encontrado.' });
    if (m.rows[0].Resolvido) return res.status(400).json({ error: 'Esse mercado já foi resolvido.' });
    if (m.rows[0].AutoResolve) {
      return res.status(400).json({ error: 'Esse mercado resolve automaticamente ao finalizar a pelada.' });
    }

    await withTransaction((client) => liquidarMercado(client, id, resultado));
    res.json({ ok: true });
  } catch (err) {
    console.error('[apostas:mercado:resolver]', err.message);
    res.status(500).json({ error: 'Erro ao resolver mercado.' });
  }
});

// POST /api/apostas/mercados/:id/apostar  { valor }  -> aposta fichas num mercado aberto
router.post('/mercados/:id/apostar', requireAuth, async (req, res) => {
  try {
    const mercadoId = parseInt(req.params.id, 10);
    const valor = parseInt(req.body.valor, 10);
    if (!Number.isInteger(valor) || valor <= 0) {
      return res.status(400).json({ error: 'Informe um valor de aposta válido.' });
    }

    const m = await query(
      `SELECT mk."Id", mk."Odd", mk."Resolvido", p."EstatisticasIniciadas"
       FROM "PeladaApostaMercados" mk JOIN "Peladas" p ON p."Id" = mk."PeladaId"
       WHERE mk."Id" = $1`,
      [mercadoId]
    );
    if (m.rows.length === 0) return res.status(404).json({ error: 'Mercado não encontrado.' });
    const mercado = m.rows[0];
    if (mercado.Resolvido) return res.status(400).json({ error: 'Esse mercado já foi resolvido.' });
    if (mercado.EstatisticasIniciadas) return res.status(400).json({ error: 'Apostas encerradas para essa pelada.' });

    const existente = await query(
      'SELECT 1 FROM "PeladaApostas" WHERE "MercadoId" = $1 AND "UsuarioId" = $2',
      [mercadoId, req.user.id]
    );
    if (existente.rows.length > 0) return res.status(409).json({ error: 'Você já apostou nesse mercado.' });

    const saldoFichas = await withTransaction(async (client) => {
      const u = await client.query('SELECT "SaldoFichas" FROM "Usuarios" WHERE "Id" = $1', [req.user.id]);
      const saldoAtual = u.rows[0].SaldoFichas;
      if (saldoAtual < valor) throw Object.assign(new Error('Saldo de fichas insuficiente.'), { status: 400 });

      const saldoFinal = saldoAtual - valor;
      await client.query('UPDATE "Usuarios" SET "SaldoFichas" = $1 WHERE "Id" = $2', [saldoFinal, req.user.id]);

      const ins = await client.query(
        `INSERT INTO "PeladaApostas" ("MercadoId","UsuarioId","Valor","Odd")
         VALUES ($1,$2,$3,$4) RETURNING "Id"`,
        [mercadoId, req.user.id, valor, mercado.Odd]
      );
      await client.query(
        `INSERT INTO "FichasTransacoes" ("UsuarioId","Valor","Tipo","ApostaId","Descricao")
         VALUES ($1,$2,'aposta',$3,'Aposta realizada')`,
        [req.user.id, -valor, ins.rows[0].Id]
      );
      return saldoFinal;
    });

    res.status(201).json({ ok: true, saldoFichas, odd: Number(mercado.Odd) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'Você já apostou nesse mercado.' });
    console.error('[apostas:apostar]', err.message);
    res.status(500).json({ error: 'Erro ao registrar aposta.' });
  }
});

module.exports = router;
