import { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

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

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.Nome.toLowerCase().includes(q) || (u.Usuario || '').toLowerCase().includes(q));
  }, [usuarios, busca]);

  return (
    <div>
      <h1 className="page-title">Usuários</h1>
      {erro && <div className="alert alert-error">{erro}</div>}

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
                <button className={u.IsAdmin ? 'txt-muted' : 'txt-action navy'} onClick={() => alternarAdmin(u)}>
                  {u.IsAdmin ? 'remover admin' : 'tornar admin →'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
