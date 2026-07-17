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
    try {
      setUsuarios(await api.get('/usuarios'));
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { carregar(); }, []);

  async function alternarAdmin(u) {
    setErro('');
    try {
      await api.patch(`/usuarios/${u.Id}/admin`, { isAdmin: !u.IsAdmin });
      setUsuarios((prev) => prev.map((x) => (x.Id === u.Id ? { ...x, IsAdmin: !x.IsAdmin } : x)));
    } catch (err) {
      setErro(err.message);
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.Nome.toLowerCase().includes(q) || (u.Usuario || '').toLowerCase().includes(q));
  }, [usuarios, busca]);

  return (
    <div>
      <div className="page-head">
        <h1>Usuários</h1>
        <p>Gerencie quem tem permissão de administrador.</p>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}

      <input className="inp" placeholder="🔍 Buscar usuário…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 20, maxWidth: 360 }} />

      {carregando ? (
        <div className="loading">Carregando…</div>
      ) : (
        <div>
          {filtrados.map((u) => (
            <div className="user-line" key={u.Id}>
              <span className="un">{u.Nome} <span className="u">@{u.Usuario || '—'}</span></span>
              <span className="row" style={{ gap: 14 }}>
                {u.IsAdmin && <span className="tag-admin">admin</span>}
                {u.Id === user.id ? (
                  <span className="muted-2" style={{ fontSize: 12 }}>você</span>
                ) : (
                  <button className={u.IsAdmin ? 'txt-muted' : 'txt-action'} onClick={() => alternarAdmin(u)}>
                    {u.IsAdmin ? 'remover admin' : 'tornar admin →'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
