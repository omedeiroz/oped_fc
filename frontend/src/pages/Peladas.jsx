import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dia(iso) { return String(new Date(iso).getUTCDate()).padStart(2, '0'); }
function mesCurto(iso) { return MESES[new Date(iso).getUTCMonth()]; }
function dataLonga(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_LONG[d.getUTCMonth()]}`;
}

export default function Peladas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [peladas, setPeladas] = useState([]);
  const [proxima, setProxima] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, prox, pend] = await Promise.all([
          api.get('/peladas'), api.get('/peladas/proxima'), api.get('/peladas/pendentes-votacao'),
        ]);
        setPeladas(p); setProxima(prox); setPendentes(pend);
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
      <div className="between page-title">
        <h1>Peladas</h1>
        {user?.isAdmin && <Link to="/peladas/nova" className="btn btn-outline">+ Nova pelada</Link>}
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {proxima && (
        <div className="next-banner">
          <span className="bell">🔔</span>
          <div className="info">
            <div className="t">Próxima: {dataLonga(proxima.DataPelada)}</div>
            <div className="s">{proxima.Local || 'Local a definir'} · {proxima.confirmados} confirmados</div>
          </div>
          <button className={proxima.confirmadoPorMim ? 'btn btn-outline btn-sm' : 'btn btn-lime btn-sm'} onClick={toggleConfirmar}>
            {proxima.confirmadoPorMim ? '✓ Confirmado' : 'Confirmar presença'}
          </button>
        </div>
      )}

      {pendentes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {pendentes.map((p) => (
            <div className="pendente-card" key={p.Id} onClick={() => navigate(`/peladas/${p.Id}/votar`)}>
              <span style={{ fontSize: 22 }}>⭐</span>
              <div className="info">
                <div className="t">Avalie a pelada de {dataLonga(p.DataPelada)}</div>
                <div className="s">{p.Local || 'Pelada'} · faltam {p.faltam} avaliações suas</div>
              </div>
              <span className="btn btn-lime btn-sm">Avaliar →</span>
            </div>
          ))}
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
              <div className="data">{dia(p.DataPelada)}<small> {mesCurto(p.DataPelada)}</small></div>
              <div className="meta">
                <div className="l">{p.Local || 'Pelada'}</div>
                <div className="s">🥅 {p.NumTimes} times · 👥 {p.QtdJogadores} · ⚽ {p.TotalGols}</div>
              </div>
              <div className="status">{p.Finalizada ? 'Fim' : '●'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
