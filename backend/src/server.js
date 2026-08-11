const express = require('express');
const cors = require('cors');
const config = require('./config');
const { pool } = require('./db');

const app = express();
// Aceita qualquer subdomínio *.vercel.app (produção + previews automáticos)
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

app.use(cors({
  origin(origin, callback) {
    // Sem Origin (curl, apps nativos), na lista liberada, ou é um deploy da Vercel
    if (!origin || config.corsOrigins.includes(origin) || VERCEL_ORIGIN.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origem não permitida: ${origin}`));
  },
}));
app.use(express.json());

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jogadores', require('./routes/jogadores'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/peladas', require('./routes/peladas'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/apostas', require('./routes/apostas'));

app.get('/api/health', async (req, res) => {
  const email = !!process.env.RESEND_API_KEY;
  try {
    await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: 'conectado', email });
  } catch (err) {
    res.status(500).json({ status: 'erro', db: err.message, email });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.listen(config.port, () => {
  console.log(`\n🟢 Pelada OPED FC - API rodando em http://localhost:${config.port}`);
  console.log(`   CORS liberado para: ${config.corsOrigins.join(', ')}`);
  // Aquece a conexão com o banco
  pool.query('SELECT 1')
    .then(() => console.log('   Banco: conectado ✅'))
    .catch((err) => console.error('   Banco: FALHA ❌\n', err.message));
});
