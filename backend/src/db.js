const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

// Lista de drivers ODBC tentados (do mais novo para o mais antigo).
// Se DB_ODBC_DRIVER estiver definido no .env, ele tem prioridade.
const DRIVER_CANDIDATES = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'ODBC Driver 13 for SQL Server',
  'SQL Server Native Client 11.0',
  'SQL Server',
];

function buildConnectionString(driverName) {
  const server = process.env.DB_SERVER || '192.168.250.8,61433';
  const database = process.env.DB_DATABASE || 'OPED_FC';
  // Trusted_Connection = autenticação integrada do Windows.
  // Encrypt=no + TrustServerCertificate para evitar erro de certificado (driver 18).
  return (
    `Driver={${driverName}};` +
    `Server=${server};` +
    `Database=${database};` +
    `Trusted_Connection=Yes;` +
    `Encrypt=no;` +
    `TrustServerCertificate=Yes;`
  );
}

function driverList() {
  const forced = (process.env.DB_ODBC_DRIVER || '').trim();
  return forced ? [forced] : DRIVER_CANDIDATES;
}

let poolPromise = null;
let activeDriver = null;

async function connect() {
  const errors = [];
  for (const driver of driverList()) {
    try {
      const pool = await new sql.ConnectionPool({
        connectionString: buildConnectionString(driver),
      }).connect();
      activeDriver = driver;
      console.log(`[db] Conectado ao SQL Server usando driver: ${driver}`);
      return pool;
    } catch (err) {
      errors.push(`  - "${driver}": ${err.message}`);
    }
  }
  const msg =
    'Não foi possível conectar ao SQL Server com nenhum driver ODBC.\n' +
    'Tentativas:\n' +
    errors.join('\n');
  throw new Error(msg);
}

// Pool singleton
function getPool() {
  if (!poolPromise) {
    poolPromise = connect().catch((err) => {
      poolPromise = null; // permite nova tentativa depois
      throw err;
    });
  }
  return poolPromise;
}

async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(text);
}

module.exports = { sql, getPool, query, buildConnectionString, driverList, get activeDriver() { return activeDriver; } };
