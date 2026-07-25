import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome } from '../utils';

function statusAposta(minhaAposta) {
  if (!minhaAposta) return null;
  if (minhaAposta.status === 'ganhou') return `· ganhou +${minhaAposta.premio} 🎉`;
  if (minhaAposta.status === 'perdeu') return '· perdeu';
  return '· aguardando resultado';
}

export default function ApostasPelada() {
  const { id } = useParams();
  const { user, atualizarSaldo } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [valores, setValores] = useState({});
  const [oddsEdit, setOddsEdit] = useState({});
  const [enviando, setEnviando] = useState(null);

  async function carregar() {
    try {
      setDados(await api.get(`/apostas/mercados/pelada/${id}`));
    } catch (err) {
      setErro(err.message);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  async function apostar(mercadoId) {
    const valor = parseInt(valores[mercadoId], 10);
    if (!valor || valor <= 0) return;
    setErro('');
    setEnviando(mercadoId);
    try {
      const r = await api.post(`/apostas/mercados/${mercadoId}/apostar`, { valor });
      atualizarSaldo(r.saldoFichas);
      setValores((prev) => ({ ...prev, [mercadoId]: '' }));
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(null);
    }
  }

  async function salvarOdd(mercadoId) {
    const odd = Number(oddsEdit[mercadoId]);
    if (!odd || odd <= 1) return;
    setErro('');
    try {
      await api.put(`/apostas/mercados/${mercadoId}`, { odd });
      setOddsEdit((prev) => ({ ...prev, [mercadoId]: '' }));
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function resolver(mercadoId, resultado) {
    if (!window.confirm(resultado ? 'Marcar esse mercado como "aconteceu"?' : 'Marcar esse mercado como "não rolou"?')) return;
    setErro('');
    try {
      await api.post(`/apostas/mercados/${mercadoId}/resolver`, { resultado });
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  if (erro && !dados) return <div className="alert alert-error">{erro}</div>;
  if (!dados) return <div className="loading">Carregando…</div>;

  return (
    <div>
      <Link to={`/peladas/${id}`} className="txt-muted" style={{ display: 'inline-block', marginBottom: 14 }}>← Voltar pra pelada</Link>
      <h1 className="page-title">Apostas</h1>

      {erro && <div className="alert alert-error">{erro}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="between" style={{ marginBottom: 0 }}>
          <span>Seu saldo: <strong>💰 {user?.saldoFichas ?? 0}</strong></span>
          {!dados.apostasAbertas && <span className="mini">Apostas encerradas pra essa pelada.</span>}
        </div>
      </div>

      {dados.jogadores.length === 0 && (
        <div className="empty"><div className="big">🎲</div>Nenhum mercado de aposta pra essa pelada ainda.</div>
      )}

      {dados.jogadores.map((j) => (
        <div className="card" key={j.jogadorId} style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 10, marginBottom: 6 }}>
            <span className="avatar sm" style={{ background: corDoNome(j.nome) }}>
              {j.foto ? <img src={j.foto} alt="" /> : iniciais(j.nome)}
            </span>
            <span className="nm" style={{ fontWeight: 700 }}>{j.nome}</span>
          </div>

          {j.mercados.map((m) => (
            <div className="votar-linha" key={m.mercadoId}>
              <span className="votar-quem">
                <span className="nm">{m.categoria}</span>
                {m.resolvido && (
                  <span className="mini">{m.resultado ? '✅ aconteceu' : '❌ não rolou'}</span>
                )}
              </span>

              <span className="votar-nota-grupo">
                {user?.isBetAdmin && !m.resolvido ? (
                  <>
                    <input
                      className="inp inp-sm"
                      type="number" step="0.1" min="1.1"
                      placeholder={m.odd.toFixed(2)}
                      value={oddsEdit[m.mercadoId] ?? ''}
                      onChange={(e) => setOddsEdit((prev) => ({ ...prev, [m.mercadoId]: e.target.value }))}
                    />
                    <button className="txt-action" onClick={() => salvarOdd(m.mercadoId)}>salvar</button>
                  </>
                ) : (
                  <span className="valor-nota">{m.odd.toFixed(2)}x</span>
                )}

                {m.minhaAposta ? (
                  <span className="mini">{m.minhaAposta.valor} fichas {statusAposta(m.minhaAposta)}</span>
                ) : dados.apostasAbertas && !m.resolvido ? (
                  <>
                    <input
                      className="inp inp-sm"
                      type="number" min="1"
                      placeholder="fichas"
                      value={valores[m.mercadoId] ?? ''}
                      onChange={(e) => setValores((prev) => ({ ...prev, [m.mercadoId]: e.target.value }))}
                    />
                    <button
                      className="btn btn-lime btn-sm"
                      disabled={enviando === m.mercadoId}
                      onClick={() => apostar(m.mercadoId)}
                    >
                      {enviando === m.mercadoId ? '…' : 'Apostar'}
                    </button>
                  </>
                ) : (
                  <span className="mini">—</span>
                )}

                {user?.isBetAdmin && !m.autoResolve && !m.resolvido && (
                  <>
                    <button className="txt-action" onClick={() => resolver(m.mercadoId, true)}>Marcou ✅</button>
                    <button className="txt-action" style={{ color: '#d33' }} onClick={() => resolver(m.mercadoId, false)}>Não rolou ❌</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
