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
    <div className="auth">
      <div className="auth-left">
        <div className="auth-title">PELADA<br />OPED FC</div>
        <div className="auth-bar" />
        <div className="auth-desc">
          O ranking, as escalações e o histórico de todas as peladas do time — direto da Fundação CAEd.
        </div>
        <div className="auth-stats">
          <div><div className="n">{stats.TotalPeladas}</div><div className="l">peladas</div></div>
          <div><div className="n accent">{stats.TotalGols}</div><div className="l">gols</div></div>
          <div><div className="n">{stats.TotalJogadores}</div><div className="l">jogadores</div></div>
        </div>
      </div>

      <div className="auth-right">
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
          <button className="btn btn-block" disabled={carregando} style={{ marginTop: 8 }}>
            {carregando ? 'AGUARDE…' : modo === 'login' ? 'ENTRAR →' : 'CADASTRAR →'}
          </button>
        </form>
      </div>
    </div>
  );
}
