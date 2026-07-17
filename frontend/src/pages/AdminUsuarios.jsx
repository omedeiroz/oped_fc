import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome } from '../utils';

export default function AdminUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
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

  return (
    <div>
      <div className="page-head">
        <h1>Usuários</h1>
        <p>Gerencie quem tem permissão de administrador.</p>
      </div>

      {erro && <div className="alert alert-error">{erro}</div>}
      {carregando ? (
        <div className="loading">Carregando…</div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Usuário</th><th className="num">Admin</th><th></th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.Id}>
                  <td>
                    <div className="cell-jog">
                      <div className="avatar sm" style={{ background: corDoNome(u.Nome) }}>{iniciais(u.Nome)}</div>
                      <span style={{ fontWeight: 600 }}>{u.Nome}</span>
                    </div>
                  </td>
                  <td className="muted">@{u.Usuario || '—'}</td>
                  <td className="num">{u.IsAdmin ? <span className="badge-admin">admin</span> : <span className="muted">—</span>}</td>
                  <td className="num">
                    {u.Id === user.id ? (
                      <span className="mini">você</span>
                    ) : (
                      <button className={`btn btn-sm ${u.IsAdmin ? 'btn-danger' : 'btn-ghost'}`} onClick={() => alternarAdmin(u)}>
                        {u.IsAdmin ? 'Remover admin' : 'Tornar admin'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
