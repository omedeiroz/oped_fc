import { useEffect, useState } from 'react';
import { api } from '../api';

const TIERS = ['S+', 'A', 'B'];

function SecaoSaldos() {
  const [usuarios, setUsuarios] = useState([]);
  const [valores, setValores] = useState({});
  const [descricoes, setDescricoes] = useState({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setUsuarios(await api.get('/usuarios')); }
    catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function aplicar(u) {
    const valor = parseInt(valores[u.Id], 10);
    if (!valor) return;
    setErro('');
    try {
      const r = await api.put(`/usuarios/${u.Id}/saldo`, { valor, descricao: descricoes[u.Id] || '' });
      setUsuarios((prev) => prev.map((x) => (x.Id === u.Id ? { ...x, SaldoFichas: r.saldoFichas } : x)));
      setValores((prev) => ({ ...prev, [u.Id]: '' }));
      setDescricoes((prev) => ({ ...prev, [u.Id]: '' }));
    } catch (err) { setErro(err.message); }
  }

  if (carregando) return <div className="loading">Carregando…</div>;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="eyebrow">Saldo dos usuários</div>
      {erro && <div className="alert alert-error">{erro}</div>}
      {usuarios.map((u) => (
        <div className="user-line" key={u.Id}>
          <div className="info">
            <div className="nm">{u.Nome}</div>
            <div className="u">@{u.Usuario || '—'} · 💰 {u.SaldoFichas}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="inp inp-sm" type="number" placeholder="+/- fichas"
              value={valores[u.Id] ?? ''}
              onChange={(e) => setValores((prev) => ({ ...prev, [u.Id]: e.target.value }))}
            />
            <input
              className="inp inp-sm" placeholder="motivo" style={{ width: 120 }}
              value={descricoes[u.Id] ?? ''}
              onChange={(e) => setDescricoes((prev) => ({ ...prev, [u.Id]: e.target.value }))}
            />
            <button className="txt-action" onClick={() => aplicar(u)}>aplicar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecaoTiers() {
  const [jogadores, setJogadores] = useState([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setJogadores(await api.get('/jogadores')); }
    catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function mudarTier(j, tier) {
    setErro('');
    try {
      await api.patch(`/jogadores/${j.Id}/tier`, { tier });
      setJogadores((prev) => prev.map((x) => (x.Id === j.Id ? { ...x, Tier: tier } : x)));
    } catch (err) { setErro(err.message); }
  }

  if (carregando) return <div className="loading">Carregando…</div>;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="eyebrow">Tier dos jogadores</div>
      {erro && <div className="alert alert-error">{erro}</div>}
      {jogadores.map((j) => (
        <div className="user-line" key={j.Id}>
          <div className="info"><div className="nm">{j.Nome}</div></div>
          <select className="inp select-time" value={j.Tier || 'B'} onChange={(e) => mudarTier(j, e.target.value)}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function SecaoTipos() {
  const [tipos, setTipos] = useState([]);
  const [edicoes, setEdicoes] = useState({});
  const [novo, setNovo] = useState({ nome: '', chave: '', autoResolve: false, oddSPlus: 3, oddA: 4, oddB: 5 });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setTipos(await api.get('/apostas/tipos')); }
    catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  function campo(tipo, chave) {
    return edicoes[tipo.Id]?.[chave] ?? tipo[chave];
  }
  function mudarCampo(tipoId, chave, valor) {
    setEdicoes((prev) => ({ ...prev, [tipoId]: { ...prev[tipoId], [chave]: valor } }));
  }

  async function salvar(tipo) {
    setErro('');
    const e = edicoes[tipo.Id] || {};
    try {
      await api.put(`/apostas/tipos/${tipo.Id}`, {
        nome: e.Nome ?? tipo.Nome,
        autoResolve: e.AutoResolve ?? tipo.AutoResolve,
        ativo: e.Ativo ?? tipo.Ativo,
        oddSPlus: Number(e.OddSPlus ?? tipo.OddSPlus),
        oddA: Number(e.OddA ?? tipo.OddA),
        oddB: Number(e.OddB ?? tipo.OddB),
      });
      await carregar();
      setEdicoes((prev) => ({ ...prev, [tipo.Id]: undefined }));
    } catch (err) { setErro(err.message); }
  }

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/apostas/tipos', novo);
      setNovo({ nome: '', chave: '', autoResolve: false, oddSPlus: 3, oddA: 4, oddB: 5 });
      await carregar();
    } catch (err) { setErro(err.message); }
  }

  if (carregando) return <div className="loading">Carregando…</div>;
  return (
    <div className="card">
      <div className="eyebrow">Categorias de aposta</div>
      {erro && <div className="alert alert-error">{erro}</div>}

      {tipos.map((t) => (
        <div className="user-line" key={t.Id} style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="info" style={{ minWidth: 160 }}>
            <input className="inp inp-sm" style={{ width: 160 }} value={campo(t, 'Nome')} onChange={(e) => mudarCampo(t.Id, 'Nome', e.target.value)} />
            <div className="u">{t.Chave} · {t.AutoResolve ? 'auto' : 'manual'}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label className="mini">S+ <input className="inp inp-sm" type="number" step="0.1" value={campo(t, 'OddSPlus')} onChange={(e) => mudarCampo(t.Id, 'OddSPlus', e.target.value)} /></label>
            <label className="mini">A <input className="inp inp-sm" type="number" step="0.1" value={campo(t, 'OddA')} onChange={(e) => mudarCampo(t.Id, 'OddA', e.target.value)} /></label>
            <label className="mini">B <input className="inp inp-sm" type="number" step="0.1" value={campo(t, 'OddB')} onChange={(e) => mudarCampo(t.Id, 'OddB', e.target.value)} /></label>
            <label className="check-row mini">
              <input type="checkbox" checked={campo(t, 'Ativo')} onChange={(e) => mudarCampo(t.Id, 'Ativo', e.target.checked)} /> ativo
            </label>
            <button className="txt-action" onClick={() => salvar(t)}>salvar</button>
          </div>
        </div>
      ))}

      <form onSubmit={criar} style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <div className="eyebrow">Nova categoria</div>
        <div className="row" style={{ gap: 8 }}>
          <input className="inp inp-sm" style={{ width: 140 }} placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className="inp inp-sm" style={{ width: 100 }} placeholder="chave" value={novo.chave} onChange={(e) => setNovo({ ...novo, chave: e.target.value })} />
          <label className="mini">S+ <input className="inp inp-sm" type="number" step="0.1" value={novo.oddSPlus} onChange={(e) => setNovo({ ...novo, oddSPlus: e.target.value })} /></label>
          <label className="mini">A <input className="inp inp-sm" type="number" step="0.1" value={novo.oddA} onChange={(e) => setNovo({ ...novo, oddA: e.target.value })} /></label>
          <label className="mini">B <input className="inp inp-sm" type="number" step="0.1" value={novo.oddB} onChange={(e) => setNovo({ ...novo, oddB: e.target.value })} /></label>
          <label className="check-row mini">
            <input type="checkbox" checked={novo.autoResolve} onChange={(e) => setNovo({ ...novo, autoResolve: e.target.checked })} /> auto
          </label>
          <button className="btn btn-sm" type="submit">+ Criar</button>
        </div>
      </form>
    </div>
  );
}

export default function ApostasAdmin() {
  return (
    <div>
      <h1 className="page-title">Administrar apostas</h1>
      <SecaoSaldos />
      <SecaoTiers />
      <SecaoTipos />
    </div>
  );
}
