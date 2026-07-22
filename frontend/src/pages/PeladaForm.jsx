import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const ETAPAS = ['Dados básicos', 'Jogadores', 'Sorteio / Times', 'Revisão'];

function timesIniciais(n) {
  return Array.from({ length: n }, (_, i) => ({ nome: `Time ${i + 1}`, vitorias: 0, empates: 0, derrotas: 0 }));
}

export default function PeladaForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [dataPelada, setDataPelada] = useState(() => new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [finalizada, setFinalizada] = useState(false);
  const [numTimes, setNumTimes] = useState(2);
  const [times, setTimes] = useState(timesIniciais(2));

  const [disponiveis, setDisponiveis] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [selectValue, setSelectValue] = useState('');
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
          setDataPelada(String(pelada.DataPelada).slice(0, 10));
          setLocal(pelada.Local || '');
          setObservacao(pelada.Observacao || '');
          setFinalizada(!!pelada.Finalizada);
          setNumTimes(ts.length);
          setTimes(ts.map((t) => ({ nome: t.Nome, vitorias: t.Vitorias, empates: t.Empates, derrotas: t.Derrotas })));
          const idxPorTime = {};
          ts.forEach((t, i) => { idxPorTime[t.Id] = i; });
          setSelecionados(participacoes.map((p) => ({
            jogadorId: p.JogadorId, nome: p.JogadorNome,
            timeIndex: p.TimeId != null ? idxPorTime[p.TimeId] : null,
            gols: p.Gols, assistencias: p.Assistencias,
          })));
        }
      } catch (err) {
        setErro(err.message);
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

  function addJogador(jogadorId) {
    jogadorId = parseInt(jogadorId, 10);
    if (!jogadorId || selecionados.some((s) => s.jogadorId === jogadorId)) return;
    const j = disponiveis.find((d) => d.Id === jogadorId);
    if (!j) return;
    setSelecionados((prev) => [...prev, { jogadorId, nome: j.Nome, timeIndex: null, gols: 0, assistencias: 0 }]);
    setSelectValue('');
  }

  async function adicionarAvulso(e) {
    e.preventDefault();
    const nome = novoAvulso.trim();
    if (!nome) return;
    try {
      const novo = await api.post('/jogadores', { nome });
      setDisponiveis((prev) => [...prev, novo].sort((a, b) => a.Nome.localeCompare(b.Nome)));
      setSelecionados((prev) => [...prev, { jogadorId: novo.Id, nome: novo.Nome, timeIndex: null, gols: 0, assistencias: 0 }]);
      setNovoAvulso('');
    } catch (err) {
      setErro(err.message);
    }
  }

  function removerJogador(jogadorId) {
    setSelecionados((prev) => prev.filter((s) => s.jogadorId !== jogadorId));
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
      dataPelada, local, observacao, finalizada,
      times: times.map((t) => ({
        nome: t.nome, vitorias: parseInt(t.vitorias, 10) || 0,
        empates: parseInt(t.empates, 10) || 0, derrotas: parseInt(t.derrotas, 10) || 0,
      })),
      participacoes: selecionados.map((s) => ({
        jogadorId: s.jogadorId, timeIndex: s.timeIndex,
        gols: parseInt(s.gols, 10) || 0, assistencias: parseInt(s.assistencias, 10) || 0,
      })),
    };
    try {
      if (editando) { await api.put(`/peladas/${id}`, payload); navigate(`/peladas/${id}`); }
      else { const r = await api.post('/peladas', payload); navigate(`/peladas/${r.id}`); }
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  }

  const naoSelecionados = disponiveis.filter((d) => !selecionados.some((s) => s.jogadorId === d.Id));

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
            <input className="inp" type="number" min="2" max="6" value={numTimes} onChange={(e) => mudarNumTimes(parseInt(e.target.value, 10) || 2)} style={{ maxWidth: 120 }} />
          </div>
          <div className="field">
            <label>Observação</label>
            <input className="inp" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
          <label className="check-row">
            <input type="checkbox" checked={finalizada} onChange={(e) => setFinalizada(e.target.checked)} />
            Pelada finalizada (resultados fechados)
          </label>
        </div>
      )}

      {/* ETAPA 2 — Jogadores */}
      {step === 1 && (
        <div className="wizard-cols">
          <div>
            <div className="eyebrow">Adicionar jogadores ({selecionados.length})</div>
            <select className="inp" value={selectValue} onChange={(e) => addJogador(e.target.value)} style={{ marginBottom: 16 }}>
              <option value="">+ Adicionar dos cadastrados…</option>
              {naoSelecionados.map((d) => <option key={d.Id} value={d.Id}>{d.Nome}{d.TemLogin ? '' : ' (avulso)'}</option>)}
            </select>
            <div className="row" style={{ marginBottom: 20 }}>
              <input className="inp" placeholder="Novo avulso…" value={novoAvulso} onChange={(e) => setNovoAvulso(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarAvulso(e); }} style={{ flex: 1 }} />
              <button type="button" className="txt-action" onClick={adicionarAvulso}>+ Adicionar</button>
            </div>
            <div className="chips">
              {selecionados.map((s) => (
                <span className="chip" key={s.jogadorId}>{s.nome}<span className="x" onClick={() => removerJogador(s.jogadorId)}>×</span></span>
              ))}
            </div>
            {selecionados.length >= 2 && (
              <button type="button" className="btn btn-lime btn-sm" style={{ marginTop: 22 }} onClick={sortearTimes}>🎲 Sortear times</button>
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

      {/* ETAPA 3 — Sorteio / Times */}
      {step === 2 && (
        <div>
          <div className="team-grid">
            {times.map((t, idx) => {
              const jogadores = selecionados.filter((s) => s.timeIndex === idx);
              return (
                <div className="team-edit" key={idx}>
                  <input className="inp" value={t.nome} onChange={(e) => alterarTime(idx, 'nome', e.target.value)} style={{ fontWeight: 700, marginBottom: 10 }} />
                  <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                    <label className="mini">V <input className="num-input" type="number" min="0" value={t.vitorias} onChange={(e) => alterarTime(idx, 'vitorias', e.target.value)} /></label>
                    <label className="mini">E <input className="num-input" type="number" min="0" value={t.empates} onChange={(e) => alterarTime(idx, 'empates', e.target.value)} /></label>
                    <label className="mini">D <input className="num-input" type="number" min="0" value={t.derrotas} onChange={(e) => alterarTime(idx, 'derrotas', e.target.value)} /></label>
                  </div>
                  {jogadores.length === 0 && <div className="mini">Nenhum jogador neste time</div>}
                  {jogadores.map((s) => (
                    <div className="team-line" key={s.jogadorId}>
                      <span className="n">{s.nome}</span>
                      <span className="row" style={{ gap: 6 }}>
                        <label className="mini" title="Gols">⚽<input className="num-input" type="number" min="0" value={s.gols} onChange={(e) => alterarSelecionado(s.jogadorId, 'gols', e.target.value)} /></label>
                        <label className="mini" title="Assistências">🅰️<input className="num-input" type="number" min="0" value={s.assistencias} onChange={(e) => alterarSelecionado(s.jogadorId, 'assistencias', e.target.value)} /></label>
                      </span>
                    </div>
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
              {finalizada ? ' · ✅ finalizada' : ' · ⏳ em andamento'}
            </div>
          </div>
          <div className="team-grid">
            {times.map((t, idx) => {
              const jogadores = selecionados.filter((s) => s.timeIndex === idx);
              return (
                <div className="team-card" key={idx}>
                  <div className="tt">{t.nome}</div>
                  <div className="rec">🏆 {t.vitorias}V · {t.empates}E · {t.derrotas}D</div>
                  {jogadores.map((s) => (
                    <div className="team-line" key={s.jogadorId}>
                      <span className="n">{s.nome}</span>
                      <span>
                        {s.gols > 0 && <span className="g">⚽ {s.gols}</span>}{' '}
                        {s.assistencias > 0 && <span className="a">🅰️ {s.assistencias}</span>}
                      </span>
                    </div>
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
