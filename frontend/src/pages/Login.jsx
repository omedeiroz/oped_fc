import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

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

  function trocar(m) { setModo(m); setErro(''); }

  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="auth-logo">
          <div className="logo">⚽</div>
          <h1>Pelada OPED FC</h1>
          <div className="sub">Fundação CAEd</div>
        </div>

        <div className="auth-toggle">
          <button className={modo === 'login' ? 'active' : ''} onClick={() => trocar('login')}>Entrar</button>
          <button className={modo === 'cadastro' ? 'active' : ''} onClick={() => trocar('cadastro')}>Criar conta</button>
        </div>

        {erro && <div className="alert alert-error">{erro}</div>}

        <form onSubmit={submit}>
          {modo === 'cadastro' && (
            <div className="field">
              <label>Nome completo</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Arthur Pereira" required />
            </div>
          )}
          <div className="field">
            <label>Usuário</label>
            <div className="input-icon">
              <span>@</span>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="arthur.pereira" autoCapitalize="none" required />
            </div>
          </div>
          {modo === 'cadastro' && (
            <div className="field">
              <label>Email <span style={{ textTransform: 'none' }}>(opcional)</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
          )}
          <div className="field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••" required />
          </div>
          <button className="btn btn-block" disabled={carregando}>
            {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
