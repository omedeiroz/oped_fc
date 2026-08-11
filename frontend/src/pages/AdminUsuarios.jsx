import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

function SecaoAvulsos() {
  const [jogadores, setJogadores] = useState([]);
  const [abertoId, setAbertoId] = useState(null);
  const [form, setForm] = useState({ usuario: '', senha: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setJogadores(await api.get('/jogadores')); }
    catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  const avulsos = jogadores.filter((j) => !j.TemLogin);

  function abrir(j) {
    setAbertoId(j.Id);
    setForm({ usuario: '', senha: '' });
    setErro('');
  }

  async function criarLogin(e, jogadorId) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.post(`/jogadores/${jogadorId}/criar-login`, form);
      setAbertoId(null);
      await carregar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return null;
  if (avulsos.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="eyebrow">Jogadores avulsos (sem login)</div>
      {erro && <div className="alert alert-error">{erro}</div>}
      {avulsos.map((j) => (
        <div className="user-line" key={j.Id} style={{ flexWrap: 'wrap' }}>
          <div className="info"><div className="nm">{j.Nome}</div></div>
          {abertoId === j.Id ? (
            <form className="row" style={{ gap: 8 }} onSubmit={(e) => criarLogin(e, j.Id)}>
              <input
                className="inp inp-sm" style={{ width: 130 }} placeholder="usuário" required
                value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })}
              />
              <input
                className="inp inp-sm" style={{ width: 110 }} placeholder="senha (6+)" type="password" required
                value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })}
              />
              <button className="txt-action" type="submit" disabled={salvando}>{salvando ? '...' : 'criar'}</button>
              <button className="txt-muted" type="button" onClick={() => setAbertoId(null)}>cancelar</button>
            </form>
          ) : (
            <button className="txt-action" onClick={() => abrir(j)}>criar login →</button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setUsuarios(await api.get('/usuarios')); }
    catch (err) { setErro(err.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function alternarAdmin(u) {
    setErro('');
    try {
      await api.patch(`/usuarios/${u.Id}/admin`, { isAdmin: !u.IsAdmin });
      setUsuarios((prev) => prev.map((x) => (x.Id === u.Id ? { ...x, IsAdmin: !x.IsAdmin } : x)));
    } catch (err) { setErro(err.message); }
  }

  async function excluir(u) {
    if (!window.confirm(`Excluir ${u.Nome} (@${u.Usuario})? Se o jogador já tiver estatísticas, ele só será desativado (histórico é preservado).`)) return;
    setErro('');
    try {
      await api.del(`/usuarios/${u.Id}`);
      setUsuarios((prev) => prev.filter((x) => x.Id !== u.Id));
    } catch (err) { setErro(err.message); }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.Nome.toLowerCase().includes(q) || (u.Usuario || '').toLowerCase().includes(q));
  }, [usuarios, busca]);

  return (
    <div>
      <h1 className="page-title">Usuários</h1>
      {erro && <div className="alert alert-error">{erro}</div>}

      <SecaoAvulsos />

      <input className="inp" placeholder="🔍 Buscar usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 18, maxWidth: 340 }} />

      {carregando ? (
        <div className="loading">Carregando…</div>
      ) : (
        <div>
          {filtrados.map((u) => (
            <div className="user-line" key={u.Id}>
              <div className="info">
                <div className="nm">{u.Nome}</div>
                <div className="u">@{u.Usuario || '—'}</div>
              </div>
              {u.IsAdmin && <span className="tag-admin" style={{ marginRight: 12 }}>admin</span>}
              {u.Id === user.id ? (
                <span className="mini">você</span>
              ) : (
                <div className="row" style={{ gap: 16 }}>
                  <button className={u.IsAdmin ? 'txt-muted' : 'txt-action navy'} onClick={() => alternarAdmin(u)}>
                    {u.IsAdmin ? 'remover admin' : 'tornar admin →'}
                  </button>
                  <button className="txt-action" style={{ color: '#d33' }} onClick={() => excluir(u)}>excluir</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
