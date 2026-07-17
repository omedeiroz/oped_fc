const express = require('express');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../db');
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

    const pool = await getPool();

    const existe = await pool
      .request()
      .input('usuario', sql.NVarChar(60), usuario)
      .query('SELECT Id FROM dbo.Usuarios WHERE Usuario = @usuario');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ error: 'Esse usuário já está em uso.' });
    }
    if (email) {
      const eEmail = await pool
        .request()
        .input('email', sql.NVarChar(160), email)
        .query('SELECT Id FROM dbo.Usuarios WHERE Email = @email');
      if (eEmail.recordset.length > 0) {
        return res.status(409).json({ error: 'Esse email já está em uso.' });
      }
    }

    // Primeiro usuário do sistema vira admin automaticamente
    const totalUsers = await pool.request().query('SELECT COUNT(*) AS total FROM dbo.Usuarios');
    const isFirst = totalUsers.recordset[0].total === 0;

    const senhaHash = await bcrypt.hash(senha, 10);

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const insUser = await new sql.Request(tx)
        .input('nome', sql.NVarChar(120), nome)
        .input('usuario', sql.NVarChar(60), usuario)
        .input('email', sql.NVarChar(160), email)
        .input('hash', sql.NVarChar(200), senhaHash)
        .input('isAdmin', sql.Bit, isFirst ? 1 : 0)
        .query(
          `INSERT INTO dbo.Usuarios (Nome, Usuario, Email, SenhaHash, IsAdmin)
           OUTPUT INSERTED.Id, INSERTED.Nome, INSERTED.Usuario, INSERTED.Email, INSERTED.IsAdmin
           VALUES (@nome, @usuario, @email, @hash, @isAdmin)`
        );
      const user = insUser.recordset[0];

      await new sql.Request(tx)
        .input('nome', sql.NVarChar(120), nome)
        .input('usuarioId', sql.Int, user.Id)
        .query(`INSERT INTO dbo.Jogadores (Nome, UsuarioId) VALUES (@nome, @usuarioId)`);

      await tx.commit();

      const token = signToken(user);
      return res.status(201).json({ token, user: publicUser(user) });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
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

    const pool = await getPool();
    const result = await pool
      .request()
      .input('usuario', sql.NVarChar(60), usuario)
      .query(
        `SELECT Id, Nome, Usuario, Email, SenhaHash, IsAdmin, Ativo
         FROM dbo.Usuarios WHERE Usuario = @usuario`
      );

    const user = result.recordset[0];
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

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      nome: req.user.nome,
      usuario: req.user.usuario,
      email: req.user.email,
      isAdmin: !!req.user.isAdmin,
    },
  });
});

function publicUser(u) {
  return { id: u.Id, nome: u.Nome, usuario: u.Usuario, email: u.Email, isAdmin: !!u.IsAdmin };
}

module.exports = router;
