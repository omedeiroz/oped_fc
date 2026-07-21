const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

function normalizeUsuario(u) {
  return String(u || '').trim().toLowerCase();
}
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// POST /api/auth/register  { nome, usuario, senha, email? }
router.post('/register', async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const usuario = normalizeUsuario(req.body.usuario);
    const email = normalizeEmail(req.body.email) || null;
    const senha = String(req.body.senha || '');

    if (!nome || !usuario || !senha) {
      return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
    }
    if (!/^[a-z0-9._-]{3,60}$/.test(usuario)) {
      return res.status(400).json({
        error: 'Usuário deve ter 3+ caracteres (letras, números, ponto, hífen ou _), sem espaços.',
      });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
    }

    const existe = await query('SELECT "Id" FROM "Usuarios" WHERE "Usuario" = $1', [usuario]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Esse usuário já está em uso.' });
    }
    if (email) {
      const eEmail = await query('SELECT "Id" FROM "Usuarios" WHERE "Email" = $1', [email]);
      if (eEmail.rows.length > 0) {
        return res.status(409).json({ error: 'Esse email já está em uso.' });
      }
    }

    // Primeiro usuário do sistema vira admin automaticamente
    const totalUsers = await query('SELECT COUNT(*)::int AS total FROM "Usuarios"');
    const isFirst = totalUsers.rows[0].total === 0;

    const senhaHash = await bcrypt.hash(senha, 10);

    const user = await withTransaction(async (client) => {
      const insUser = await client.query(
        `INSERT INTO "Usuarios" ("Nome","Usuario","Email","SenhaHash","IsAdmin")
         VALUES ($1,$2,$3,$4,$5)
         RETURNING "Id","Nome","Usuario","Email","IsAdmin","Foto"`,
        [nome, usuario, email, senhaHash, isFirst]
      );
      const u = insUser.rows[0];

      const insJog = await client.query(
        `INSERT INTO "Jogadores" ("Nome","UsuarioId") VALUES ($1,$2) RETURNING "Id"`,
        [nome, u.Id]
      );
      u.JogadorId = insJog.rows[0].Id;
      return u;
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[register]', err.message);
    return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// POST /api/auth/login  { usuario, senha }
router.post('/login', async (req, res) => {
  try {
    const usuario = normalizeUsuario(req.body.usuario);
    const senha = String(req.body.senha || '');
    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Informe usuário e senha.' });
    }

    const result = await query(
      `SELECT u."Id", u."Nome", u."Usuario", u."Email", u."SenhaHash", u."IsAdmin", u."Ativo", u."Foto",
              j."Id" AS "JogadorId"
       FROM "Usuarios" u
       LEFT JOIN "Jogadores" j ON j."UsuarioId" = u."Id"
       WHERE u."Usuario" = $1`,
      [usuario]
    );

    const user = result.rows[0];
    if (!user || !user.Ativo) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }
    const ok = await bcrypt.compare(senha, user.SenhaHash);
    if (!ok) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// GET /api/auth/me -> busca fresca no banco (garante isAdmin/foto atualizados, não confia só no JWT)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT u."Id", u."Nome", u."Usuario", u."Email", u."IsAdmin", u."Foto", j."Id" AS "JogadorId"
       FROM "Usuarios" u
       LEFT JOIN "Jogadores" j ON j."UsuarioId" = u."Id"
       WHERE u."Id" = $1 AND u."Ativo" = true`,
      [req.user.id]
    );
    if (r.rows.length === 0) return res.status(401).json({ error: 'Sessão inválida.' });
    res.json({ user: publicUser(r.rows[0]) });
  } catch (err) {
    console.error('[auth:me]', err.message);
    res.status(500).json({ error: 'Erro ao carregar sessão.' });
  }
});

function publicUser(u) {
  return {
    id: u.Id, nome: u.Nome, usuario: u.Usuario, email: u.Email,
    isAdmin: !!u.IsAdmin, foto: u.Foto || null, jogadorId: u.JogadorId || null,
  };
}

module.exports = router;
