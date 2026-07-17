import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { formatarData } from '../utils';

export default function PeladaDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [d, c] = await Promise.all([
          api.get(`/peladas/${id}`),
          api.get(`/peladas/${id}/comentarios`),
        ]);
        setDados(d);
        setComentarios(c);
      } catch (err) {
        setErro(err.message);
      }
    })();
  }, [id]);

  const calc = useMemo(() => {
    if (!dados) return null;
    const { times, participacoes } = dados;
    const golsPorTime = times.map((t) => participacoes.filter((p) => p.TimeId === t.Id).reduce((s, p) => s + p.Gols, 0));
    const maxVit = Math.max(-1, ...times.map((t) => t.Vitorias));
    const vencedores = times.filter((t) => t.Vitorias === maxVit && maxVit > 0).map((t) => t.Id);
    let mvp = null;
    for (const p of participacoes) {
      const score = p.Gols + p.Assistencias;
      if (score > 0 && (!mvp || score > mvp.score)) mvp = { ...p, score };
    }
    return { golsPorTime, vencedores, mvp };
  }, [dados]);

  async function excluir() {
    if (!window.confirm('Excluir esta pelada? Esta ação não pode ser desfeita.')) return;
    try {
      await api.del(`/peladas/${id}`);
      navigate('/peladas');
    } catch (err) {
      setErro(err.message);
    }
  }

  async function enviarComentario(e) {
    e.preventDefault();
    const texto = novoComentario.trim();
    if (!texto) return;
    try {
      const novo = await api.post(`/peladas/${id}/comentarios`, { texto });
      setComentarios((prev) => [...prev, novo]);
      setNovoComentario('');
    } catch (err) {
      setErro(err.message);
    }
  }

  if (erro) return <div className="alert alert-error">{erro}</div>;
  if (!dados || !calc) return <div className="loading">Carregando…</div>;

  const { pelada, times, participacoes } = dados;
  const doisTimes = times.length === 2;

  return (
    <div>
      <div className="between page-head">
        <div className="mini">
          <Link to="/peladas" className="muted">← Peladas</Link> · {formatarData(pelada.DataPelada)}
          {pelada.Local ? ` · ${pelada.Local}` : ''}
        </div>
        {user?.isAdmin && (
          <div className="row">
            <Link to={`/peladas/${id}/editar`} className="btn btn-ghost btn-sm">Editar</Link>
            <button className="btn btn-danger btn-sm" onClick={excluir}>Excluir</button>
          </div>
        )}
      </div>

      {/* Placar (apenas quando 2 times) */}
      {doisTimes && (
        <div className="scoreline">
          <div className="tname a">{times[0].Nome}</div>
          <div className={`sc ${calc.golsPorTime[0] >= calc.golsPorTime[1] ? 'win' : 'lose'}`}>{calc.golsPorTime[0]}</div>
          <div className="dash">–</div>
          <div className={`sc ${calc.golsPorTime[1] > calc.golsPorTime[0] ? 'win' : 'lose'}`}>{calc.golsPorTime[1]}</div>
          <div className="tname b">{times[1].Nome}</div>
        </div>
      )}

      {/* MVP */}
      {calc.mvp && (
        <div className="mvp-pill">
          <span style={{ fontSize: 18 }}>🏅</span>
          <span className="who">MVP: {calc.mvp.JogadorNome}</span>
          <span className="stat">{calc.mvp.Gols} gols · {calc.mvp.Assistencias} assist.</span>
        </div>
      )}

      {pelada.Observacao && <div className="card" style={{ marginBottom: 22 }}><p style={{ margin: 0 }}>{pelada.Observacao}</p></div>}

      {/* Times */}
      <div className="team-grid">
        {times.map((t) => {
          const jogadores = participacoes.filter((p) => p.TimeId === t.Id);
          const venceu = calc.vencedores.includes(t.Id);
          return (
            <div className={`team-card ${venceu ? 'win' : ''}`} key={t.Id}>
              <div className="tt">{t.Nome}</div>
              <div className="rec">🏆 {t.Vitorias}V · {t.Empates}E · {t.Derrotas}D</div>
              {jogadores.length === 0 && <div className="mini">Sem jogadores</div>}
              {jogadores.map((p) => (
                <div className="team-line" key={p.Id}>
                  <span className="n">{p.JogadorNome}</span>
                  <span>
                    {p.Gols > 0 && <span className="g">⚽ {p.Gols}</span>}
                    {p.Gols > 0 && p.Assistencias > 0 && ' '}
                    {p.Assistencias > 0 && <span className="a">🅰️ {p.Assistencias}</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Comentários */}
      <div className="card comments">
        <div className="ct">💬 Comentários</div>
        {comentarios.length === 0 && <div className="mini" style={{ marginBottom: 14 }}>Seja o primeiro a comentar.</div>}
        {comentarios.map((c) => (
          <div className="comment" key={c.Id}>
            <span className="ca">{c.AutorNome?.split(' ')[0]}:</span>
            <span className="cx">{c.Texto}</span>
          </div>
        ))}
        <form className="comment-form" onSubmit={enviarComentario}>
          <input className="inp" value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Adicionar um comentário…" maxLength={500} />
          <button className="txt-action" type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
}
