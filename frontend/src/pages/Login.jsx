import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login');
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [stats, setStats] = useState({ TotalPeladas: 0, TotalGols: 0, TotalJogadores: 0 });

  useEffect(() => {
    api.get('/stats/publico').then(setStats).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      if (modo === 'login') await login(usuario, senha);
      else await register({ nome, usuario, senha, email });
      navigate('/');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="t">Pelada<br />OPED FC</div>
          <div className="bar" />
        </div>
        <div className="auth-body">
          <div className="auth-toggle">
            <button className={modo === 'login' ? 'active' : ''} onClick={() => { setModo('login'); setErro(''); }}>Entrar</button>
            <button className={modo === 'cadastro' ? 'active' : ''} onClick={() => { setModo('cadastro'); setErro(''); }}>Criar conta</button>
          </div>

          {erro && <div className="alert alert-error">{erro}</div>}

          <form onSubmit={submit}>
            {modo === 'cadastro' && (
              <div className="field">
                <label>Nome completo</label>
                <input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="xxxx" required />
              </div>
            )}
            <div className="field">
              <label>Usuário</label>
              <input className="inp" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="xxx.xxx" autoCapitalize="none" required />
            </div>
            {modo === 'cadastro' && (
              <div className="field">
                <label>Email (opcional)</label>
                <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
            )}
            <div className="field">
              <label>Senha</label>
              <input className="inp" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" required />
            </div>
            <button className="btn btn-block" disabled={carregando} style={{ marginTop: 6 }}>
              {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar →' : 'Cadastrar →'}
            </button>
          </form>

          <div className="auth-stats">
            <div><div className="n lime">{stats.TotalPeladas}</div><div className="l">Peladas</div></div>
            <div><div className="n orange">{stats.TotalGols}</div><div className="l">Gols</div></div>
            <div><div className="n navy">{stats.TotalJogadores}</div><div className="l">Jogadores</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
