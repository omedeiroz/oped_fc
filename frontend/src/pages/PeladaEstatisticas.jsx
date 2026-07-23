import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import Stepper from '../components/Stepper.jsx';

export default function PeladaEstatisticas() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState(null);
  const [times, setTimes] = useState([]);
  const [participacoes, setParticipacoes] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get(`/peladas/${id}`);
        setPelada(d.pelada);
        setTimes(d.times.map((t) => ({ id: t.Id, nome: t.Nome, vitorias: t.Vitorias, empates: t.Empates, derrotas: t.Derrotas })));
        setParticipacoes(d.participacoes.map((p) => ({ id: p.Id, jogadorId: p.JogadorId, nome: p.JogadorNome, timeId: p.TimeId, gols: p.Gols, assistencias: p.Assistencias })));
      } catch (err) {
        setErro(err.message);
      }
    })();
  }, [id]);

  function alterarTime(timeId, campo, valor) {
    setTimes((prev) => prev.map((t) => (t.id === timeId ? { ...t, [campo]: valor } : t)));
  }
  function alterarParticipacao(partId, campo, valor) {
    setParticipacoes((prev) => prev.map((p) => (p.id === partId ? { ...p, [campo]: valor } : p)));
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      await api.put(`/peladas/${id}/estatisticas`, {
        times: times.map((t) => ({ id: t.id, vitorias: t.vitorias, empates: t.empates, derrotas: t.derrotas })),
        participacoes: participacoes.map((p) => ({ id: p.id, gols: p.gols, assistencias: p.assistencias })),
      });
      navigate(`/peladas/${id}`);
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  }

  if (erro && !pelada) return <div className="alert alert-error">{erro}</div>;
  if (!pelada) return <div className="loading">Carregando…</div>;

  return (
    <div>
      <Link to={`/peladas/${id}`} className="txt-muted" style={{ display: 'inline-block', marginBottom: 14 }}>← Voltar pra pelada</Link>
      <h1 className="page-title">Estatísticas da pelada</h1>
      <p style={{ marginBottom: 20 }}>Gols, assistências e o resultado de cada time. Depois de salvar, dá pra finalizar a pelada e abrir a votação.</p>

      {erro && <div className="alert alert-error">{erro}</div>}

      <div className="team-grid">
        {times.map((t) => {
          const jogadores = participacoes.filter((p) => p.timeId === t.id);
          return (
            <div className="team-edit" key={t.id}>
              <div className="tt" style={{ marginBottom: 12 }}>{t.nome}</div>
              <div className="stats-row" style={{ marginBottom: 14 }}>
                <Stepper label="Vitórias" value={t.vitorias} onChange={(v) => alterarTime(t.id, 'vitorias', v)} max={20} />
                <Stepper label="Empates" value={t.empates} onChange={(v) => alterarTime(t.id, 'empates', v)} max={20} />
                <Stepper label="Derrotas" value={t.derrotas} onChange={(v) => alterarTime(t.id, 'derrotas', v)} max={20} />
              </div>
              {jogadores.length === 0 && <div className="mini">Nenhum jogador neste time</div>}
              {jogadores.map((p) => (
                <div className="player-stats-row" key={p.id}>
                  <span className="n">{p.nome}</span>
                  <div className="row" style={{ gap: 18 }}>
                    <Stepper label="⚽" value={p.gols} onChange={(v) => alterarParticipacao(p.id, 'gols', v)} max={20} />
                    <Stepper label="🅰️" value={p.assistencias} onChange={(v) => alterarParticipacao(p.id, 'assistencias', v)} max={20} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button className="btn" style={{ marginTop: 20 }} disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar estatísticas →'}
      </button>
    </div>
  );
}
