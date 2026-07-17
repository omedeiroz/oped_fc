const jwt = require('jsonwebtoken');
const config = require('../config');

// Verifica o token JWT e popula req.user = { id, nome, email, isAdmin }
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

// Exige que o usuário autenticado seja admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

function signToken(user) {
  return jwt.sign(
    { id: user.Id, nome: user.Nome, usuario: user.Usuario, email: user.Email, isAdmin: !!user.IsAdmin },
    config.jwtSecret,
    { expiresIn: config.jwtExpires }
  );
}

module.exports = { requireAuth, requireAdmin, signToken };
