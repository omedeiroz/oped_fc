import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function parsePartes(iso) {
  const d = new Date(iso);
  return { dia: String(d.getUTCDate()).padStart(2, '0'), mes: MESES[d.getUTCMonth()], ano: d.getUTCFullYear() };
}

export default function Peladas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [peladas, setPeladas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setPeladas(await api.get('/peladas'));
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="between">
        <div>
          <h1>Peladas</h1>
          <p>Histórico de todas as peladas.</p>
        </div>
        {user?.isAdmin && <Link to="/peladas/nova" className="btn">+ Nova pelada</Link>}
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {carregando ? (
        <div className="loading">Carregando…</div>
      ) : peladas.length === 0 ? (
        <div className="card"><div className="empty"><div className="big">📅</div>Nenhuma pelada cadastrada ainda.</div></div>
      ) : (
        <div className="pelada-list">
          {peladas.map((p) => {
            const { dia, mes, ano } = parsePartes(p.DataPelada);
            return (
              <div className="pelada-row" key={p.Id} onClick={() => navigate(`/peladas/${p.Id}`)}>
                <div className="date-badge">
                  <div className="d">{dia}</div>
                  <div className="m">{mes} {ano}</div>
                </div>
                <div className="pelada-meta">
                  <div className="t">{p.Local || 'Pelada'}</div>
                  <div className="pelada-tags">
                    <span>🥅 {p.NumTimes} times</span>
                    <span>👥 {p.QtdJogadores} jogadores</span>
                    <span className="gols">⚽ {p.TotalGols} gols</span>
                    {p.Finalizada ? <span>✅ finalizada</span> : <span>⏳ em andamento</span>}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: 20 }}>›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
