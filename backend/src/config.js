require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-troque-isto',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
};
