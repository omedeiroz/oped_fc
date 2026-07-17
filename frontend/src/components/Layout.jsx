import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

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
            <span className="mark" />
            <span className="txt">PELADA OPED FC<small>Fundação CAEd</small></span>
          </div>
          <nav className="nav">
            <NavLink to="/" end>Ranking</NavLink>
            <NavLink to="/peladas">Peladas</NavLink>
            {user?.isAdmin && <NavLink to="/admin/usuarios">Usuários</NavLink>}
          </nav>
          <span className="spacer" />
          <div className="userbox">
            <span className="who">{user?.nome?.split(' ')[0]}</span>
            {user?.isAdmin && <span className="tag-admin">admin</span>}
            <button className="txt-muted" onClick={sair}>Sair</button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
