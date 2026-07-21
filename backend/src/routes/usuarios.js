const express = require('express');
const { query, withTransaction } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Limite generoso: a imagem já vem redimensionada/comprimida pelo navegador antes de chegar aqui
const FOTO_MAX_CHARS = 2_000_000;

// PUT /api/usuarios/me/foto  { foto: 'data:image/jpeg;base64,...' | null }
router.put('/me/foto', requireAuth, async (req, res) => {
  try {
    const foto = req.body.foto === null ? null : String(req.body.foto || '');
    if (foto && !/^data:image\/(png|jpe?g|webp);base64,/.test(foto)) {
      return res.status(400).json({ error: 'Formato de imagem inválido.' });
    }
    if (foto && foto.length > FOTO_MAX_CHARS) {
      return res.status(400).json({ error: 'Imagem muito grande. Tente uma foto menor.' });
    }
    await query('UPDATE "Usuarios" SET "Foto" = $1 WHERE "Id" = $2', [foto, req.user.id]);
    res.json({ ok: true, foto });
  } catch (err) {
    console.error('[usuarios:foto]', err.message);
    res.status(500).json({ error: 'Erro ao salvar foto.' });
  }
});

// GET /api/usuarios  -> lista de usuários ativos (admin) para gerenciar quem é admin
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query(
      `SELECT "Id","Nome","Usuario","Email","IsAdmin","Ativo","CriadoEm"
       FROM "Usuarios" WHERE "Ativo" = true ORDER BY "Nome"`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[usuarios:list]', err.message);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

// PATCH /api/usuarios/:id/admin  { isAdmin: true|false }  (admin)
router.patch('/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const isAdmin = !!req.body.isAdmin;

    // Impede remover o último admin do sistema
    if (!isAdmin) {
      const c = await query(
        'SELECT COUNT(*)::int AS total FROM "Usuarios" WHERE "IsAdmin" = true AND "Ativo" = true'
      );
      if (c.rows[0].total <= 1) {
        return res.status(400).json({ error: 'Não é possível remover o último administrador.' });
      }
    }

    await query('UPDATE "Usuarios" SET "IsAdmin" = $1 WHERE "Id" = $2', [isAdmin, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[usuarios:admin]', err.message);
    res.status(500).json({ error: 'Erro ao atualizar permissão.' });
  }
});

// DELETE /api/usuarios/:id  (admin) -> remove um usuário do sistema
// Se o jogador vinculado nunca participou de nenhuma pelada, apaga tudo (conta + jogador).
// Se já tem estatísticas registradas, apenas desativa (preserva histórico/ranking).
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
  }

  try {
    const alvo = await query('SELECT "Id","IsAdmin" FROM "Usuarios" WHERE "Id" = $1 AND "Ativo" = true', [id]);
    if (alvo.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (alvo.rows[0].IsAdmin) {
      const c = await query(
        'SELECT COUNT(*)::int AS total FROM "Usuarios" WHERE "IsAdmin" = true AND "Ativo" = true'
      );
      if (c.rows[0].total <= 1) {
        return res.status(400).json({ error: 'Não é possível excluir o último administrador.' });
      }
    }

    const jog = await query('SELECT "Id" FROM "Jogadores" WHERE "UsuarioId" = $1', [id]);
    const jogadorId = jog.rows[0] ? jog.rows[0].Id : null;

    let temHistorico = false;
    if (jogadorId) {
      const h = await query('SELECT COUNT(*)::int AS total FROM "PeladaParticipacoes" WHERE "JogadorId" = $1', [jogadorId]);
      temHistorico = h.rows[0].total > 0;
    }

    const modo = jogadorId && !temHistorico ? 'excluido' : 'desativado';

    await withTransaction(async (client) => {
      if (modo === 'excluido') {
        // Nunca jogou: pode remover tudo com segurança
        await client.query('DELETE FROM "PeladaPresencas" WHERE "JogadorId" = $1', [jogadorId]);
        await client.query('DELETE FROM "PeladaComentarios" WHERE "UsuarioId" = $1', [id]);
        await client.query('DELETE FROM "Jogadores" WHERE "Id" = $1', [jogadorId]);
        await client.query('DELETE FROM "Usuarios" WHERE "Id" = $1', [id]);
      } else {
        // Já tem estatísticas/comentários: desativa em vez de apagar, para preservar o histórico
        if (jogadorId) {
          await client.query('UPDATE "Jogadores" SET "Ativo" = false WHERE "Id" = $1', [jogadorId]);
        }
        await client.query('UPDATE "Usuarios" SET "Ativo" = false WHERE "Id" = $1', [id]);
      }
    });

    res.json({ ok: true, modo });
  } catch (err) {
    console.error('[usuarios:delete]', err.message);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

module.exports = router;
