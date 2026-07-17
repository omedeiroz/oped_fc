# Handoff: Pelada OPED FC — Redesign "Noite de Jogo"

## Overview
Redesign de todas as telas do app Pelada OPED FC (React + Vite / Express / SQL Server), repositório `omedeiroz/oped_fc`. Direção escolhida: paleta escura editorial "Noite de Jogo" (preto + âmbar), tipografia grande, cards minimalistas — substitui o tema anterior "Verde Campo" (`frontend/src/theme.css`).

## About the Design Files
Os arquivos deste pacote são **referências de design feitas em HTML** (protótipo estático, sem lógica real) — mostram o visual e a estrutura pretendidos, não código para copiar direto. A tarefa é **recriar este design no código React já existente do projeto** (`frontend/src/`), reaproveitando os componentes, rotas e chamadas de API (`api.js`, `auth.jsx`) que já existem — só a camada visual (`theme.css` e o JSX das páginas) muda.

## Fidelity
**Alta fidelidade (hifi)**: cores, tipografia, espaçamento e hierarquia definidos e finais. Recrie pixel-a-pixel usando os componentes React existentes.

## Screens / Views
Todas em `frontend/src/pages/*.jsx` + `components/Layout.jsx`. Ver `design.html` (âncoras `#3a`–`#3f`) para o mockup de cada uma.

### 3a — Login/Cadastro (`pages/Login.jsx`)
- Split 2 colunas, sem cartão flutuante: painel esquerdo fixo `flex:1` com borda direita `1px solid #1c1c1a`, título "PELADA OPED FC" 56px/800 quebrado em 2 linhas, letter-spacing -0.03em; barra de destaque 56×6px `#ff6b35` abaixo; texto institucional 15px `#8a8578` max-width 340px; 3 estatísticas (peladas/gols/jogadores) em `Space Grotesk` 32px/800, gap 40px, acima delas.
- Painel direito largura fixa 420px, padding 64px 52px: toggle Entrar/Criar conta como texto com `border-bottom: 2px solid #ff6b35` no ativo (não é mais pill); campos como texto com `border-bottom: 2px solid #2a2a28` (sem caixa/fundo) — foco troca a borda para `#ff6b35`; botão "ENTRAR →" cheio, `background:#ff6b35`, texto `#0c0b09`, 800/15px, padding 15px, border-radius 4px (não mais pill de 12px).

### 3b — Ranking (`pages/Dashboard.jsx`)
- Header com título + 3 números-resumo à direita (sem cards de stat em caixa).
- Abas por sublinhado (`border-bottom:2px solid #ff6b35` na ativa), não mais "segmented" com fundo.
- Substituir pódio (3 cards) por: coluna esquerda fixa 340px com o artilheiro em destaque — número gigante 100px `Space Grotesk` cor `#ff6b35`, nome 22px abaixo, badges de contexto; coluna direita = lista (sem tabela/bordas de célula) com linhas `justify-content:space-between`, separador `1px solid #1c1c1a`, e mini-sparkline de barras (6 barras, 5px largura, cor `#3a3a37` / `#ff6b35` nas 2 últimas altas) à direita do nome, antes do número.

### 3c — Peladas (`pages/Peladas.jsx`)
- Banner de "próxima pelada" fixo no topo da lista: `background:#101214;border:1px solid #ff6b35`, ícone 🔔, CTA "Confirmar presença" (endpoint novo — ver Interações).
- Lista vira grid de 3 colunas de cards (`border:1px solid #2a2a28;border-radius:10px;padding:24px`), sem os `date-badge` circulares — data como "13 Jul" em 28px/800.
- Botão "+ Nova pelada" quadrado (`border-radius:4px`), não mais pill.

### 3d — Detalhe da pelada (`pages/PeladaDetalhe.jsx`)
- Novo bloco "placar": Time A **2 – 1** Time B centralizado, números 72px `Space Grotesk` (cor de destaque `#ff6b35` no time vencedor), nomes dos times ao lado.
- Novo bloco "MVP da pelada" (jogador com mais gols+assist. da pelada) abaixo do placar — pill com ícone 🏅.
- Grid de times mantém estrutura (2 colunas), estilizado com bordas `#2a2a28` e acento superior `#ff6b35` só no time vencedor.
- **Novo**: seção de comentários abaixo dos times — feed simples (nome + texto) + campo de texto com borda inferior + "Enviar". Requer nova tabela/endpoint (ver Estado/Dados).

### 3e — Nova/Editar pelada (`pages/PeladaForm.jsx`)
- Transformar o formulário de página única em **wizard de 4 etapas**: (1) Dados básicos, (2) Jogadores, (3) Sorteio/Times, (4) Revisão e salvar.
- Barra de progresso linear no topo (4 segmentos, preenchidos em `#ff6b35` até a etapa atual) substitui o stepper circular.
- Etapa "Jogadores": campo de busca (borda inferior, sem caixa) + chips dos selecionados + preview dos times ao lado (2 colunas) que atualiza ao sortear.
- Botões "← Voltar" / "Próximo →" fixos no rodapé de cada etapa; último passo mostra "Criar pelada" / "Salvar alterações" (comportamento igual ao atual `salvar()`).
- Toda a lógica de estado (`selecionados`, `times`, `sortearTimes`, `salvar`) do `PeladaForm.jsx` atual é reaproveitada — só a apresentação passa a ser paginada por etapa em vez de scroll único.

### 3f — Admin de usuários (`pages/AdminUsuarios.jsx`)
- Remove a tabela; lista linhas simples `justify-content:space-between`, separador `1px solid #1c1c1a`, nome 15px/700 + `@usuario` em `#5c5850` ao lado.
- Botão de ação vira texto "tornar admin →" em `#ff6b35` (sem borda/fundo); admin atual mostra tag quadrada `#ff6b35`/`#0c0b09` + "você" em `#5c5850`.

## Interactions & Behavior
- Mesmos handlers do código atual (`login`, `register`, `api.get/post/put/patch/del`) — só a superfície visual muda.
- Wizard (3e): navegação Voltar/Próximo é client-side (state `step`), sem submit intermediário; salvar só no último passo (igual hoje).
- Notificação "próxima pelada" (3c) e "Confirmar presença": **feature nova**, precisa de endpoint (ex.: `POST /peladas/:id/confirmar`) e coluna/tabela de presença confirmada — não existe hoje no schema.
- Comentários (3d): **feature nova**, precisa de tabela `PeladaComentarios` (PeladaId, UsuarioId, Texto, CriadoEm) + rotas `GET/POST /peladas/:id/comentarios`.
- Perfil individual do jogador com gráfico de evolução (explorado nas opções 1d/2b do canvas) — endpoint `GET /jogadores/:id/historico` (gols por pelada, últimas N) ainda não existe; ficou fora do turno final 3a–3f, avaliar se entra numa v2.
- Hover/active: em toda a superfície de texto-ação (login toggle, admin "tornar admin", tabs) usar `opacity:0.8` ou leve `color` shift no hover — não especificado pixel a pixel no mock estático, seguir o padrão do restante do app.

## State Management
- Sem mudanças de state necessárias além do wizard (`step`, 0–3) em `PeladaForm.jsx`.
- Novo state para "próxima pelada" no Dashboard/Peladas (fetch de `/peladas?futura=true` ou filtro client-side por `DataPelada > hoje`).
- Novo state para comentários por pelada (lista + input) em `PeladaDetalhe.jsx`.

## Design Tokens
```
--bg:        #050607
--surface:   #101214
--border:    #2a2a28
--border-dim:#1c1c1a
--texto:     #f5f2ec
--muted:     #8a8578
--muted-2:   #5c5850
--accent:    #ff6b35   /* laranja-âmbar — única cor de destaque do sistema */
--accent-on: #0c0b09   /* texto sobre fundo laranja */
--danger-txt:#ff9d7a
--danger-bd: #7a2b18

--radius: 4px       /* botões/tags — cantos quase retos, mais editorial que o tema anterior (18px) */
--radius-card: 10px  /* cards de conteúdo (peladas, times) */

--font:     'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif
--font-num: 'Space Grotesk', 'Inter', system-ui, sans-serif

Escala tipográfica: 11–12px (labels/uppercase) · 13–15px (corpo/UI) · 22–30px (títulos de seção) · 56–100px (números/heros em Space Grotesk)
```
Emojis (⚽🅰️🏆📅🔔🏅💬🥇🔥) são mantidos do app original — parte do vocabulário visual existente, não introduzidos por este redesign.

## Assets
Nenhum asset de imagem — só emoji nativo (já usado no app original) e formas geométricas simples (círculos de avatar, barras de sparkline). Fontes via Google Fonts: Inter (400/500/600/700/800) e Space Grotesk (500/600/700).

## Files
- `design.html` — cópia do protótipo de design completo (todas as opções exploradas + versão final 3a–3f). Âncoras `#3a` a `#3f` são a versão final; o resto do arquivo (`#1a`–`#2f`) mostra alternativas descartadas, útil só como referência de por que se chegou nesta direção.
- Código real a alterar: `frontend/src/theme.css`, `frontend/src/components/Layout.jsx`, `frontend/src/pages/*.jsx`.
- Novo (backend): rotas/tabelas para confirmação de presença e comentários (ver "Interactions & Behavior").
