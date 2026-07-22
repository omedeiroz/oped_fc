import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Peladas from './pages/Peladas.jsx';
import PeladaDetalhe from './pages/PeladaDetalhe.jsx';
import PeladaForm from './pages/PeladaForm.jsx';
import AdminUsuarios from './pages/AdminUsuarios.jsx';
import Perfil from './pages/Perfil.jsx';
import VotarPelada from './pages/VotarPelada.jsx';

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Carregando…</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/jogador/:id" element={<Perfil />} />
        <Route path="/peladas" element={<Peladas />} />
        <Route path="/peladas/:id" element={<PeladaDetalhe />} />
        <Route path="/peladas/:id/votar" element={<VotarPelada />} />
        <Route
          path="/peladas/nova"
          element={<Protected adminOnly><PeladaForm /></Protected>}
        />
        <Route
          path="/peladas/:id/editar"
          element={<Protected adminOnly><PeladaForm /></Protected>}
        />
        <Route
          path="/admin/usuarios"
          element={<Protected adminOnly><AdminUsuarios /></Protected>}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
