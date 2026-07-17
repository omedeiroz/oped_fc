import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome, formatarData } from '../utils';

const CORES_TIME = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];

function LinhaJogador({ p }) {
  return (
    <div className="jog-line">
      <div className="avatar sm" style={{ background: corDoNome(p.JogadorNome) }}>{iniciais(p.JogadorNome)}</div>
      <span className="nome" style={{ fontWeight: 600 }}>{p.JogadorNome}</span>
      {p.Gols > 0 && <span className="chip stat-chip gols">⚽ {p.Gols}</span>}
      {p.Assistencias > 0 && <span className="chip">🅰️ {p.Assistencias}</span>}
    </div>
  );
}

export default function PeladaDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setDados(await api.get(`/peladas/${id}`));
      } catch (err) {
        setErro(err.message);
      }
    })();
  }, [id]);

  async function excluir() {
    if (!window.confirm('Excluir esta pelada? Esta ação não pode ser desfeita.')) return;
    try {
      await api.del(`/peladas/${id}`);
      navigate('/peladas');
    } catch (err) {
      setErro(err.message);
    }
  }

  if (erro) return <div className="alert alert-error">{erro}</div>;
  if (!dados) return <div className="loading">Carregando…</div>;

  const { pelada, times, participacoes } = dados;
  const semTime = participacoes.filter((p) => !p.TimeId);

  return (
    <div>
      <div className="between">
        <div>
          <Link to="/peladas" className="muted" style={{ fontSize: 14 }}>← Peladas</Link>
          <h1 style={{ marginTop: 8 }}>{pelada.Local || 'Pelada'}</h1>
          <p>
            {formatarData(pelada.DataPelada)} · {pelada.NumTimes} times ·{' '}
            {pelada.Finalizada ? '✅ finalizada' : '⏳ em andamento'}
          </p>
        </div>
        {user?.isAdmin && (
          <div className="row">
            <Link to={`/peladas/${id}/editar`} className="btn btn-ghost">Editar</Link>
            <button className="btn btn-danger" onClick={excluir}>Excluir</button>
          </div>
        )}
      </div>

      {pelada.Observacao && (
        <div className="card" style={{ marginBottom: 18 }}><p style={{ margin: 0 }}>{pelada.Observacao}</p></div>
      )}

      <div className="times-grid">
        {times.map((t, idx) => {
          const jogadores = participacoes.filter((p) => p.TimeId === t.Id);
          const cor = CORES_TIME[idx % CORES_TIME.length];
          return (
            <div className="time-col" key={t.Id} style={{ '--tcor': cor }}>
              <h4><span className="avatar sm" style={{ background: cor, width: 22, height: 22, fontSize: 11 }}>{idx + 1}</span> {t.Nome}</h4>
              <div className="time-record">🏆 {t.Vitorias}V · {t.Empates}E · {t.Derrotas}D</div>
              {jogadores.length === 0 && <div className="mini">Sem jogadores</div>}
              {jogadores.map((p) => <LinhaJogador key={p.Id} p={p} />)}
            </div>
          );
        })}
      </div>

      {semTime.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="mini" style={{ marginBottom: 8 }}>Sem time definido</div>
          {semTime.map((p) => <LinhaJogador key={p.Id} p={p} />)}
        </div>
      )}
    </div>
  );
}
