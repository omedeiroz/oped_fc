const express = require('express');
const { query, withTransaction } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { calcularResultado, NOTAS_VALIDAS } = require('../services/votacao');

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
      `SELECT p."Id", p."DataPelada", p."Local", p."NumTimes", p."Observacao", p."Finalizada", p."EstatisticasIniciadas",
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
    const tot = await query('SELECT COUNT(*)::int AS n FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [pelada.Id]);

    const jog = await jogadorDoUsuario(req.user.id);
    let confirmadoPorMim = false;
    let souConvocado = false;
    if (jog) {
      const p = await query('SELECT 1 FROM "PeladaParticipacoes" WHERE "PeladaId" = $1 AND "JogadorId" = $2', [pelada.Id, jog]);
      souConvocado = p.rows.length > 0;
      const m = await query('SELECT 1 FROM "PeladaPresencas" WHERE "PeladaId" = $1 AND "JogadorId" = $2', [pelada.Id, jog]);
      confirmadoPorMim = m.rows.length > 0;
    }

    res.json({
      ...pelada,
      confirmados: conf.rows[0].n,
      totalJogadores: tot.rows[0].n,
      confirmadoPorMim,
      souConvocado,
    });
  } catch (err) {
    console.error('[peladas:proxima]', err.message);
    res.status(500).json({ error: 'Erro ao buscar próxima pelada.' });
  }
});

// GET /api/peladas/pendentes-votacao -> peladas finalizadas onde participei e ainda faltam votos meus
router.get('/pendentes-votacao', requireAuth, async (req, res) => {
  try {
    const meuJogador = await jogadorDoUsuario(req.user.id);
    if (!meuJogador) return res.json([]);

    const r = await query(
      `SELECT p."Id", p."DataPelada", p."Local"
       FROM "Peladas" p
       JOIN "PeladaParticipacoes" pp ON pp."PeladaId" = p."Id" AND pp."JogadorId" = $1
       WHERE p."Finalizada" = true
       ORDER BY p."DataPelada" DESC`,
      [meuJogador]
    );

    const pendentes = [];
    for (const p of r.rows) {
      const outros = await query(
        `SELECT pp."JogadorId" AS "Id" FROM "PeladaParticipacoes" pp WHERE pp."PeladaId" = $1 AND pp."JogadorId" <> $2`,
        [p.Id, meuJogador]
      );
      if (outros.rows.length === 0) continue;

      const meusVotos = await query(
        `SELECT "AvaliadoJogadorId" FROM "PeladaVotos" WHERE "PeladaId" = $1 AND "VotanteJogadorId" = $2`,
        [p.Id, meuJogador]
      );
      const jaVotei = new Set(meusVotos.rows.map((v) => v.AvaliadoJogadorId));
      const faltam = outros.rows.filter((o) => !jaVotei.has(o.Id)).length;
      if (faltam > 0) pendentes.push({ ...p, faltam });
    }
    res.json(pendentes);
  } catch (err) {
    console.error('[peladas:pendentes-votacao]', err.message);
    res.status(500).json({ error: 'Erro ao buscar peladas pendentes de votação.' });
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

    const presencas = await query('SELECT "JogadorId" FROM "PeladaPresencas" WHERE "PeladaId" = $1', [id]);

    res.json({
      pelada: pelada.rows[0],
      times: times.rows,
      participacoes: participacoes.rows,
      confirmados: presencas.rows.map((p) => p.JogadorId),
    });
  } catch (err) {
    console.error('[peladas:get]', err.message);
    res.status(500).json({ error: 'Erro ao buscar pelada.' });
  }
});

// POST /api/peladas  (admin) -> Parte 1: cria a pelada com data/local/times/jogadores.
// Sem estatísticas ainda (gols/assistências/V-E-D ficam zerados até a Parte 2).
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { dataPelada, local, observacao } = req.body;
  const times = Array.isArray(req.body.times) ? req.body.times : [];
  const participacoes = Array.isArray(req.body.participacoes) ? req.body.participacoes : [];

  if (!dataPelada) return res.status(400).json({ error: 'Informe a data da pelada.' });
  if (times.length < 2) return res.status(400).json({ error: 'A pelada precisa de ao menos 2 times.' });

  try {
    const peladaId = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO "Peladas" ("DataPelada","Local","NumTimes","Observacao","CriadoPor")
         VALUES ($1,$2,$3,$4,$5) RETURNING "Id"`,
        [dataPelada, local || null, times.length, observacao || null, req.user.id]
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

// PUT /api/peladas/:id  (admin) -> Parte 1: edita dados/times/jogadores (permite re-sortear).
// Bloqueado assim que a Parte 2 (estatísticas) já foi iniciada, pra não embaralhar
// jogadores que já têm gols/assistências registrados.
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { dataPelada, local, observacao } = req.body;
  const times = Array.isArray(req.body.times) ? req.body.times : [];
  const participacoes = Array.isArray(req.body.participacoes) ? req.body.participacoes : [];

  if (!dataPelada) return res.status(400).json({ error: 'Informe a data da pelada.' });
  if (times.length < 2) return res.status(400).json({ error: 'A pelada precisa de ao menos 2 times.' });

  try {
    const atual = await query('SELECT "EstatisticasIniciadas" FROM "Peladas" WHERE "Id" = $1', [id]);
    if (atual.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });
    if (atual.rows[0].EstatisticasIniciadas) {
      return res.status(400).json({
        error: 'Não é possível reorganizar os times: as estatísticas dessa pelada já começaram a ser preenchidas.',
      });
    }

    await withTransaction(async (client) => {
      // Remove participações e times antigos (ordem importa por causa das FKs)
      await client.query('DELETE FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [id]);
      await client.query('DELETE FROM "PeladaTimes" WHERE "PeladaId" = $1', [id]);

      await client.query(
        `UPDATE "Peladas"
         SET "DataPelada"=$1, "Local"=$2, "NumTimes"=$3, "Observacao"=$4
         WHERE "Id"=$5`,
        [dataPelada, local || null, times.length, observacao || null, id]
      );

      await salvarTimesEParticipacoes(client, id, times, participacoes);
    });
    res.json({ id });
  } catch (err) {
    console.error('[peladas:update]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar pelada.' });
  }
});

// PUT /api/peladas/:id/estatisticas  (admin) -> Parte 2: gols/assistências por jogador
// e vitórias/empates/derrotas por time. Não mexe na composição dos times.
router.put('/:id/estatisticas', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const times = Array.isArray(req.body.times) ? req.body.times : [];
  const participacoes = Array.isArray(req.body.participacoes) ? req.body.participacoes : [];

  try {
    const pelada = await query('SELECT "Id" FROM "Peladas" WHERE "Id" = $1', [id]);
    if (pelada.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });

    const timesValidos = new Set((await query('SELECT "Id" FROM "PeladaTimes" WHERE "PeladaId" = $1', [id])).rows.map((t) => t.Id));
    const partValidas = new Set((await query('SELECT "Id" FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [id])).rows.map((p) => p.Id));

    await withTransaction(async (client) => {
      for (const t of times) {
        const timeId = parseInt(t.id, 10);
        if (!timesValidos.has(timeId)) continue;
        await client.query(
          `UPDATE "PeladaTimes" SET "Vitorias"=$1, "Empates"=$2, "Derrotas"=$3 WHERE "Id"=$4`,
          [parseInt(t.vitorias, 10) || 0, parseInt(t.empates, 10) || 0, parseInt(t.derrotas, 10) || 0, timeId]
        );
      }
      for (const p of participacoes) {
        const partId = parseInt(p.id, 10);
        if (!partValidas.has(partId)) continue;
        await client.query(
          `UPDATE "PeladaParticipacoes" SET "Gols"=$1, "Assistencias"=$2 WHERE "Id"=$3`,
          [parseInt(p.gols, 10) || 0, parseInt(p.assistencias, 10) || 0, partId]
        );
      }
      await client.query('UPDATE "Peladas" SET "EstatisticasIniciadas" = true WHERE "Id" = $1', [id]);
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[peladas:estatisticas]', err.message);
    res.status(500).json({ error: 'Erro ao salvar estatísticas.' });
  }
});

// DELETE /api/peladas/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM "PeladaVotos" WHERE "PeladaId" = $1', [id]);
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

    const participa = await query(
      'SELECT 1 FROM "PeladaParticipacoes" WHERE "PeladaId" = $1 AND "JogadorId" = $2',
      [id, jog]
    );
    if (participa.rows.length === 0) {
      return res.status(403).json({ error: 'Você não foi convocado para essa pelada.' });
    }

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

// POST /api/peladas/:id/finalizar  (admin) -> Parte 3: fecha a pelada e abre a votação MVP/LVP.
// Exige que a Parte 2 (estatísticas) já tenha sido preenchida.
router.post('/:id/finalizar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const atual = await query('SELECT "EstatisticasIniciadas" FROM "Peladas" WHERE "Id" = $1', [id]);
    if (atual.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });
    if (!atual.rows[0].EstatisticasIniciadas) {
      return res.status(400).json({ error: 'Adicione as estatísticas da pelada antes de finalizar.' });
    }
    await query(`UPDATE "Peladas" SET "Finalizada" = true WHERE "Id" = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[peladas:finalizar]', err.message);
    res.status(500).json({ error: 'Erro ao finalizar pelada.' });
  }
});

// GET /api/peladas/:id/votacao -> estado da votação MVP/LVP (para a tela de votar + resultado)
router.get('/:id/votacao', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pelada = await query('SELECT "Id","Finalizada" FROM "Peladas" WHERE "Id" = $1', [id]);
    if (pelada.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });
    if (!pelada.rows[0].Finalizada) {
      return res.status(400).json({ error: 'Essa pelada ainda não foi finalizada.' });
    }

    const meuJogador = await jogadorDoUsuario(req.user.id);

    const participantesRes = await query(
      `SELECT j."Id", j."Nome", u."Foto"
       FROM "PeladaParticipacoes" pp
       JOIN "Jogadores" j ON j."Id" = pp."JogadorId"
       LEFT JOIN "Usuarios" u ON u."Id" = j."UsuarioId"
       WHERE pp."PeladaId" = $1
       ORDER BY j."Nome"`,
      [id]
    );

    let meusVotos = {};
    if (meuJogador) {
      const mv = await query(
        `SELECT "AvaliadoJogadorId","Nota" FROM "PeladaVotos" WHERE "PeladaId" = $1 AND "VotanteJogadorId" = $2`,
        [id, meuJogador]
      );
      mv.rows.forEach((v) => { meusVotos[v.AvaliadoJogadorId] = Number(v.Nota); });
    }

    const podeVotar = !!meuJogador && participantesRes.rows.some((p) => p.Id === meuJogador);
    const outros = participantesRes.rows
      .filter((p) => p.Id !== meuJogador)
      .map((p) => ({ jogadorId: p.Id, nome: p.Nome, foto: p.Foto || null, nota: meusVotos[p.Id] ?? null }));

    const resultado = await calcularResultado(id);

    res.json({
      podeVotar,
      participantes: outros,
      completo: resultado.completo,
      recebidos: resultado.recebidos,
      esperado: resultado.esperado,
      mvp: resultado.mvp,
      lvp: resultado.lvp,
      medias: resultado.medias,
    });
  } catch (err) {
    console.error('[peladas:votacao:get]', err.message);
    res.status(500).json({ error: 'Erro ao carregar votação.' });
  }
});

// POST /api/peladas/:id/votos { votos: [{ avaliadoJogadorId, nota }] } -> registra/atualiza meus votos
router.post('/:id/votos', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const votos = Array.isArray(req.body.votos) ? req.body.votos : [];

    const pelada = await query('SELECT "Finalizada" FROM "Peladas" WHERE "Id" = $1', [id]);
    if (pelada.rows.length === 0) return res.status(404).json({ error: 'Pelada não encontrada.' });
    if (!pelada.rows[0].Finalizada) {
      return res.status(400).json({ error: 'Essa pelada ainda não foi finalizada.' });
    }

    const meuJogador = await jogadorDoUsuario(req.user.id);
    if (!meuJogador) return res.status(400).json({ error: 'Seu usuário não tem jogador vinculado.' });

    const participantes = await query('SELECT "JogadorId" FROM "PeladaParticipacoes" WHERE "PeladaId" = $1', [id]);
    const idsValidos = new Set(participantes.rows.map((p) => p.JogadorId));
    if (!idsValidos.has(meuJogador)) {
      return res.status(403).json({ error: 'Você não participou dessa pelada.' });
    }
    if (votos.length === 0) {
      return res.status(400).json({ error: 'Envie ao menos uma avaliação.' });
    }

    for (const v of votos) {
      const alvo = parseInt(v.avaliadoJogadorId, 10);
      const nota = Number(v.nota);
      if (alvo === meuJogador) return res.status(400).json({ error: 'Você não pode votar em si mesmo.' });
      if (!idsValidos.has(alvo)) return res.status(400).json({ error: 'Jogador avaliado não participou dessa pelada.' });
      if (!NOTAS_VALIDAS.has(nota)) return res.status(400).json({ error: 'Nota inválida (use de 0.5 a 5, em passos de 0.5).' });
    }

    await withTransaction(async (client) => {
      for (const v of votos) {
        await client.query(
          `INSERT INTO "PeladaVotos" ("PeladaId","VotanteJogadorId","AvaliadoJogadorId","Nota")
           VALUES ($1,$2,$3,$4)
           ON CONFLICT ("PeladaId","VotanteJogadorId","AvaliadoJogadorId")
           DO UPDATE SET "Nota" = EXCLUDED."Nota"`,
          [id, meuJogador, parseInt(v.avaliadoJogadorId, 10), Number(v.nota)]
        );
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[peladas:votos:create]', err.message);
    res.status(500).json({ error: 'Erro ao registrar votos.' });
  }
});

module.exports = router;
