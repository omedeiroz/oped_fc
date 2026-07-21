import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome } from '../utils';

const ORDENACOES = [
  { key: 'Gols', label: '⚽ Artilheiros' },
  { key: 'Assistencias', label: '🅰️ Garçons' },
  { key: 'Vitorias', label: '🏆 Vitórias' },
  { key: 'Jogos', label: '📅 Presença' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [ordem, setOrdem] = useState('Gols');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([api.get('/stats'), api.get('/stats/resumo')]);
        setStats(s); setResumo(r);
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ranking = useMemo(
    () => [...stats].sort((a, b) => b[ordem] - a[ordem] || b.Gols - a.Gols || a.Nome.localeCompare(b.Nome)),
    [stats, ordem]
  );

  return (
    <div>
      <div className="diag-header">
        <div className="diag-title">Ranking</div>
        <div className="diag-sub">{resumo?.TotalPeladas ? `Temporada 2026 · ${resumo.TotalPeladas} peladas` : 'Temporada 2026'}</div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="tabs">
          {ORDENACOES.map((o) => (
            <button key={o.key} className={`tab ${ordem === o.key ? 'active' : ''}`} onClick={() => setOrdem(o.key)}>{o.label}</button>
          ))}
        </div>

        {erro && <div className="alert alert-error">{erro}</div>}
        {carregando ? (
          <div className="loading">Carregando…</div>
        ) : ranking.length === 0 ? (
          <div className="empty"><div className="big">⚽</div>Nenhuma estatística ainda.<br />Cadastre a primeira pelada!</div>
        ) : (
          <div className="rank-list">
            {ranking.map((j, i) => {
              const sou = user?.nome && j.Nome === user.nome;
              const destaque = i === 0 && j[ordem] > 0;
              return (
                <div className={`rank-row ${destaque ? 'top' : ''} ${sou ? 'me' : ''}`} key={j.Id}>
                  <span className="pos">{i + 1}</span>
                  <span className="avatar" style={{ background: corDoNome(j.Nome) }}>
                    {j.Foto ? <img src={j.Foto} alt="" /> : iniciais(j.Nome)}
                  </span>
                  <span className="nm">
                    {j.Nome}
                    <span className="sub" style={{ display: 'block' }}>{j.Jogos} jogos · {j.Gols}G · {j.Assistencias}A</span>
                  </span>
                  <span className="pts">{j[ordem]}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
