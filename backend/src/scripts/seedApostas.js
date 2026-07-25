// Prepara o sistema de apostas: promove arthur.pereira a bet-admin, cria as
// categorias padrão e aplica os tiers combinados. Seguro rodar mais de uma vez.
// Uso: node src/scripts/seedApostas.js
const { pool } = require('../db');

const CATEGORIAS = [
  { nome: 'Gol', chave: 'gol', autoResolve: true, oddSPlus: 1.8, oddA: 2.5, oddB: 3.5 },
  { nome: 'Assistência', chave: 'assistencia', autoResolve: true, oddSPlus: 2.0, oddA: 2.8, oddB: 4.0 },
  { nome: 'Defesa', chave: 'defesa', autoResolve: false, oddSPlus: 3.0, oddA: 3.5, oddB: 4.5 },
  { nome: 'Gol Contra', chave: 'gol_contra', autoResolve: false, oddSPlus: 6.0, oddA: 6.0, oddB: 6.0 },
  { nome: 'Cair no Chão', chave: 'cair_no_chao', autoResolve: false, oddSPlus: 4.0, oddA: 4.0, oddB: 4.0 },
];

const TIER_S_PLUS = ['Arthur Medeiros', 'Israel Louback'];
const TIER_A = ['Renan Brega', 'Diego Nascimento', 'Jhonatan Oliveira', 'Ticiano', 'Banhato', 'Iago'];

async function aplicarTier(nomeBusca, tier) {
  const r = await pool.query(
    'SELECT "Id","Nome" FROM "Jogadores" WHERE "Nome" ILIKE $1',
    [`%${nomeBusca}%`]
  );
  if (r.rows.length === 0) {
    console.log(`  ⚠️  Nenhum jogador encontrado pra "${nomeBusca}" — pulei.`);
    return;
  }
  if (r.rows.length > 1) {
    console.log(`  ⚠️  "${nomeBusca}" casou com mais de um jogador (${r.rows.map((x) => x.Nome).join(', ')}) — pulei, ajuste manualmente.`);
    return;
  }
  await pool.query('UPDATE "Jogadores" SET "Tier" = $1 WHERE "Id" = $2', [tier, r.rows[0].Id]);
  console.log(`  ✅ ${r.rows[0].Nome} -> tier ${tier}`);
}

(async () => {
  try {
    console.log('1. Promovendo arthur.pereira a bet-admin...');
    const promo = await pool.query(
      'UPDATE "Usuarios" SET "IsBetAdmin" = true WHERE "Usuario" = $1 RETURNING "Nome"',
      ['arthur.pereira']
    );
    if (promo.rows.length > 0) console.log(`  ✅ ${promo.rows[0].Nome} agora administra apostas.`);
    else console.log('  ⚠️  Usuário arthur.pereira não encontrado — pulei.');

    console.log('2. Criando categorias de aposta padrão...');
    for (const c of CATEGORIAS) {
      const r = await pool.query(
        `INSERT INTO "TiposAposta" ("Nome","Chave","AutoResolve","OddSPlus","OddA","OddB")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ("Chave") DO NOTHING
         RETURNING "Nome"`,
        [c.nome, c.chave, c.autoResolve, c.oddSPlus, c.oddA, c.oddB]
      );
      console.log(r.rows.length > 0 ? `  ✅ ${c.nome}` : `  ↷ ${c.nome} (já existia)`);
    }

    console.log('3. Aplicando tiers...');
    console.log(' Tier S+:');
    for (const nome of TIER_S_PLUS) await aplicarTier(nome, 'S+');
    console.log(' Tier A:');
    for (const nome of TIER_A) await aplicarTier(nome, 'A');

    console.log('\nPronto. Peça pro arthur.pereira deslogar e logar de novo (o token precisa ser reemitido com isBetAdmin).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
