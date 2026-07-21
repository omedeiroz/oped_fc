const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

// Pool único (o driver Neon serverless tuneliza o protocolo Postgres via
// WebSocket na porta 443 — necessário porque a rede local bloqueia a 5432).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getPool() {
  return pool;
}

// Executa uma query simples fora de transação
async function query(text, params = []) {
  return pool.query(text, params);
}

// Executa `fn(client)` dentro de uma transação (BEGIN/COMMIT/ROLLBACK).
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, getPool, query, withTransaction };
