const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../db');
const { signToken, requireAuth, requireAdmin } = require('../middleware/auth');
const { enviarCodigoRecuperacao } = require('../services/email');

const router = express.Router();

function normalizeUsuario(u) {
  return String(u || '').trim().toLowerCase();
}
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function gerarCodigo() {
  return String(crypto.randomInt(100000, 1000000)); // 6 dígitos
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
         RETURNING "Id","Nome","Usuario","Email","IsAdmin","IsBetAdmin","Foto","SaldoFichas"`,
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
      `SELECT u."Id", u."Nome", u."Usuario", u."Email", u."SenhaHash", u."IsAdmin", u."IsBetAdmin",
              u."Ativo", u."Foto", u."SaldoFichas", j."Id" AS "JogadorId"
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

// POST /api/auth/esqueci-senha  { usuario, email } -> envia um código de 6 dígitos por email
// Identifica a conta pelo usuário (login), não pelo email — assim quem nunca
// cadastrou um email também consegue recuperar a senha: se a conta ainda não
// tiver email salvo, o email informado aqui é gravado como o dela.
router.post('/esqueci-senha', async (req, res) => {
  try {
    const usuario = normalizeUsuario(req.body.usuario);
    const email = normalizeEmail(req.body.email);
    if (!usuario || !email) return res.status(400).json({ error: 'Informe seu usuário e email.' });

    const r = await query('SELECT "Id", "Email" FROM "Usuarios" WHERE "Usuario" = $1 AND "Ativo" = true', [usuario]);
    if (r.rows.length > 0) {
      const conta = r.rows[0];
      const emailAtual = normalizeEmail(conta.Email);
      let podeEnviar = false;

      if (!emailAtual) {
        // Conta sem email cadastrado: tenta vincular o email informado agora.
        const emEmUso = await query('SELECT "Id" FROM "Usuarios" WHERE "Email" = $1 AND "Id" != $2', [email, conta.Id]);
        if (emEmUso.rows.length === 0) {
          await query('UPDATE "Usuarios" SET "Email" = $1 WHERE "Id" = $2', [email, conta.Id]);
          podeEnviar = true;
        }
      } else if (emailAtual === email) {
        podeEnviar = true;
      }

      if (podeEnviar) {
        const usuarioId = conta.Id;
        const codigo = gerarCodigo();
        const expiraEm = new Date(Date.now() + 15 * 60 * 1000);

        await query('UPDATE "RedefinicoesSenha" SET "Usado" = true WHERE "UsuarioId" = $1 AND "Usado" = false', [usuarioId]);
        await query(
          `INSERT INTO "RedefinicoesSenha" ("UsuarioId","Codigo","ExpiraEm") VALUES ($1,$2,$3)`,
          [usuarioId, codigo, expiraEm]
        );

        try {
          await enviarCodigoRecuperacao(email, codigo);
        } catch (mailErr) {
          console.error('[esqueci-senha:email]', mailErr.message);
        }
      }
    }

    // Resposta igual sempre — evita revelar se o usuário existe ou qual email está associado
    res.json({ ok: true });
  } catch (err) {
    console.error('[esqueci-senha]', err.message);
    res.status(500).json({ error: 'Erro ao processar o pedido.' });
  }
});

// POST /api/auth/redefinir-senha  { email, codigo, novaSenha }
router.post('/redefinir-senha', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const codigo = String(req.body.codigo || '').trim();
    const novaSenha = String(req.body.novaSenha || '');

    if (!email || !codigo || !novaSenha) {
      return res.status(400).json({ error: 'Preencha email, código e a nova senha.' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });
    }

    const u = await query('SELECT "Id" FROM "Usuarios" WHERE "Email" = $1 AND "Ativo" = true', [email]);
    if (u.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }
    const usuarioId = u.rows[0].Id;

    const c = await query(
      `SELECT "Id" FROM "RedefinicoesSenha"
       WHERE "UsuarioId" = $1 AND "Codigo" = $2 AND "Usado" = false AND "ExpiraEm" > $3
       ORDER BY "Id" DESC LIMIT 1`,
      [usuarioId, codigo, new Date()]
    );
    if (c.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await withTransaction(async (client) => {
      await client.query('UPDATE "Usuarios" SET "SenhaHash" = $1 WHERE "Id" = $2', [senhaHash, usuarioId]);
      await client.query('UPDATE "RedefinicoesSenha" SET "Usado" = true WHERE "Id" = $1', [c.rows[0].Id]);
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[redefinir-senha]', err.message);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});

// POST /api/auth/trocar-senha  { senhaAtual, novaSenha } -> troca a senha estando logado
router.post('/trocar-senha', requireAuth, async (req, res) => {
  try {
    const senhaAtual = String(req.body.senhaAtual || '');
    const novaSenha = String(req.body.novaSenha || '');
    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres.' });
    }

    const r = await query('SELECT "SenhaHash" FROM "Usuarios" WHERE "Id" = $1 AND "Ativo" = true', [req.user.id]);
    if (r.rows.length === 0) return res.status(401).json({ error: 'Sessão inválida.' });

    const ok = await bcrypt.compare(senhaAtual, r.rows[0].SenhaHash);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta.' });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await query('UPDATE "Usuarios" SET "SenhaHash" = $1 WHERE "Id" = $2', [senhaHash, req.user.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[trocar-senha]', err.message);
    res.status(500).json({ error: 'Erro ao trocar a senha.' });
  }
});

// POST /api/auth/testar-email  { destino } -> (admin) tenta enviar de verdade e devolve o erro real,
// pra diagnosticar problemas de SMTP em producao sem depender dos logs do host.
router.post('/testar-email', requireAuth, requireAdmin, async (req, res) => {
  const destino = normalizeEmail(req.body.destino);
  if (!destino) return res.status(400).json({ error: 'Informe o destino.' });
  try {
    const info = await enviarCodigoRecuperacao(destino, '000000');
    res.json({ ok: true, messageId: info && info.messageId, response: info && info.response });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, code: err.code });
  }
});

// GET /api/auth/me -> busca fresca no banco (garante isAdmin/foto atualizados, não confia só no JWT)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT u."Id", u."Nome", u."Usuario", u."Email", u."IsAdmin", u."IsBetAdmin", u."Foto",
              u."SaldoFichas", j."Id" AS "JogadorId"
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
    isAdmin: !!u.IsAdmin, isBetAdmin: !!u.IsBetAdmin, foto: u.Foto || null,
    jogadorId: u.JogadorId || null, saldoFichas: u.SaldoFichas ?? 0,
  };
}

module.exports = router;
