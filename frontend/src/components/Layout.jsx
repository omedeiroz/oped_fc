import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome } from '../utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="logo">⚽</span>
            <span>Pelada OPED FC<small>Fundação CAEd</small></span>
          </div>
          <nav className="nav">
            <NavLink to="/" end>Ranking</NavLink>
            <NavLink to="/peladas">Peladas</NavLink>
            {user?.isAdmin && <NavLink to="/admin/usuarios">Usuários</NavLink>}
          </nav>
          <span className="spacer" />
          <div className="userbox">
            <div className="avatar sm" style={{ background: corDoNome(user?.nome) }}>{iniciais(user?.nome)}</div>
            <span style={{ fontWeight: 600 }}>{user?.nome?.split(' ')[0]}</span>
            {user?.isAdmin && <span className="badge-admin">admin</span>}
            <button className="btn btn-ghost btn-sm" onClick={sair}>Sair</button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
