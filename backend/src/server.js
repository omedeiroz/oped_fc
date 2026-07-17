const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getPool } = require('./db');

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jogadores', require('./routes/jogadores'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/peladas', require('./routes/peladas'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: 'conectado' });
  } catch (err) {
    res.status(500).json({ status: 'erro', db: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.listen(config.port, () => {
  console.log(`\n🟢 Pelada OPED FC - API rodando em http://localhost:${config.port}`);
  console.log(`   CORS liberado para: ${config.corsOrigin}`);
  // Aquece a conexão com o banco
  getPool()
    .then(() => console.log('   Banco: conectado ✅'))
    .catch((err) => console.error('   Banco: FALHA ❌\n', err.message));
});
