import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // login | cadastro | recuperar
  const [etapaRecuperar, setEtapaRecuperar] = useState('email'); // email | codigo

  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [recUsuario, setRecUsuario] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recCodigo, setRecCodigo] = useState('');
  const [recNovaSenha, setRecNovaSenha] = useState('');
  const [recConfirmarSenha, setRecConfirmarSenha] = useState('');

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [stats, setStats] = useState({ TotalPeladas: 0, TotalJogadores: 0 });

  useEffect(() => {
    api.get('/stats/publico').then(setStats).catch(() => {});
  }, []);

  function irPara(novoModo) {
    setModo(novoModo);
    setEtapaRecuperar('email');
    setErro('');
    setSucesso('');
  }

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

  async function pedirCodigo(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/auth/esqueci-senha', { usuario: recUsuario, email: recEmail });
      setEtapaRecuperar('codigo');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function redefinirSenha(e) {
    e.preventDefault();
    setErro('');
    if (recNovaSenha !== recConfirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    try {
      await api.post('/auth/redefinir-senha', { email: recEmail, codigo: recCodigo, novaSenha: recNovaSenha });
      setRecUsuario(''); setRecEmail(''); setRecCodigo(''); setRecNovaSenha(''); setRecConfirmarSenha('');
      irPara('login');
      setSucesso('Senha redefinida! Já pode entrar com a nova senha.');
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
          {modo !== 'recuperar' && (
            <div className="auth-toggle">
              <button className={modo === 'login' ? 'active' : ''} onClick={() => irPara('login')}>Entrar</button>
              <button className={modo === 'cadastro' ? 'active' : ''} onClick={() => irPara('cadastro')}>Criar conta</button>
            </div>
          )}

          {erro && <div className="alert alert-error">{erro}</div>}
          {sucesso && <div className="alert alert-ok">{sucesso}</div>}

          {/* Login / Cadastro */}
          {modo !== 'recuperar' && (
            <form onSubmit={submit}>
              {modo === 'cadastro' && (
                <div className="field">
                  <label>Nome completo</label>
                  <input className="inp" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required />
                </div>
              )}
              <div className="field">
                <label>Usuário</label>
                <input className="inp" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="seu.usuario" autoCapitalize="none" required />
              </div>
              {modo === 'cadastro' && (
                <div className="field">
                  <label>Email (opcional, mas recomendado)</label>
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
              {modo === 'login' && (
                <button type="button" className="txt-muted" style={{ display: 'block', margin: '14px auto 0' }} onClick={() => irPara('recuperar')}>
                  Esqueci minha senha
                </button>
              )}
            </form>
          )}

          {/* Recuperar — etapa 1: usuário + email */}
          {modo === 'recuperar' && etapaRecuperar === 'email' && (
            <form onSubmit={pedirCodigo}>
              <p style={{ margin: '0 0 16px' }}>Informe seu usuário e o seu email.</p>
              <div className="field">
                <label>Usuário</label>
                <input className="inp" value={recUsuario} onChange={(e) => setRecUsuario(e.target.value)} placeholder="seu.usuario" autoCapitalize="none" required />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="inp" type="email" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} placeholder="voce@email.com" required />
              </div>
              <button className="btn btn-block" disabled={carregando} style={{ marginTop: 6 }}>
                {carregando ? 'Enviando…' : 'Enviar código →'}
              </button>
              <button type="button" className="txt-muted" style={{ display: 'block', margin: '14px auto 0' }} onClick={() => irPara('login')}>
                ← Voltar pro login
              </button>
            </form>
          )}

          {/* Recuperar — etapa 2: código + nova senha */}
          {modo === 'recuperar' && etapaRecuperar === 'codigo' && (
            <form onSubmit={redefinirSenha}>
              <p style={{ margin: '0 0 16px' }}>Insira aqui o código enviado ao seu e-mail. Esse código expira em 15 minutos.</p>
              <div className="field">
                <label>Código</label>
                <input className="inp" value={recCodigo} onChange={(e) => setRecCodigo(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} required />
              </div>
              <div className="field">
                <label>Nova senha</label>
                <input className="inp" type="password" value={recNovaSenha} onChange={(e) => setRecNovaSenha(e.target.value)} placeholder="••••••" required />
              </div>
              <div className="field">
                <label>Confirmar nova senha</label>
                <input className="inp" type="password" value={recConfirmarSenha} onChange={(e) => setRecConfirmarSenha(e.target.value)} placeholder="••••••" required />
              </div>
              <button className="btn btn-block" disabled={carregando} style={{ marginTop: 6 }}>
                {carregando ? 'Redefinindo…' : 'Redefinir senha →'}
              </button>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <button type="button" className="txt-muted" onClick={() => setEtapaRecuperar('email')}>← Trocar email</button>
                <button type="button" className="txt-muted" onClick={() => irPara('login')}>Cancelar</button>
              </div>
            </form>
          )}

          {modo !== 'recuperar' && (
            <div className="auth-stats">
              <div><div className="n lime">{stats.TotalPeladas}</div><div className="l">Peladas</div></div>
              <div><div className="n navy">{stats.TotalJogadores}</div><div className="l">Jogadores</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
