require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  // Aceita uma lista separada por vírgula (ex.: localhost + IP da rede local)
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-troque-isto',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
};
