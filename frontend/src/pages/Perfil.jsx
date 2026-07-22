import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { iniciais, corDoNome, redimensionarImagem } from '../utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function dataCurta(iso) {
  const d = new Date(iso);
  return { d: String(d.getUTCDate()).padStart(2, '0'), m: MESES[d.getUTCMonth()] };
}

export default function Perfil() {
  const { id } = useParams(); // presente = vendo o perfil de outra pessoa
  const { user, atualizarFoto } = useAuth();
  const navigate = useNavigate();
  const ehOutro = Boolean(id);

  const [pessoa, setPessoa] = useState(null); // { jogadorId, nome, usuario, foto }
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    setErro('');

    async function carregar() {
      try {
        let jogadorId;
        if (ehOutro) {
          const j = await api.get(`/jogadores/${id}`);
          setPessoa({ jogadorId: j.jogadorId, nome: j.nome, usuario: j.usuario, foto: j.foto });
          jogadorId = j.jogadorId;
        } else {
          setPessoa({ jogadorId: user?.jogadorId, nome: user?.nome, usuario: user?.usuario, foto: user?.foto });
          jogadorId = user?.jogadorId;
        }
        if (jogadorId) {
          setHistorico(await api.get(`/jogadores/${jogadorId}/historico`));
        } else {
          setHistorico([]);
        }
      } catch (err) {
        setErro(err.message);
      } finally {
        setCarregando(false);
      }
    }
    if (ehOutro || user) carregar();
  }, [ehOutro, id, user]);

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
      setPessoa((prev) => (prev ? { ...prev, foto: r.foto } : prev));
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!pessoa && carregando) return <div className="loading">Carregando…</div>;
  if (!pessoa) return null;

  return (
    <div>
      {ehOutro && <button className="txt-muted" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>← Voltar</button>}

      <div className="profile-head">
        <div className="profile-photo">
          <div className="avatar xl" style={{ background: corDoNome(pessoa.nome) }}>
            {pessoa.foto ? <img src={pessoa.foto} alt={pessoa.nome} /> : iniciais(pessoa.nome)}
          </div>
          {!ehOutro && (
            <>
              <label htmlFor="foto-input" title={enviando ? 'Enviando…' : 'Alterar foto'}>
                {enviando ? '…' : '✎'}
              </label>
              <input id="foto-input" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={trocarFoto} disabled={enviando} />
            </>
          )}
        </div>
        <div>
          <div className="profile-name">{pessoa.nome}</div>
          {pessoa.usuario && <div className="profile-user">@{pessoa.usuario}</div>}
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

      {!pessoa.jogadorId ? (
        <div className="empty"><div className="big">🙈</div>Nenhum jogador vinculado a essa conta.</div>
      ) : carregando ? (
        <div className="loading">Carregando…</div>
      ) : historico.length === 0 ? (
        <div className="empty"><div className="big">⚽</div>{ehOutro ? 'Ainda não participou de nenhuma pelada.' : 'Você ainda não participou de nenhuma pelada.'}</div>
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
