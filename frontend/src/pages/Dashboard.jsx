import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';

const ORDENACOES = [
  { key: 'Gols', label: '⚽ Artilheiros', hero: 'Artilheiro', metric: 'gols', cap: 'gols' },
  { key: 'Assistencias', label: '🅰️ Garçons', hero: 'Garçom', metric: 'assist', cap: 'assistências' },
  { key: 'Vitorias', label: '🏆 Vitórias', hero: 'Mais vitórias', metric: 'vitorias', cap: 'vitórias' },
  { key: 'Jogos', label: '📅 Presença', hero: 'Mais presente', metric: 'jogos', cap: 'jogos' },
];

function Spark({ valores }) {
  const ultimos = valores.slice(-6);
  const max = Math.max(1, ...ultimos);
  if (ultimos.length === 0) return <span className="spark" />;
  return (
    <span className="spark">
      {ultimos.map((v, i) => (
        <i key={i} className={v > 0 && v >= max ? 'hi' : ''} style={{ height: v <= 0 ? 4 : 6 + (v / max) * 14 }} />
      ))}
    </span>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState({});
  const [ordem, setOrdem] = useState('Gols');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, r, h] = await Promise.all([
          api.get('/stats'), api.get('/stats/resumo'), api.get('/stats/historico'),
        ]);
        setStats(s); setResumo(r); setHistorico(h);
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const conf = ORDENACOES.find((o) => o.key === ordem);
  const ranking = useMemo(
    () => [...stats].sort((a, b) => b[ordem] - a[ordem] || b.Gols - a.Gols || a.Nome.localeCompare(b.Nome)),
    [stats, ordem]
  );
  const lider = ranking[0] && ranking[0][ordem] > 0 ? ranking[0] : null;

  function sparkOf(jogadorId) {
    return (historico[jogadorId] || []).map((e) => e[conf.metric]);
  }

  if (carregando) return <div className="loading">Carregando estatísticas…</div>;
  if (erro) return <div className="alert alert-error">{erro}</div>;

  return (
    <div>
      <div className="between page-head">
        <div>
          <h1>Ranking geral</h1>
          <p>{resumo?.TotalPeladas ? `Temporada 2026 · ${resumo.TotalPeladas} peladas disputadas` : 'Ainda sem peladas'}</p>
        </div>
        {resumo && (
          <div className="head-stats">
            <div className="hs"><div className="n">{resumo.TotalJogadores}</div><div className="l">jogadores</div></div>
            <div className="hs"><div className="n accent">{resumo.TotalGols}</div><div className="l">gols</div></div>
            <div className="hs"><div className="n">{resumo.TotalAssist}</div><div className="l">assist.</div></div>
          </div>
        )}
      </div>

      <div className="tabs">
        {ORDENACOES.map((o) => (
          <button key={o.key} className={`tab ${ordem === o.key ? 'active' : ''}`} onClick={() => setOrdem(o.key)}>{o.label}</button>
        ))}
      </div>

      {!lider ? (
        <div className="empty"><div className="big">⚽</div>Nenhuma estatística ainda.<br />Cadastre a primeira pelada!</div>
      ) : (
        <div className="rank-wrap">
          <div className="rank-hero">
            <div className="cap">{conf.hero}</div>
            <div className="big">{lider[ordem]}</div>
            <div className="nome">{lider.Nome}</div>
            <div className="sub">{conf.cap} em {lider.Jogos} {lider.Jogos === 1 ? 'jogo' : 'jogos'}</div>
            <div className="badges">
              <span>🥇 líder</span>
              {lider.Jogos > 0 && <span>📅 {lider.Jogos} presenças</span>}
            </div>
          </div>

          <div>
            {ranking.map((j, i) => {
              const destaque = i === 0;
              return (
                <div className={`rank-line ${j[ordem] === 0 ? 'dim' : ''}`} key={j.Id}>
                  <span className="name">{i + 1} · {j.Nome}</span>
                  <span className="right">
                    <Spark valores={sparkOf(j.Id)} />
                    <span className={`val ${destaque && j[ordem] > 0 ? 'hot' : ''}`}>{j[ordem]}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
