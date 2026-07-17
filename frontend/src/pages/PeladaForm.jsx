import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { iniciais, corDoNome } from '../utils';

const CORES_TIME = ['#16a34a', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];

function timesIniciais(n) {
  return Array.from({ length: n }, (_, i) => ({ nome: `Time ${i + 1}`, vitorias: 0, empates: 0, derrotas: 0 }));
}

export default function PeladaForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();

  const [dataPelada, setDataPelada] = useState(() => new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState('');
  const [observacao, setObservacao] = useState('');
  const [finalizada, setFinalizada] = useState(false);
  const [numTimes, setNumTimes] = useState(2);
  const [times, setTimes] = useState(timesIniciais(2));

  const [disponiveis, setDisponiveis] = useState([]);
  const [selecionados, setSelecionados] = useState([]); // { jogadorId, nome, timeIndex, gols, assistencias }
  const [selectValue, setSelectValue] = useState('');
  const [novoAvulso, setNovoAvulso] = useState('');

  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carrega jogadores disponíveis + (se edição) a pelada existente
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
          setSelecionados(
            participacoes.map((p) => ({
              jogadorId: p.JogadorId,
              nome: p.JogadorNome,
              timeIndex: p.TimeId != null ? idxPorTime[p.TimeId] : null,
              gols: p.Gols,
              assistencias: p.Assistencias,
            }))
          );
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
    // Remove atribuições de times que não existem mais
    setSelecionados((prev) => prev.map((s) => (s.timeIndex != null && s.timeIndex >= n ? { ...s, timeIndex: null } : s)));
  }

  function addJogador(jogadorId) {
    jogadorId = parseInt(jogadorId, 10);
    if (!jogadorId) return;
    if (selecionados.some((s) => s.jogadorId === jogadorId)) return;
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

  function sortearTimes() {
    if (selecionados.length === 0) return;
    const embaralhados = [...selecionados];
    for (let i = embaralhados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
    }
    const comTime = embaralhados.map((s, i) => ({ ...s, timeIndex: i % numTimes }));
    // Reordena de volta pela ordem original de seleção
    const mapa = {};
    comTime.forEach((s) => { mapa[s.jogadorId] = s.timeIndex; });
    setSelecionados((prev) => prev.map((s) => ({ ...s, timeIndex: mapa[s.jogadorId] })));
  }

  function alterarTime(idx, campo, valor) {
    setTimes((prev) => prev.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t)));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (selecionados.length < 2) { setErro('Selecione ao menos 2 jogadores.'); return; }
    setSalvando(true);
    const payload = {
      dataPelada, local, observacao, finalizada,
      times: times.map((t) => ({
        nome: t.nome,
        vitorias: parseInt(t.vitorias, 10) || 0,
        empates: parseInt(t.empates, 10) || 0,
        derrotas: parseInt(t.derrotas, 10) || 0,
      })),
      participacoes: selecionados.map((s) => ({
        jogadorId: s.jogadorId,
        timeIndex: s.timeIndex,
        gols: parseInt(s.gols, 10) || 0,
        assistencias: parseInt(s.assistencias, 10) || 0,
      })),
    };
    try {
      if (editando) {
        await api.put(`/peladas/${id}`, payload);
        navigate(`/peladas/${id}`);
      } else {
        const r = await api.post('/peladas', payload);
        navigate(`/peladas/${r.id}`);
      }
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  }

  const naoSelecionados = disponiveis.filter((d) => !selecionados.some((s) => s.jogadorId === d.Id));

  return (
    <form onSubmit={salvar}>
      <div className="between">
        <h1>{editando ? 'Editar pelada' : 'Nova pelada'}</h1>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancelar</button>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      {/* Dados básicos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 150px' }}>
            <label>Data *</label>
            <input type="date" value={dataPelada} onChange={(e) => setDataPelada(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: '2 1 220px' }}>
            <label>Local</label>
            <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Society do trabalho" />
          </div>
          <div className="field" style={{ flex: '1 1 120px' }}>
            <label>Nº de times</label>
            <input type="number" min="2" max="6" value={numTimes} onChange={(e) => mudarNumTimes(parseInt(e.target.value, 10) || 2)} />
          </div>
        </div>
        <div className="field">
          <label>Observação</label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
        </div>
        <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
          <input type="checkbox" style={{ width: 18 }} checked={finalizada} onChange={(e) => setFinalizada(e.target.checked)} />
          <span>Pelada finalizada (resultados fechados)</span>
        </label>
      </div>

      {/* Seleção de jogadores */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title"><h3 style={{ margin: 0 }}>Jogadores</h3><span className="muted">({selecionados.length})</span></div>
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={selectValue} onChange={(e) => addJogador(e.target.value)} style={{ flex: '1 1 220px' }}>
            <option value="">+ Adicionar dos cadastrados…</option>
            {naoSelecionados.map((d) => (
              <option key={d.Id} value={d.Id}>{d.Nome}{d.TemLogin ? '' : ' (avulso)'}</option>
            ))}
          </select>
          <span className="row" style={{ flex: '1 1 220px', gap: 6 }}>
            <input placeholder="Novo avulso…" value={novoAvulso} onChange={(e) => setNovoAvulso(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') adicionarAvulso(e); }} />
            <button type="button" className="btn btn-ghost" onClick={adicionarAvulso}>Add</button>
          </span>
        </div>

        {selecionados.length > 0 && (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              {selecionados.map((s) => (
                <span className="chip" key={s.jogadorId}>
                  {s.nome}
                  <span className="x" onClick={() => removerJogador(s.jogadorId)}>×</span>
                </span>
              ))}
            </div>
            <button type="button" className="btn btn-amarelo" onClick={sortearTimes}>🎲 Sortear times</button>
          </>
        )}
      </div>

      {/* Times + estatísticas */}
      {selecionados.length > 0 && (
        <div className="times-grid" style={{ marginBottom: 16 }}>
          {times.map((t, idx) => {
            const jogadores = selecionados.filter((s) => s.timeIndex === idx);
            const cor = CORES_TIME[idx % CORES_TIME.length];
            return (
              <div className="time-col" key={idx} style={{ '--tcor': cor }}>
                <h4>
                  <span className="avatar sm" style={{ background: cor, width: 22, height: 22, fontSize: 11 }}>{idx + 1}</span>
                  <input value={t.nome} onChange={(e) => alterarTime(idx, 'nome', e.target.value)} />
                </h4>
                <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                  <label className="mini">V <input className="num-input" type="number" min="0" value={t.vitorias} onChange={(e) => alterarTime(idx, 'vitorias', e.target.value)} /></label>
                  <label className="mini">E <input className="num-input" type="number" min="0" value={t.empates} onChange={(e) => alterarTime(idx, 'empates', e.target.value)} /></label>
                  <label className="mini">D <input className="num-input" type="number" min="0" value={t.derrotas} onChange={(e) => alterarTime(idx, 'derrotas', e.target.value)} /></label>
                </div>
                {jogadores.length === 0 && <div className="mini">Sorteie ou escolha o time abaixo</div>}
                {jogadores.map((s) => (
                  <div className="jog-line" key={s.jogadorId}>
                    <div className="avatar sm" style={{ background: corDoNome(s.nome) }}>{iniciais(s.nome)}</div>
                    <span className="nome" style={{ fontWeight: 600 }}>{s.nome}</span>
                    <label className="mini" title="Gols">⚽<input className="num-input" type="number" min="0" value={s.gols} onChange={(e) => alterarSelecionado(s.jogadorId, 'gols', e.target.value)} /></label>
                    <label className="mini" title="Assistências">🅰️<input className="num-input" type="number" min="0" value={s.assistencias} onChange={(e) => alterarSelecionado(s.jogadorId, 'assistencias', e.target.value)} /></label>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Jogadores ainda sem time */}
      {selecionados.some((s) => s.timeIndex == null) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="mini" style={{ marginBottom: 8 }}>Sem time — defina manualmente ou sorteie</div>
          {selecionados.filter((s) => s.timeIndex == null).map((s) => (
            <div className="jog-line" key={s.jogadorId}>
              <span className="nome">{s.nome}</span>
              <select value="" onChange={(e) => alterarSelecionado(s.jogadorId, 'timeIndex', parseInt(e.target.value, 10))} style={{ width: 130 }}>
                <option value="">Escolher time…</option>
                {times.map((t, i) => <option key={i} value={i}>{t.nome}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <button className="btn" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar pelada'}</button>
    </form>
  );
}
