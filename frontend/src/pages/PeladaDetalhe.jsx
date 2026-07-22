import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { formatarData } from '../utils';
import { EstrelasView } from '../components/Estrelas.jsx';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function cabecalhoData(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getUTCDay()]} · ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function PeladaDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [votacao, setVotacao] = useState(null);
  const [erro, setErro] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  async function carregar() {
    try {
      const [d, c] = await Promise.all([api.get(`/peladas/${id}`), api.get(`/peladas/${id}/comentarios`)]);
      setDados(d); setComentarios(c);
      if (d.pelada.Finalizada) {
        setVotacao(await api.get(`/peladas/${id}/votacao`));
      } else {
        setVotacao(null);
      }
    } catch (err) {
      setErro(err.message);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  async function finalizar() {
    if (!window.confirm('Finalizar esta pelada? Isso abre a votação de MVP/LVP para os participantes.')) return;
    setFinalizando(true);
    try {
      await api.post(`/peladas/${id}/finalizar`);
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setFinalizando(false);
    }
  }

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
    try { await api.del(`/peladas/${id}`); navigate('/peladas'); } catch (err) { setErro(err.message); }
  }

  async function enviarComentario(e) {
    e.preventDefault();
    const texto = novoComentario.trim();
    if (!texto) return;
    try {
      const novo = await api.post(`/peladas/${id}/comentarios`, { texto });
      setComentarios((prev) => [...prev, novo]);
      setNovoComentario('');
    } catch (err) { setErro(err.message); }
  }

  if (erro) return <div className="alert alert-error">{erro}</div>;
  if (!dados || !calc) return <div className="loading">Carregando…</div>;

  const { pelada, times, participacoes } = dados;
  const doisTimes = times.length === 2;

  return (
    <div>
      <div className="diag-header lime">
        <div className="diag-sub">{cabecalhoData(pelada.DataPelada)}</div>
        <div className="diag-title">{pelada.Local || 'Pelada'}</div>
      </div>

      <div className="between" style={{ marginTop: 16 }}>
        <Link to="/peladas" className="txt-muted">← Peladas</Link>
        {user?.isAdmin && (
          <div className="row">
            {!pelada.Finalizada && (
              <button className="btn btn-lime btn-sm" onClick={finalizar} disabled={finalizando}>
                {finalizando ? 'Finalizando…' : 'Finalizar pelada →'}
              </button>
            )}
            <Link to={`/peladas/${id}/editar`} className="btn btn-outline btn-sm">Editar</Link>
            <button className="btn btn-danger btn-sm" onClick={excluir}>Excluir</button>
          </div>
        )}
      </div>

      {doisTimes && (
        <div className="placar">
          <span className="tn a">{times[0].Nome}</span>
          <span className="sc">{calc.golsPorTime[0]} – {calc.golsPorTime[1]}</span>
          <span className="tn b">{times[1].Nome}</span>
        </div>
      )}

      {calc.mvp && (
        <div className="mvp-pill">🏅 MVP: {calc.mvp.JogadorNome} · {calc.mvp.Gols}G {calc.mvp.Assistencias}A</div>
      )}

      {votacao && votacao.completo && (votacao.mvp || votacao.lvp) && (
        <div className="mvplvp-grid">
          {votacao.mvp && (
            <div className="mvplvp-card mvp">
              <div>
                <div className="rotulo">⭐ MVP da galera</div>
                <div className="nome">{votacao.mvp.nome}</div>
                <EstrelasView valor={votacao.mvp.media} tamanho={16} />
              </div>
            </div>
          )}
          {votacao.lvp && votacao.lvp.jogadorId !== votacao.mvp?.jogadorId && (
            <div className="mvplvp-card lvp">
              <div>
                <div className="rotulo">👎 LVP da galera</div>
                <div className="nome">{votacao.lvp.nome}</div>
                <EstrelasView valor={votacao.lvp.media} tamanho={16} />
              </div>
            </div>
          )}
        </div>
      )}

      {votacao && !votacao.completo && (
        <div className="next-banner">
          <span className="bell">⭐</span>
          <div className="info">
            <div className="t">Votação de MVP/LVP em andamento</div>
            <div className="s">{votacao.recebidos} de {votacao.esperado} votos recebidos</div>
          </div>
          {votacao.podeVotar && (
            <Link to={`/peladas/${id}/votar`} className="btn btn-lime btn-sm">Avaliar jogadores →</Link>
          )}
        </div>
      )}

      {pelada.Observacao && <div className="card" style={{ marginBottom: 20 }}><p style={{ margin: 0 }}>{pelada.Observacao}</p></div>}

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
                  <Link
                    to={user?.jogadorId === p.JogadorId ? '/perfil' : `/jogador/${p.JogadorId}`}
                    className="n"
                    style={{ textDecoration: 'underline', textDecorationColor: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = 'currentcolor'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
                  >
                    {p.JogadorNome}
                  </Link>
                  <span>
                    {p.Gols > 0 && <span className="g">⚽ {p.Gols} </span>}
                    {p.Assistencias > 0 && <span className="a">🅰️ {p.Assistencias}</span>}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card comments">
        <div className="ct">Comentários</div>
        {comentarios.length === 0 && <div className="mini" style={{ marginBottom: 12 }}>Seja o primeiro a comentar.</div>}
        {comentarios.map((c) => (
          <div className="comment" key={c.Id}><b>{c.AutorNome?.split(' ')[0]}:</b> {c.Texto}</div>
        ))}
        <form className="comment-form" onSubmit={enviarComentario}>
          <input className="inp" value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Escrever comentário…" maxLength={500} />
          <button className="txt-action" type="submit">Enviar</button>
        </form>
      </div>
    </div>
  );
}
