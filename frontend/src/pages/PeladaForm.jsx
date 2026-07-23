import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import Stepper from '../components/Stepper.jsx';

const ETAPAS = ['Dados básicos', 'Jogadores', 'Times', 'Revisão'];

function timesIniciais(n) {
  return Array.from({ length: n }, (_, i) => ({ nome: `Time ${i + 1}` }));
}

export default function PeladaForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [carregando, setCarregando] = useState(editando);
  const [travada, setTravada] = useState(false); // estatísticas já iniciadas — não dá pra editar times
  const [dataPelada, setDataPelada] = useState(() => new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [numTimes, setNumTimes] = useState(2);
  const [times, setTimes] = useState(timesIniciais(2));

  const [disponiveis, setDisponiveis] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [marcados, setMarcados] = useState([]);
  const [buscaJogador, setBuscaJogador] = useState('');
  const [novoAvulso, setNovoAvulso] = useState('');

  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const jogs = await api.get('/jogadores');
        setDisponiveis(jogs);
        if (editando) {
          const { pelada, times: ts, participacoes } = await api.get(`/peladas/${id}`);
          if (pelada.EstatisticasIniciadas) {
            setTravada(true);
            setCarregando(false);
            return;
          }
          setDataPelada(String(pelada.DataPelada).slice(0, 10));
          setLocal(pelada.Local || '');
          setObservacao(pelada.Observacao || '');
          setNumTimes(ts.length);
          setTimes(ts.map((t) => ({ nome: t.Nome })));
          const idxPorTime = {};
          ts.forEach((t, i) => { idxPorTime[t.Id] = i; });
          setSelecionados(participacoes.map((p) => ({
            jogadorId: p.JogadorId, nome: p.JogadorNome,
            timeIndex: p.TimeId != null ? idxPorTime[p.TimeId] : null,
          })));
        }
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    })();
  }, [id, editando]);

  function mudarNumTimes(n) {
    n = Math.max(2, Math.min(6, n));
    setNumTimes(n);
    setTimes((prev) => {
      const novo = timesIniciais(n);
      for (let i = 0; i < n && i < prev.length; i++) novo[i] = prev[i];
      return novo;
    });
    setSelecionados((prev) => prev.map((s) => (s.timeIndex != null && s.timeIndex >= n ? { ...s, timeIndex: null } : s)));
  }

  function toggleMarcado(jogadorId) {
    setMarcados((prev) => (prev.includes(jogadorId) ? prev.filter((x) => x !== jogadorId) : [...prev, jogadorId]));
  }

  function adicionarMarcados() {
    const novos = marcados
      .map((jid) => disponiveis.find((d) => d.Id === jid))
      .filter((j) => j && !selecionados.some((s) => s.jogadorId === j.Id))
      .map((j) => ({ jogadorId: j.Id, nome: j.Nome, timeIndex: null }));
    setSelecionados((prev) => [...prev, ...novos]);
    setMarcados([]);
    setBuscaJogador('');
  }

  async function adicionarAvulso(e) {
    e.preventDefault();
    const nome = novoAvulso.trim();
    if (!nome) return;
    try {
      const novo = await api.post('/jogadores', { nome });
      setDisponiveis((prev) => [...prev, novo].sort((a, b) => a.Nome.localeCompare(b.Nome)));
      setSelecionados((prev) => [...prev, { jogadorId: novo.Id, nome: novo.Nome, timeIndex: null }]);
      setNovoAvulso('');
    } catch (err) {
      setErro(err.message);
    }
  }

  function removerJogador(jogadorId) {
    setSelecionados((prev) => prev.filter((s) => s.jogadorId !== jogadorId));
    setMarcados((prev) => prev.filter((x) => x !== jogadorId));
  }
  function alterarSelecionado(jogadorId, campo, valor) {
    setSelecionados((prev) => prev.map((s) => (s.jogadorId === jogadorId ? { ...s, [campo]: valor } : s)));
  }
  function alterarTime(idx, campo, valor) {
    setTimes((prev) => prev.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t)));
  }

  function sortearTimes() {
    if (selecionados.length === 0) return;
    const emb = [...selecionados];
    for (let i = emb.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emb[i], emb[j]] = [emb[j], emb[i]];
    }
    const mapa = {};
    emb.forEach((s, i) => { mapa[s.jogadorId] = i % numTimes; });
    setSelecionados((prev) => prev.map((s) => ({ ...s, timeIndex: mapa[s.jogadorId] })));
  }

  function proximo() {
    setErro('');
    if (step === 0 && !dataPelada) return setErro('Informe a data da pelada.');
    if (step === 1 && selecionados.length < 2) return setErro('Selecione ao menos 2 jogadores.');
    setStep((s) => Math.min(3, s + 1));
  }
  function voltar() { setErro(''); setStep((s) => Math.max(0, s - 1)); }

  async function salvar() {
    setErro('');
    if (selecionados.length < 2) { setStep(1); return setErro('Selecione ao menos 2 jogadores.'); }
    setSalvando(true);
    const payload = {
      dataPelada, local, observacao,
      times: times.map((t) => ({ nome: t.nome })),
      participacoes: selecionados.map((s) => ({ jogadorId: s.jogadorId, timeIndex: s.timeIndex })),
    };
    try {
      if (editando) { await api.put(`/peladas/${id}`, payload); navigate(`/peladas/${id}`); }
      else { const r = await api.post('/peladas', payload); navigate(`/peladas/${r.id}`); }
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  }

  const naoSelecionados = disponiveis
    .filter((d) => !selecionados.some((s) => s.jogadorId === d.Id))
    .filter((d) => d.Nome.toLowerCase().includes(buscaJogador.trim().toLowerCase()));

  if (carregando) return <div className="loading">Carregando…</div>;

  if (travada) {
    return (
      <div>
        <h1 className="page-title">Editar pelada</h1>
        <div className="empty">
          <div className="big">🔒</div>
          As estatísticas dessa pelada já começaram a ser preenchidas, então não dá mais pra reorganizar os times.
          <div style={{ marginTop: 16 }}>
            <Link to={`/peladas/${id}`} className="btn btn-outline btn-sm">← Voltar pra pelada</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="between">
        <h1>{editando ? 'Editar pelada' : 'Nova pelada'}</h1>
        <button className="txt-muted" onClick={() => navigate(-1)}>Cancelar</button>
      </div>
      <div className="step-label" style={{ marginTop: 8 }}>Etapa {step + 1} de 4 — {ETAPAS[step]}</div>
      <div className="progress">
        {ETAPAS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {/* ETAPA 1 — Dados básicos */}
      {step === 0 && (
        <div style={{ maxWidth: 520 }}>
          <div className="field">
            <label>Data *</label>
            <input className="inp" type="date" value={dataPelada} onChange={(e) => setDataPelada(e.target.value)} />
          </div>
          <div className="field">
            <label>Local</label>
            <input className="inp" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Society do trabalho" />
          </div>
          <div className="field">
            <label>Número de times</label>
            <Stepper value={numTimes} onChange={mudarNumTimes} min={2} max={6} />
          </div>
          <div className="field">
            <label>Observação</label>
            <input className="inp" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
      )}

      {/* ETAPA 2 — Jogadores */}
      {step === 1 && (
        <div className="wizard-cols">
          <div>
            <div className="eyebrow">Adicionar dos cadastrados</div>
            <input className="inp" placeholder="🔍 Buscar jogador…" value={buscaJogador} onChange={(e) => setBuscaJogador(e.target.value)} style={{ marginBottom: 10 }} />
            <div className="checklist">
              {naoSelecionados.map((d) => (
                <label className="checklist-item" key={d.Id}>
                  <input type="checkbox" checked={marcados.includes(d.Id)} onChange={() => toggleMarcado(d.Id)} />
                  <span>{d.Nome}{d.TemLogin ? '' : ' (avulso)'}</span>
                </label>
              ))}
              {naoSelecionados.length === 0 && <div className="mini" style={{ padding: 8 }}>Ninguém encontrado.</div>}
            </div>
            {marcados.length > 0 && (
              <button type="button" className="btn btn-sm" style={{ marginBottom: 20 }} onClick={adicionarMarcados}>
                + Adicionar {marcados.length} selecionado{marcados.length > 1 ? 's' : ''}
              </button>
            )}

            <div className="eyebrow" style={{ marginTop: 20 }}>Adicionar avulso (sem login)</div>
            <div className="row" style={{ marginBottom: 20 }}>
              <input className="inp" placeholder="Nome do avulso…" value={novoAvulso} onChange={(e) => setNovoAvulso(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarAvulso(e); }} style={{ flex: 1 }} />
              <button type="button" className="txt-action" onClick={adicionarAvulso}>+ Adicionar</button>
            </div>

            <div className="eyebrow">Selecionados ({selecionados.length})</div>
            <div className="chips">
              {selecionados.map((s) => (
                <span className="chip" key={s.jogadorId}>{s.nome}<span className="x" onClick={() => removerJogador(s.jogadorId)}>×</span></span>
              ))}
              {selecionados.length === 0 && <div className="mini">Ninguém selecionado ainda.</div>}
            </div>
            {selecionados.length >= 2 && (
              <button type="button" className="btn btn-lime btn-sm" style={{ marginTop: 16 }} onClick={sortearTimes}>🎲 Sortear times</button>
            )}
          </div>
          <div>
            <div className="eyebrow">Prévia dos times</div>
            <div className="preview-teams">
              {times.map((t, i) => (
                <div className="preview-team" key={i}>
                  <div className="pt">{t.nome}</div>
                  {selecionados.filter((s) => s.timeIndex === i).map((s) => <div className="pl" key={s.jogadorId}>{s.nome}</div>)}
                  {selecionados.filter((s) => s.timeIndex === i).length === 0 && <div className="pl">—</div>}
                </div>
              ))}
            </div>
            {selecionados.some((s) => s.timeIndex == null) && (
              <div className="mini" style={{ marginTop: 12 }}>{selecionados.filter((s) => s.timeIndex == null).length} jogador(es) ainda sem time — sorteie ou defina na próxima etapa.</div>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 3 — Times */}
      {step === 2 && (
        <div>
          <div className="team-grid">
            {times.map((t, idx) => {
              const jogadores = selecionados.filter((s) => s.timeIndex === idx);
              return (
                <div className="team-edit" key={idx}>
                  <input className="inp" value={t.nome} onChange={(e) => alterarTime(idx, 'nome', e.target.value)} style={{ fontWeight: 700, marginBottom: 12 }} />
                  {jogadores.length === 0 && <div className="mini">Nenhum jogador neste time</div>}
                  {jogadores.map((s) => (
                    <div className="team-line" key={s.jogadorId}><span className="n">{s.nome}</span></div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-lime btn-sm" onClick={sortearTimes}>🎲 Sortear de novo</button>
          </div>
          {selecionados.some((s) => s.timeIndex == null) && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="eyebrow">Sem time — defina manualmente</div>
              {selecionados.filter((s) => s.timeIndex == null).map((s) => (
                <div className="team-line" key={s.jogadorId}>
                  <span className="n">{s.nome}</span>
                  <select className="inp" style={{ width: 150 }} value="" onChange={(e) => alterarSelecionado(s.jogadorId, 'timeIndex', parseInt(e.target.value, 10))}>
                    <option value="">Escolher time…</option>
                    {times.map((t, i) => <option key={i} value={i}>{t.nome}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ETAPA 4 — Revisão */}
      {step === 3 && (
        <div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="eyebrow">Resumo</div>
            <div style={{ fontSize: 15 }}>
              <strong>{new Date(dataPelada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</strong>
              {local ? ` · ${local}` : ''} · {numTimes} times · {selecionados.length} jogadores
            </div>
            <p style={{ marginTop: 8, marginBottom: 0 }}>As estatísticas (gols, assistências, vitórias) são preenchidas depois, na tela da pelada.</p>
          </div>
          <div className="team-grid">
            {times.map((t, idx) => {
              const jogadores = selecionados.filter((s) => s.timeIndex === idx);
              return (
                <div className="team-card" key={idx}>
                  <div className="tt">{t.nome}</div>
                  {jogadores.map((s) => (
                    <div className="team-line" key={s.jogadorId}><span className="n">{s.nome}</span></div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navegação */}
      <div className="wizard-nav">
        {step > 0 ? <button type="button" className="btn btn-outline btn-sm" onClick={voltar}>← Voltar</button> : <span />}
        {step < 3 ? (
          <button type="button" className="btn" onClick={proximo}>Próximo → {ETAPAS[step + 1]}</button>
        ) : (
          <button type="button" className="btn" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar pelada'}
          </button>
        )}
      </div>
    </div>
  );
}
