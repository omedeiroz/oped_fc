import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome, redimensionarImagem } from '../utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function dataCurta(iso) {
  const d = new Date(iso);
  return { d: String(d.getUTCDate()).padStart(2, '0'), m: MESES[d.getUTCMonth()] };
}

export default function Perfil() {
  const { user, atualizarFoto } = useAuth();
  const navigate = useNavigate();
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!user?.jogadorId) { setCarregando(false); return; }
    api.get(`/jogadores/${user.jogadorId}/historico`)
      .then(setHistorico)
      .catch((err) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [user?.jogadorId]);

  const totais = useMemo(() => historico.reduce((acc, h) => ({
    jogos: acc.jogos + 1,
    gols: acc.gols + h.Gols,
    assist: acc.assist + h.Assistencias,
    vitorias: acc.vitorias + (h.Vitorias || 0),
  }), { jogos: 0, gols: 0, assist: 0, vitorias: 0 }), [historico]);

  async function trocarFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro('');
    setEnviando(true);
    try {
      const dataUrl = await redimensionarImagem(file, 320, 0.85);
      const r = await api.put('/usuarios/me/foto', { foto: dataUrl });
      atualizarFoto(r.foto);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!user) return null;

  return (
    <div>
      <div className="profile-head">
        <div className="profile-photo">
          <div className="avatar xl" style={{ background: corDoNome(user.nome) }}>
            {user.foto ? <img src={user.foto} alt={user.nome} /> : iniciais(user.nome)}
          </div>
          <label htmlFor="foto-input" title={enviando ? 'Enviando…' : 'Alterar foto'}>
            {enviando ? '…' : '✎'}
          </label>
          <input id="foto-input" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={trocarFoto} disabled={enviando} />
        </div>
        <div>
          <div className="profile-name">{user.nome}</div>
          <div className="profile-user">@{user.usuario}</div>
          <div className="profile-stats">
            <div><div className="n">{totais.jogos}</div><div className="l">Jogos</div></div>
            <div><div className="n orange">{totais.gols}</div><div className="l">Gols</div></div>
            <div><div className="n">{totais.assist}</div><div className="l">Assist.</div></div>
            <div><div className="n lime">{totais.vitorias}</div><div className="l">Vitórias</div></div>
          </div>
        </div>
      </div>

      {erro && <div className="alert alert-error" style={{ marginTop: 16 }}>{erro}</div>}

      <h1 className="page-title" style={{ fontSize: 18, marginTop: 30, marginBottom: 14 }}>Histórico de peladas</h1>

      {!user.jogadorId ? (
        <div className="empty"><div className="big">🙈</div>Nenhum jogador vinculado à sua conta.</div>
      ) : carregando ? (
        <div className="loading">Carregando…</div>
      ) : historico.length === 0 ? (
        <div className="empty"><div className="big">⚽</div>Você ainda não participou de nenhuma pelada.</div>
      ) : (
        <div className="card">
          {historico.map((h) => {
            const { d, m } = dataCurta(h.DataPelada);
            return (
              <div className="hist-row" key={h.PeladaId} onClick={() => navigate(`/peladas/${h.PeladaId}`)}>
                <div className="hd">{d}<small>{m}</small></div>
                <div className="hi">
                  <div className="ht">{h.Local || 'Pelada'}{h.TimeNome ? ` · ${h.TimeNome}` : ''}</div>
                  {h.TimeNome && <div className="hs">🏆 {h.Vitorias}V · {h.Empates}E · {h.Derrotas}D</div>}
                </div>
                <div className="hg">
                  {h.Gols > 0 && <span className="g">⚽ {h.Gols}</span>}
                  {h.Assistencias > 0 && <span className="a">🅰️ {h.Assistencias}</span>}
                  {h.Gols === 0 && h.Assistencias === 0 && <span className="a">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
