import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome } from '../utils';

function lerTema() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tema, setTema] = useState(lerTema);

  function alternarTema() {
    const novo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('theme', novo); } catch (e) { /* ignore */ }
    setTema(novo);
  }

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
            <span className="txt">Pelada OPED FC</span>
          </div>
          <nav className="nav">
            <NavLink to="/" end>Ranking</NavLink>
            <NavLink to="/peladas">Peladas</NavLink>
            <NavLink to="/perfil">Perfil</NavLink>
            {user?.isAdmin && <NavLink to="/admin/usuarios">Usuários</NavLink>}
          </nav>
          <span className="spacer" />
          <div className="userbox">
            <button className="theme-toggle" onClick={alternarTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
              {tema === 'dark' ? '☀️' : '🌙'}
            </button>
            <NavLink to="/perfil" className="avatar sm" style={{ background: corDoNome(user?.nome) }}>
              {user?.foto ? <img src={user.foto} alt="" /> : iniciais(user?.nome)}
            </NavLink>
            <span className="who">{user?.nome?.split(' ')[0]}</span>
            {user?.isAdmin && <span className="tag-admin">admin</span>}
            <button className="txt-muted" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={sair}>Sair</button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
