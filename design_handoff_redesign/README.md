# Handoff: Pelada OPED FC — Redesign "Esportivo/Energético"

## Overview
Redesign de todas as telas do app Pelada OPED FC (React + Vite / Express / SQL Server), repositório `omedeiroz/oped_fc`. Direção escolhida: paleta esportiva/energética, tipografia condensada bold, formas diagonais — substitui tanto o tema antigo "Verde Campo" quanto a exploração descartada "Noite de Jogo". **Suporta light e dark theme com um botão de alternância** (light é o padrão).

## About the Design Files
`design.html` é um **protótipo estático de referência visual** — mostra âncoras `#2a` (light) e `#2b` (dark) com as 6 telas do fluxo. Não é código para copiar; a tarefa é **recriar no React existente** (`frontend/src/`), reaproveitando componentes/rotas/API atuais — só a camada visual (`theme.css`, JSX das páginas, `Layout.jsx`) muda.

## Fidelity
Alta fidelidade: cores, tipografia, espaçamento e hierarquia definidos e finais.

## Screens / Views
Ver `design.html` âncoras `#2a` (light) / `#2b` (dark).

### Login/Cadastro (`pages/Login.jsx`)
Header com clip-path diagonal (`clip-path:polygon(0 0,100% 0,100% 88%,0 100%)`) em `--surface`, título "PELADA OPED FC" 20px/900 `Barlow Condensed` 2 linhas + barra `36×4px` `--accent-orange`. Toggle Entrar/Criar como texto com `border-bottom:2px solid var(--accent-orange)` no ativo. Campos com borda inferior (sem caixa). Botão "Entrar →" cheio, `--accent-orange`, `border-radius:8px`. 3 estatísticas (peladas/gols/jogadores) em `Barlow Condensed` 900 na base do painel.

### Ranking (`pages/Dashboard.jsx`)
Header diagonal igual ao login, título "RANKING" + sub "Temporada 2026". Lista de jogadores como linhas em cards `--surface`/branco arredondados (`border-radius:8px`), avatar circular com iniciais, posição em `Barlow Condensed` colorida (1º = laranja), nome + pontos à direita. 3º lugar (ou "Você") destacado com borda `--accent-lime`.

### Peladas (`pages/Peladas.jsx`)
Banner "próxima pelada" fixo no topo: diagonal, `--surface`, ícone 🔔, texto data/hora, borda `--accent-lime` (dark) / sem borda (light). Botão "Confirmar presença" cheio `--accent-lime`. Lista de peladas em cards (`border:1px solid`, `border-radius:10px`) com data grande (`22px/900 Barlow Condensed`, cor laranja) + local + confirmados. Botão "+ Nova pelada" outline quadrado.

### Detalhe da pelada (`pages/PeladaDetalhe.jsx`)
Header diagonal em `--accent-lime` (light) / `--surface` com borda inferior lime (dark). Bloco placar: "Time A **2 – 1** Time B" centralizado, número 30px/900 `Barlow Condensed` cor laranja. Pill "🏅 MVP: [nome]" em `--accent-lime`. Seção comentários: feed simples (nome + texto) em card, campo de texto com borda inferior.

### Nova/Editar pelada (`pages/PeladaForm.jsx`)
Wizard 4 etapas, barra de progresso linear (4 segmentos, preenchidos em `--accent-lime` até a etapa atual) + label "Etapa N de 4 · [nome]". Etapa Jogadores: busca (borda inferior) + chips lime dos selecionados + preview 2 colunas dos times. Botões fixos no rodapé: "← Voltar" outline / "Próximo →" cheio laranja (último passo: "Criar pelada"/"Salvar alterações"). Estado (`selecionados`, `times`, `sortearTimes`, `salvar`) do `PeladaForm.jsx` atual é reaproveitado — só pagina por etapa.

### Admin de usuários (`pages/AdminUsuarios.jsx`)
Lista de linhas simples, separador 1px, nome 12px/700 + `@usuario` em cor muted. Admin atual: tag quadrada laranja "ADMIN" + "você" em muted. Outros: texto-ação "tornar admin →" em lime.

## Theme Toggle (novo)
- Um botão no `Layout.jsx` (header/nav) alterna light ⇄ dark. Ícone sugerido: ☀️/🌙 ou texto "Modo escuro".
- Implementar via atributo `data-theme="light"|"dark"` na raiz (`<html>` ou wrapper do app) + variáveis CSS (ver tokens abaixo) trocadas por seletor `[data-theme="dark"] { --bg: ...; }`.
- Persistir escolha em `localStorage` (`theme` key); ler no boot antes do primeiro paint pra evitar flash.
- Sem novo endpoint — é puramente client-side/visual.

## Interactions & Behavior
- Mesmos handlers do código atual (`login`, `register`, `api.get/post/put/patch/del`) — só a superfície visual muda.
- Wizard: navegação Voltar/Próximo client-side (state `step`), submit só no último passo.
- "Confirmar presença" (Peladas): feature nova — `POST /peladas/:id/confirmar` + coluna/tabela de presença confirmada (não existe hoje no schema).
- Comentários (Detalhe): feature nova — tabela `PeladaComentarios` (PeladaId, UsuarioId, Texto, CriadoEm) + rotas `GET/POST /peladas/:id/comentarios`.
- MVP da pelada: campo calculado (mais gols+assistências na partida) — pode ser client-side a partir dos dados já existentes de jogadores/pelada, sem endpoint novo.
- Perfil individual com gráfico de evolução: fora do escopo deste handoff (avaliar v2) — endpoint `GET /jogadores/:id/historico` ainda não existe.
- Hover/active em texto-ação (toggle login, "tornar admin", tabs): `opacity:0.8` ou leve shift de cor.

## State Management
- Novo state global/leve: `theme` ('light'|'dark'), lido/persistido via `localStorage`.
- Wizard: `step` (0–3) em `PeladaForm.jsx`.
- "Próxima pelada": fetch/filtro client-side por `DataPelada > hoje` no Dashboard/Peladas.
- Comentários: lista + input por pelada em `PeladaDetalhe.jsx`.

## Design Tokens

```css
/* Light (padrão) */
--bg:            #F4F7F0
--surface:       #FFFFFF
--surface-dark:  #0B1F3A   /* headers diagonais, navbar */
--border:        #DDDDDD
--text:          #111111
--muted:         #888888
--accent-orange: #FF5A1F   /* CTA principal */
--accent-lime:   #3DDC6B   /* sucesso/destaque secundário */
--accent-on:     #0B1F3A   /* texto sobre laranja/lime quando necessário contraste */

/* Dark */
--bg:            #0A1420
--surface:       #10203A
--surface-dark:  #122036
--border:        #223349
--text:          #F4F7F0
--muted:         #6C7D92
--accent-orange: #FF7A45
--accent-lime:   #4AEE85
--accent-on:     #0A1420

--radius: 8px          /* botões */
--radius-card: 10px    /* cards de conteúdo */
--radius-pill: 20px    /* chips, tags, pills */

--font:     'Barlow', system-ui, -apple-system, sans-serif
--font-num: 'Barlow Condensed', 'Barlow', system-ui, sans-serif  /* pesos 700/900, headlines e números */
```
Escala: 8–10px (micro-labels) · 11–13px (corpo/UI) · 16–20px (títulos de seção) · 22–30px (headlines/números destaque, `Barlow Condensed`).
Formas: headers com `clip-path` diagonal (`polygon(0 0,100% 0,100% 88%,0 100%)`) como assinatura visual recorrente.
Emojis (🔔🏅🔥) mantidos do vocabulário visual existente.

## Assets
Sem imagens — emoji nativo, avatares como círculos com iniciais, formas geométricas (diagonais, pills). Fontes via Google Fonts: Barlow (400/600/700) e Barlow Condensed (700/900).

## Files
- `design.html` — protótipo com as 3 direções exploradas (`#1a`–`#1c`) e o fluxo completo final em light/dark (`#2a`/`#2b`). `#2a`/`#2b` são a versão final.
- Código real a alterar: `frontend/src/theme.css`, `frontend/src/components/Layout.jsx` (+ botão de toggle), `frontend/src/pages/*.jsx`.
- Novo (backend): rotas/tabelas para confirmação de presença e comentários (ver "Interactions & Behavior").
