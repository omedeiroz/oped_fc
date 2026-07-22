import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { iniciais, corDoNome } from '../utils';
import EstrelaInput, { EstrelasView } from '../components/Estrelas.jsx';

export default function VotarPelada() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [notas, setNotas] = useState({}); // jogadorId -> nota
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function carregar() {
    try {
      const d = await api.get(`/peladas/${id}/votacao`);
      setDados(d);
      const notasIniciais = {};
      d.participantes.forEach((p) => { if (p.nota != null) notasIniciais[p.jogadorId] = p.nota; });
      setNotas(notasIniciais);
    } catch (err) {
      setErro(err.message);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  function definirNota(jogadorId, nota) {
    setNotas((prev) => ({ ...prev, [jogadorId]: nota }));
  }

  async function enviar() {
    setErro('');
    setEnviando(true);
    try {
      const votos = dados.participantes.map((p) => ({ avaliadoJogadorId: p.jogadorId, nota: notas[p.jogadorId] }));
      await api.post(`/peladas/${id}/votos`, { votos });
      setEnviado(true);
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !dados) return <div className="alert alert-error">{erro}</div>;
  if (!dados) return <div className="loading">Carregando…</div>;

  const todasPreenchidas = dados.participantes.length > 0 && dados.participantes.every((p) => notas[p.jogadorId] != null);

  return (
    <div>
      <Link to={`/peladas/${id}`} className="txt-muted" style={{ display: 'inline-block', marginBottom: 14 }}>← Voltar pra pelada</Link>
      <h1 className="page-title">Avaliar jogadores</h1>

      {erro && <div className="alert alert-error">{erro}</div>}

      {!dados.podeVotar ? (
        <div className="empty"><div className="big">🙈</div>Você não participou dessa pelada.</div>
      ) : dados.completo ? (
        <div className="card">
          <div className="ct" style={{ marginBottom: 16 }}>Votação encerrada — obrigado por avaliar!</div>
          {dados.medias.map((m) => (
            <div className="votar-linha" key={m.jogadorId}>
              <span className="nm">{m.nome}</span>
              <EstrelasView valor={m.media} />
              <span className="valor-nota">{m.media.toFixed(1)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <p style={{ marginBottom: 18 }}>Avalie cada jogador de 0.5 a 5 estrelas. Clique na metade esquerda da estrela para meia nota.</p>
          {dados.participantes.map((p) => (
            <div className="votar-linha" key={p.jogadorId}>
              <span className="avatar sm" style={{ background: corDoNome(p.nome) }}>
                {p.foto ? <img src={p.foto} alt="" /> : iniciais(p.nome)}
              </span>
              <span className="nm">{p.nome}</span>
              <EstrelaInput valor={notas[p.jogadorId] || 0} onChange={(n) => definirNota(p.jogadorId, n)} />
              <span className="valor-nota">{notas[p.jogadorId] ? notas[p.jogadorId].toFixed(1) : '—'}</span>
            </div>
          ))}
          <button className="btn" style={{ marginTop: 20 }} disabled={!todasPreenchidas || enviando} onClick={enviar}>
            {enviando ? 'Enviando…' : enviado ? 'Votos atualizados ✓' : 'Enviar avaliações →'}
          </button>
          {!todasPreenchidas && <div className="mini" style={{ marginTop: 10 }}>Avalie todo mundo antes de enviar.</div>}
        </div>
      )}
    </div>
  );
}
