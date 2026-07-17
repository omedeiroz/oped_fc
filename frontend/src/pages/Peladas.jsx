import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function cartaoData(iso) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()][0].toUpperCase()}${MESES[d.getUTCMonth()].slice(1)}`;
}
function dataLonga(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES_LONG[d.getUTCMonth()]}`;
}

export default function Peladas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [peladas, setPeladas] = useState([]);
  const [proxima, setProxima] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, prox] = await Promise.all([api.get('/peladas'), api.get('/peladas/proxima')]);
        setPeladas(p);
        setProxima(prox);
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function toggleConfirmar() {
    if (!proxima) return;
    try {
      if (proxima.confirmadoPorMim) {
        await api.del(`/peladas/${proxima.Id}/confirmar`);
        setProxima({ ...proxima, confirmadoPorMim: false, confirmados: proxima.confirmados - 1 });
      } else {
        await api.post(`/peladas/${proxima.Id}/confirmar`);
        setProxima({ ...proxima, confirmadoPorMim: true, confirmados: proxima.confirmados + 1 });
      }
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div>
      <div className="between page-head">
        <div>
          <h1>Peladas</h1>
          <p>Histórico completo do time</p>
        </div>
        {user?.isAdmin && <Link to="/peladas/nova" className="btn">+ Nova pelada</Link>}
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {proxima && (
        <div className="next-banner">
          <span className="bell">🔔</span>
          <div className="info">
            <div className="t">Próxima pelada · {dataLonga(proxima.DataPelada)}</div>
            <div className="s">{proxima.Local || 'Local a definir'} · {proxima.confirmados} confirmados</div>
          </div>
          <button className={proxima.confirmadoPorMim ? 'btn btn-ghost' : 'btn'} onClick={toggleConfirmar}>
            {proxima.confirmadoPorMim ? '✓ Presença confirmada' : 'Confirmar presença'}
          </button>
        </div>
      )}

      {carregando ? (
        <div className="loading">Carregando…</div>
      ) : peladas.length === 0 ? (
        <div className="empty"><div className="big">📅</div>Nenhuma pelada cadastrada ainda.</div>
      ) : (
        <div className="pelada-grid">
          {peladas.map((p) => (
            <div className="pelada-card" key={p.Id} onClick={() => navigate(`/peladas/${p.Id}`)}>
              <div className="status">{p.Finalizada ? 'Finalizada' : 'Em andamento'}</div>
              <div className="data">{cartaoData(p.DataPelada)}</div>
              <div className="meta">🥅 {p.NumTimes} times · 👥 {p.QtdJogadores} jogadores</div>
              <div className="gols">⚽ {p.TotalGols} gols</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
