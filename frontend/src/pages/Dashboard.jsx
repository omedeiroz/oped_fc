import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { iniciais, corDoNome } from '../utils';

const ORDENACOES = [
  { key: 'Gols', label: '⚽ Artilheiros', cap: 'gols' },
  { key: 'Assistencias', label: '🅰️ Garçons', cap: 'assist.' },
  { key: 'Vitorias', label: '🏆 Vitórias', cap: 'vitórias' },
  { key: 'Jogos', label: '📅 Presença', cap: 'jogos' },
];
const MEDALHAS = ['🥇', '🥈', '🥉'];

export default function Dashboard() {
  const [stats, setStats] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [ordem, setOrdem] = useState('Gols');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([api.get('/stats'), api.get('/stats/resumo')]);
        setStats(s);
        setResumo(r);
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
  const podio = ranking.slice(0, 3).filter((j) => j[ordem] > 0);

  if (carregando) return <div className="loading">Carregando estatísticas…</div>;
  if (erro) return <div className="alert alert-error">{erro}</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Ranking geral</h1>
        <p>Estatísticas acumuladas de todas as peladas.</p>
      </div>

      {resumo && (
        <div className="stat-grid">
          <div className="stat verde"><div className="ico">📅</div><div className="n">{resumo.TotalPeladas}</div><div className="l">Peladas</div></div>
          <div className="stat"><div className="ico">👥</div><div className="n">{resumo.TotalJogadores}</div><div className="l">Jogadores</div></div>
          <div className="stat amarelo"><div className="ico">⚽</div><div className="n">{resumo.TotalGols}</div><div className="l">Gols</div></div>
          <div className="stat"><div className="ico">🅰️</div><div className="n">{resumo.TotalAssist}</div><div className="l">Assistências</div></div>
        </div>
      )}

      <div className="between">
        <div className="segmented">
          {ORDENACOES.map((o) => (
            <button key={o.key} className={ordem === o.key ? 'active' : ''} onClick={() => setOrdem(o.key)}>{o.label}</button>
          ))}
        </div>
      </div>

      {podio.length > 0 && (
        <div className="podium">
          {podio.map((j, i) => (
            <div className={`podium-card p${i + 1}`} key={j.Id}>
              <span className="medal">{MEDALHAS[i]}</span>
              <div className="avatar lg" style={{ background: corDoNome(j.Nome) }}>{iniciais(j.Nome)}</div>
              <div className="nome">{j.Nome}</div>
              <div className="val">{j[ordem]}</div>
              <div className="cap">{conf.cap}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {ranking.length === 0 ? (
          <div className="empty"><div className="big">⚽</div>Nenhuma estatística ainda.<br />Cadastre a primeira pelada!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Jogador</th>
                  <th className="num">Jogos</th>
                  <th className="num">Gols</th>
                  <th className="num">Assist.</th>
                  <th className="num">Vitórias</th>
                  <th className="num">G+A</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((j, i) => (
                  <tr key={j.Id}>
                    <td><span className={`rank-badge ${i < 3 ? 'top' + (i + 1) : ''}`}>{i + 1}</span></td>
                    <td>
                      <div className="cell-jog">
                        <div className="avatar sm" style={{ background: corDoNome(j.Nome) }}>{iniciais(j.Nome)}</div>
                        <span style={{ fontWeight: 600 }}>{j.Nome}</span>
                      </div>
                    </td>
                    <td className="num">{j.Jogos}</td>
                    <td className="num gols">{j.Gols}</td>
                    <td className="num">{j.Assistencias}</td>
                    <td className="num">{j.Vitorias}</td>
                    <td className="num">{j.Participacoes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
