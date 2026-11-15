# Bancada de Instrumentação: memória do projeto

> Leia este arquivo antes de mexer no projeto. Ele resume o que foi construído, as decisões tomadas e o plano de continuação. Atualize-o ao final de cada sessão de trabalho.

## 1. O que é

App web didático para as aulas de **Instrumentação** do curso técnico de **Eletromecânica**, unidade "Implementação de Equipamentos e Dispositivos".
- **Autor e dono:** Ederson, professor.
- **Base pedagógica:** os slides `bloco1.pptx` da Aula 01:
  - Bloco 1: controlar é comparar (malha × intertravamento);
  - Bloco 2: sinal 4–20 mA;
  - Bloco 3: tags ISA e a bancada.
- **Uso:** em sala, projetado, e pelos alunos.
- **Funcionamento:** offline, abrindo o HTML com dois cliques (Chrome/Edge).
- **Link publicado (privado, compartilhar pelo menu Share):** https://claude.ai/artifact/JWPR6417D5qq23xkttKEt9
  Para atualizar, republique o mesmo artifact (passe a URL como `url` na ferramenta Artifact).

## 00. Rotina obrigatória de início e fim (vale para qualquer pessoa ou IA)

**Ao iniciar (antes de qualquer pedido, mesmo pequeno):**
1. Ler este CLAUDE.md inteiro.
2. Comparar a cópia local com o GitHub: `git fetch origin` e depois `git status` / `git log HEAD..origin/main --oneline`.
3. Se o GitHub tiver versão mais nova, **baixar antes de editar** (`git pull`) e avisar quem está trabalhando o que mudou (ver histórico na seção 7).
4. Se não houver pasta local com git, clonar: `git clone https://github.com/LucasVitalBR/bancada-instrumentacao` (fora do Google Drive).

**Ao finalizar a edição do dia:**
1. Atualizar este CLAUDE.md (regra 0.1).
2. `git add -A`, `git commit -m "o que mudou"`, `git push`.

**Se a pessoa esquecer**, a IA deve lembrar: no início, de baixar/comparar com o GitHub; no fim, de enviar para o GitHub. Não encerrar uma sessão com alterações sem commit/push sem avisar.

## 0. Situação atual (ler primeiro)

- **Versão:** BUILD `20261115-21` (15/11/2026).
- **Última etapa feita:** **inversor PowerFlex 525** no painel, com IHM interativa, checklist de parâmetros e seletora de partida da bomba DIRETA/INVERSOR (BUILD -14, fases 1 e 2 do roteiro do inversor). Antes: líquido da bancada em rosa claro, igual ao fluido da bancada física (BUILD -13). Antes: régua do tanque de acrílico em % (BUILD -12). Antes: ícone do site (favicon de manômetro + sinal 4–20 mA, BUILD -11). Antes: eletrodutos do TQ-01 ligados aos prensa-cabos dos instrumentos (BUILD -10). Antes: item 2 do plano (endereços e escalas do DVP20SX2 conferidos no manual; saída D1116 corrigida para 0..4000; D1115 = K7967 no 1º scan).
- **Próxima etapa sugerida:** fases 3 e 4 do inversor (ver 6.1), ou os itens 4 (PID), 6 (exportar/importar ladder) e 7 (modo avaliação) do plano; itens 1 e 3 dependem de fotos/slides.
- **Repositório oficial:** GitHub `LucasVitalBR/bancada-instrumentacao` (**público desde 15/11**), ver 1.2. Lucas e colega trabalham por pull/push.
- **Site:** https://bancada-instrumentacao.vercel.app (atualiza a cada push).
- **Drive:** não é mais usado (desde 14/11 só GitHub; ver 1.1).


## 0.00 Como nós dois trabalhamos (resumo, 15/11)

- **Editar:** os dois editam pelo **GitHub** (repositório `LucasVitalBR/bancada-instrumentacao`, público desde 15/11). Cada um trabalha na sua pasta clonada: `git pull` antes de começar e `git push` ao terminar, seguindo a rotina 00. Assim os dois mexem no mesmo projeto e o git junta as mudanças.
- **Ver o resultado:** os links dos sites (`bancada-instrumentacao.pages.dev` e `bancada-instrumentacao.vercel.app`) **só mostram o app**; não dão para editar. Servem para abrir em sala e mandar para os alunos.
- **Publicar no Cloudflare (site novo):** hoje só sai do PC do Ederson (ver 0.0). Para os dois publicarem, escolher uma opção:
  1. **(Recomendado) Lucas libera o repositório para o Cloudflare.** No GitHub dele: Settings → Applications → "Cloudflare Workers and Pages" → Configure, com acesso a `bancada-instrumentacao`. Depois o Ederson liga o projeto ao repositório no painel do Cloudflare (Settings → Builds → Connect to Git). A partir daí, **qualquer push de qualquer um dos dois publica sozinho** e não é mais preciso publicar na mão.
  2. O Ederson convida o Lucas como membro da conta Cloudflare dele (Manage account → Members). Aí o Lucas também pode publicar na mão, com o mesmo comando do wrangler.

### PENDENTE PARA O LUCAS (combinado com o Ederson em 15/11, manhã)

1. **Autorizar o Cloudflare no GitHub** (a autorização é no **GitHub**, não no Vercel):
   - Abrir https://github.com/apps/cloudflare-workers-and-pages → Install/Configure na conta `LucasVitalBR`.
   - Em "Repository access", liberar `bancada-instrumentacao`.
   - Avisar o Ederson. O Claude dele liga o projeto `bancada-instrumentacao` do Cloudflare (conta do Ederson) ao repositório.
2. **Depois que o Cloudflare publicar sozinho**, o **Vercel deixa de ser necessário.** Decisão do Ederson: ficar só com o Cloudflare (`https://bancada-instrumentacao.pages.dev`). Então:
   - excluir ou pausar o projeto no Vercel, o que também fecha o `CLAUDE.md` exposto em `vercel.app/CLAUDE.md`;
   - apagar `.github/workflows/vercel-deploy.yml` e o segredo `VERCEL_DEPLOY_HOOK`;
   - trocar neste arquivo as menções ao site do Vercel pelo do Cloudflare.
3. **Fechar o compartilhamento da pasta do Drive** ("qualquer pessoa com o link = Editor"). O Drive não é mais usado.

**Fluxo final esperado:** Ederson ou Lucas editam pelo Claude → push no GitHub → o Cloudflare publica sozinho → todos veem o mesmo link.

## 0.0 Publicação do site (LEIA, Lucas)

**Atualização 15/11, tarde:** o Lucas deixou o repositório **público**. No plano Hobby do Vercel, o bloqueio dos envios de quem não é dono só vale para repositório privado: agora os envios do Ederson devem publicar sozinhos no Vercel. Teste feito com o envio deste CLAUDE.md (ver histórico). Com isso, ficam disponíveis os dois sites:
- **Vercel:** https://bancada-instrumentacao.vercel.app (automático para os dois);
- **Cloudflare:** https://bancada-instrumentacao.pages.dev (publicado à mão do PC do Ederson).
**Decisão (Ederson, 15/11): o site oficial é o Vercel.** Todo push no `main`, de qualquer um dos dois, publica sozinho. O Cloudflare **não é mais atualizado** e ficou parado na BUILD -21; pode ser excluído do painel do Cloudflare quando o Ederson quiser.
**Lucas:** como o repositório é público, a automação `.github/workflows/vercel-deploy.yml` (Deploy Hook) virou redundante, porque o Vercel já publica os envios de todos. Pode apagar o arquivo e o segredo `VERCEL_DEPLOY_HOOK`. **Segurança com o repositório público:**
- o histórico do git ainda contém o link antigo da pasta do Drive (editável por qualquer um com o link): **fechar o compartilhamento da pasta**;
- os commits mostram o e-mail de quem enviou.

**Desde 15/11/2026 há um segundo site, no Cloudflare Pages da conta do Ederson:** https://bancada-instrumentacao.pages.dev (BUILD -13 no ar, com o líquido rosa e a régua em %).

**Por quê:** o Vercel (conta do Lucas, plano Hobby, repositório privado) não publica os envios do Ederson. A automação do Deploy Hook rodou na -13, o hook respondeu `PENDING`, mas nada entrou no ar e o site ficou na -12. O Ederson não quis tornar o repositório público. A ligação do Cloudflare ao GitHub também não deu, porque o repositório é do Lucas e só ele pode liberar.

**Como o site do Cloudflare é atualizado hoje (manual, a partir do PC do Ederson):**
1. `git pull` na pasta do clone.
2. Exportar só os arquivos do site para uma pasta temporária: `git archive HEAD | tar -x -C <pasta>`. Depois apagar dela `.github`, `.gitignore`, `CLAUDE.md`, `README.md` e o prompt .md, que não devem ir para um site aberto.
3. `npx wrangler@4 pages deploy <pasta> --project-name bancada-instrumentacao --branch main --commit-dirty=true`. Não usar `--force`: ele só foi necessário para criar o projeto.
O login do wrangler fica salvo no PC do Ederson.

**Para ficar automático para os dois (quando o Lucas puder):** no GitHub do Lucas, instalar o app "Cloudflare Workers and Pages" liberando o repositório `bancada-instrumentacao`. Depois, ligar o projeto do Cloudflare ao repositório (Settings → Builds → Connect), com framework None, build vazio e saída `/`. Aí todo push publica sozinho. A outra saída é tornar o repositório público, o que deixa o Vercel publicar tudo.

**Atenção, segurança:** o Vercel publica o repositório inteiro, então https://bancada-instrumentacao.vercel.app/CLAUDE.md está aberto a qualquer pessoa. Isso inclui o link da pasta do Drive, que está como "qualquer pessoa com o link = Editor". Sugestão: fechar o compartilhamento do Drive e/ou bloquear os .md no Vercel (`vercel.json` ou `.vercelignore`). O site do Cloudflare não publica os .md.

## 0.1 Regra fixa: manter este arquivo atualizado

- **A cada modificação no projeto, reescrever este CLAUDE.md antes de encerrar**, para quem abrir o projeto (Lucas ou o colega) saber em que etapa estamos:
  1. atualizar a seção **0. Situação atual** (versão/BUILD, última etapa feita, próxima etapa);
  2. marcar o que foi concluído no **plano de continuação**;
  3. acrescentar uma linha no **histórico** (data, BUILD, o que mudou e quem pediu);
  4. ajustar as demais seções se algo mudou (arquivos, convenções, mapa de E/S).
- Depois de atualizar, fazer **commit + push no GitHub** (regra 1.2). Não salvar no Drive.
- Esta regra vale para qualquer pessoa ou IA que trabalhe no projeto.

## 1.1 Google Drive (desativado)

- **Desde 14/11/2026 (decisão do Ederson) as atualizações vão só para o GitHub.** Não enviar mais nada para a pasta do Drive "Bancada de Instrumentação - App" (link retirado deste arquivo porque o repositório é público), que ficou parada na BUILD -10, com cópias antigas renomeadas `.v9`.
- Motivo: o conector do Drive não substitui arquivos (só cria novos), o que gerava duplicados.

## 1.2 GitHub (repositório oficial)

- Repositório: https://github.com/LucasVitalBR/bancada-instrumentacao (**público** desde 15/11, ramo `main`). Qualquer pessoa pode ver e baixar; só os colaboradores enviam. Colega entra como **collaborator**.
- **Antes de começar:** `git pull` (traz o que o outro enviou).
- **Ao terminar:** atualizar este CLAUDE.md (regra 0.1), `git add -A`, `git commit -m "o que mudou"`, `git push`. Se o push for recusado, fazer `git pull`, resolver conflitos e enviar de novo.
- A pasta de trabalho fica **fora do Google Drive** (o Drive corrompe a pasta `.git`).
- **O que NÃO vai para o GitHub** (bloqueado no `.gitignore`; manter esta lista igual ao arquivo):
  - `senaiscormhub_*/` e `*.zip`: pacote SCORM do SENAI com **token de acesso**;
  - `bloco1.pptx` e `*.pptx`: material do SENAI e arquivo grande (18 MB);
  - `backup-*/` e `*.vN.js`: backups locais (o histórico do git já guarda as versões);
  - `.claude/`, `node_modules/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`: arquivos de ferramenta/sistema.
- Antes de enviar, conferir com `git status` que nada dessa lista aparece.
- **Envios do colega no Vercel:** no plano Hobby com repositório privado, o Vercel marca como "Blocked" os envios de quem não é dono do projeto. Tentativa de solução (ainda falhando em 14/11, ver seção 0.0): `.github/workflows/vercel-deploy.yml`: a cada envio no `main` feito por outra pessoa, o GitHub Actions chama o Deploy Hook do Vercel (`github-push`, ramo `main`), guardado no segredo `VERCEL_DEPLOY_HOOK`. Para publicar na mão: aba Actions → "Publicar no Vercel" → Run workflow.
- **Site no ar (Vercel):** https://bancada-instrumentacao.vercel.app — projeto `bancada-instrumentacao` na conta Vercel do Lucas (Hobby), preset "Other", sem build. **Cada push do Lucas no `main` publica sozinho** em ~30 s; os do Ederson não; por isso existe o site do Cloudflare (ver 0.0). Depois de publicar, Ctrl+F5 no navegador.

## 2. Arquivos (sempre juntos na mesma pasta)

| Arquivo | Papel |
|---|---|
| `index.html` | Página principal: abas, telas 2D, CSS, carregamento sob demanda do 3D e do CLP, tela cheia, painel lateral do CLP, janela de ligação do PT100 |
| `app-3d.js` | Cena 3D (Three.js): sala, TQ-01, tanque de acrílico, bomba, tubulação, instrumentos, montagem, simulação física, animações, câmera e colisão. Expõe `window.App3D` |
| `app-clp.js` | CLP Delta DVP20SX2 simulado: editor de ladder, varredura, validação, programas-padrão e painel de operação. Expõe `window.PLC` |
| `app-pf525.js` | Inversor Allen-Bradley PowerFlex 525 (25B-B5P0N104): parâmetros, IHM (display de 7 segmentos e teclas), simulação do acionamento, desenho da frente 3D, checklist de atividades e seletora de partida DIRETA/INVERSOR. Expõe `window.PF525`. Carregado entre `app-clp.js` e `app-3d.js` |
| `vendor/pf525-img.js` | Foto da frente do inversor em JPEG embutido (data URI, ~72 KB), em `window.PF525_IMG`. Vem de uma imagem do ChatGPT enviada pelo Ederson, recortada para 400 × 885. Embutida para não “contaminar” o canvas do WebGL quando o HTML é aberto direto do disco |
| `vendor/three-bundle.js` | Three.js 0.170 + OrbitControls, CSS2DRenderer, RoomEnvironment, EffectComposer, RenderPass, OutputPass, GTAOPass, **UnrealBloomPass e SMAAPass** (desde a BUILD -21), empacotados em IIFE com esbuild (`window.THREE`) |
| `favicon.svg`, `favicon.ico`, `icons/*.png`, `site.webmanifest` | Ícone do site (manômetro azul/laranja + onda 4–20 mA). PNGs gerados do SVG com `rsvg-convert`; o .ico tem 16/32/48 px. Se mudar o SVG, gerar de novo os PNGs e o .ico |
| `prompt-chatgpt-bancada-nivel-temperatura.md` | Prompt para refazer uma versão só de nível + temperatura no ChatGPT (não inclui as mudanças posteriores) |
| `bloco1.pptx` | Slides da Aula 01 (fonte do conteúdo) |

**NÃO compartilhar:**
- `senaiscormhub_636ba3e9bc34d/` e o `.zip`: pacote SCORM do SENAI com **token de acesso**. Também não usar modelos/ícones do SCORM; servem só de referência visual.
- `.claude/`: só para o servidor de testes local.

**Outro projeto, não confundir:** a pasta `Aulas instrumentação APP\senaiscormhub_636ba3e9bc34d\` (sem "- Copia") tem `index.html`/`app-3d.js`/`app-clp.js` de uma **reconstrução que o Ederson está fazendo com o ChatGPT**. Não editar sem ele pedir.

## 3. Como rodar e testar

- **Uso normal:** abrir `index.html` no Chrome/Edge. Depois de atualizar arquivos, **Ctrl+F5**.
- **Teste com Claude Code:** o painel do navegador abre arquivos locais como cópia estática (não carrega os scripts ao lado). Use um servidor:
  - `.claude/launch.json` → `node <scratchpad>/serve.js "<pasta>" 8765`;
  - `serve.js` é um servidor estático mínimo; recriar se o scratchpad for outro.
- **Ganchos de teste no console:**
  - `App3D.autoInstall()`, `App3D._tick(dt)` (avança a simulação sem animar), `App3D._anim(dt)`, `App3D._clamp()`, `App3D._state`;
  - `PLC.examples`, `PLC.setRun(true)`, `PLC.io`.
- **Cuidado ao testar:** o painel do navegador fica oculto e o `requestAnimationFrame` pausa. Use `_tick` e `renderer.render` manual (ou `composer.render()`) para capturas; a captura sai com um quadro de atraso.
- **Republicar:** gerar a cópia sem `<!doctype>/<html>/<head>/<body>` e sem `?v=BUILD` nos `loadScript`, e publicar com `files` = `app-3d.js`, `app-clp.js` e `vendor/three-bundle.js`.

## 4. Convenções importantes

- **`const BUILD = "20261115-21"`** no HTML: **incrementar a cada versão**. Ele é usado como `?v=` nos scripts para o navegador não usar cache antigo (já causou a "solenoide sumida").
- **Three.js:** `object.position` é somente leitura. Use o helper `at(obj, pos, scale)`, nunca `Object.assign(mesh, {position})`.
- **GTAOPass (oclusão ambiente):** deixa sprites/transparentes **pretos**. `overrideVisibility()` foi sobrescrito para esconder `isSprite` e `material.transparent` no G-buffer.
- **Gráficos (desde a BUILD -21): três níveis no botão ✨ Gráficos** (`S.setQuality`, salvo em `localStorage` `gfx3d` só quando a escolha é manual):
  - **Alto:** GTAO + brilho + MSAA 4×, até 2× de resolução;
  - **Médio:** sem GTAO, até 1,5×;
  - **Leve:** sem composer, até 1,25×.
  - Abaixo de 24 fps por 4 s, desce um nível sozinho, sem salvar.
  - Para recompilar o bundle: `entry.js` + `npx esbuild entry.js --bundle --minify --format=iife`, na pasta three-build do scratchpad (precisa de `npm i three@0.170.0 esbuild`).
- **Janelas do navegador:** não usar `confirm/alert/prompt` (não funcionam no link publicado). Use `armed()` em `app-clp.js`: o primeiro clique pede "Clique de novo para confirmar".
- **localStorage**, sempre com try/catch:
  - `clp-sx2-programa-v1` (programa);
  - `hud3d` (painel escuro visível);
  - `menu3d` (menu lateral recolhido).
- **Edições grandes:** foram feitas com scripts Node de substituição exata (`patch-*.js` no scratchpad) e backup antes (`app-3d.vN.js`). Validar com `node --check`. Para o HTML, extrair os `<script>` inline e checar.
- **Cores de tubulação (NBR 6493):** água de processo verde, ar comprimido azul, eletroduto cinza-escuro, vapor/respiro branco.
- **Cor do fluido (bancada física usa líquido rosa, tom mais escuro desde a BUILD -17):**
  - água do tanque `0xDE6FA3` (opacidade 0,64) e superfície `0xD4639A`;
  - jato e dreno `0xE07FAD`: a textura `texStreak` tem base branca, para não puxar para o azul;
  - bolhas `0xF8D6E6`;
  - setas de fluxo nos canos rosa, `rgba(240,130,185)` em `texArrow`;
  - no 2D, `--water:#E48DB6`. A tubulação continua verde (NBR 6493: água de processo); só o líquido visível é rosa.
- **Identidade visual:** azul `#1E3A5F`, laranja `#E87722`, fundo `#EEF2F7`; fonte Calibri; tags em Courier New.

## 5. O que existe hoje

### Abas 2D (Blocos 1–3)
Planta da bancada (SVG), Controlar é comparar (forno com TSH), Malha ou intertravamento (quiz), Laço 4–20 mA, Ligação do PT100 (montagem de fios + 2/3/4 fios), Conversões (calculadora + treino) e Tags (decifrar, montar, achar na planta).

### Bancada 3D
- **Sala:** remodelada a partir de foto do laboratório: granitina, janelas de caixilho azul, forro com LEDs, armários cinza-claro, bancada didática, cone, carrinho.
- **Equipamentos:**
  - TQ-01 (inox) com respiro;
  - tanque de acrílico com tampa, dreno e régua de nível em % (0–100 %, traço a cada 5 %, 50 % em laranja);
  - bomba centrífuga completa (motor, protetor de acoplamento amarelo, voluta, skid);
  - rotâmetro vermelho;
  - 4 válvulas manuais de volante amarelo;
  - eletrocalha suspensa (painel → TQ-01 e, desde a BUILD -20, até a linha em x 2,55, z −1,2) e eletrodutos até **todos** os instrumentos elétricos: TQ-01, LIT/LSH/LSL-101, FIT-102, FY-102, VY-01 e motor da bomba. O botão **"🔌 Eletrodutos"** no menu mostra ou esconde os eletrodutos (`S.showCond`, salvo em `localStorage` `cond3d`);
  - painel com CLP DVP20SX2 (LEDs ao vivo, bornes verdes).
- **Montagem (Bancada de Peças):** 13 instrumentos + termopar que sobra, áreas de encaixe e dicas de erro pelas tags. Botão "⚡ Montar tudo automaticamente".
  - **TQ-01:** TE-104, TT-104, PIT-103, PSH-103, TSH-104, PG.
  - **Linha:** LIT-101 (item didático, não existe na bancada real), LSH-101, LSL-101, FIT-102, FV-102 (atuador azul, ENTRADA/SAÍDA), FY-102 (OUT1/IN/OUT2, tubos azuis), VY-01.
- **Interface:**
  - barra lateral recolhível (Ações/Vistas);
  - painel escuro ocultável;
  - rótulos compactos/completos/ocultos sem sobreposição;
  - tela cheia com painel do CLP à esquerda;
  - janela de ligação do PT100 em tela cheia;
  - colisão de câmera.
- **Animações:** ondas na água, jato, bolhas, dreno, setas de fluxo nos canos, motor girando, rotâmetro, boias, pulso do ultrassom do LIT, vapor, visão térmica.

### Inversor PowerFlex 525 (BUILD -14)
- **Modelo:** Allen-Bradley **25B-B5P0N104** (PF525, 240 V trifásico, 5,0 A, 0,75 kW / 1 HP, carcaça A, IP20, sem filtro). Manual: **520-UM001** (set/2025), PDF só na pasta antiga do Ederson, sem ir ao GitHub (material da Rockwell). Páginas usadas: 14 (código), 42–46 (bornes), 61–63 (IHM), 65–66 (Basic Program), 78–80 (Basic Display), 90–92 (t062–t064), 161–163 (falhas).
- **No 3D:** inversor ao lado do K1 no painel; a frente 3D mostra o display ao vivo.
  - Clicar nele (ou em "🎛 Inversor PF525" no menu, "Abrir o inversor" no painel escuro ou na vista "Inversor") aproxima a câmera e abre o **painel lateral do inversor** (`#vfdDock`, classe `vdock` no `#box3d`). O painel traz Próxima tecla, passo a passo, display em texto, estado, potenciômetro, seletora e checklist.
  - **Com o painel aberto, as teclas do inversor 3D são clicáveis:** o UV do clique vai para `PF525.pressAt(u, v)` e as posições ficam em `KEYPOS`.
  - O botão "IHM ampliada" abre a janela grande antiga (`openVfdBig`), útil em tela pequena.
  - O menu da cena recolhe sozinho ao abrir o painel.
- **Seletora "PARTIDA DA BOMBA" (porta do painel, painel escuro e janela do inversor):**
  - **DIRETA:** o contator K1 liga o motor em 60 Hz, sem rampa (comportamento antigo);
  - **INVERSOR:** a rotação do motor vem do PF525, com rampa, e a vazão é proporcional à rotação (lei de afinidade). Em reverso, a bomba centrífuga entrega 25 %.
  - Fica salva em `localStorage` (`partida-bomba`).
- **IHM fiel ao manual (pág. 63):**
  - Esc volta níveis: valor → nº do parâmetro → letra do grupo. ▲▼ navegam. Enter/Sel entram.
  - Edição dígito a dígito, com "PROGRAM" aceso: Sel troca o dígito, Enter salva, Esc cancela.
  - Parâmetros com símbolo de Stop no manual recusam a alteração com o motor girando (mostra "StoP").
  - Start, Stop (também limpa falha), Reverse e potenciômetro (arrastar ou roda do mouse) funcionam.
- **Grupos simulados:**
  - b (b001–b009, b012, b013);
  - P (P030–P053);
  - t (t062–t068);
  - A (A544);
  - M (Modified).
  - Os padrões são os do modelo: P031 = 230 V, P033/P034 = 5,0 A, P036 = 1750 rpm, P041/P042 = 10 s, P044 = 60 Hz, P046 = 1, P047 = 1, t062 = 48.
  - Os valores ficam salvos em `localStorage` (`pf525-params-v1`).
- **Simulação:**
  - rampas em tempo real (não aceleradas);
  - parada por rampa ou inércia (P045);
  - corrente ≈ FLA·(0,32 + 0,6·n³) + extra na aceleração;
  - tensão V/Hz;
  - b012 no formato do manual (ex.: 062 = bornes + 4–20 mA);
  - **F007 Motor Overload** quando a corrente passa do P033 por um tempo;
  - **F048 Params Defaulted** após P053 = 1/2;
  - autotune (P040) simplificado.
- **Partida pelos bornes:** P046 = 2 e t062 = 48 (2-Wire FWD). O Y0 do CLP (ou o botão local) fecha o borne 02. t064 = 0 é por borda, 1 por nível. Velocidade pelo CLP: P047 = 6 e `MOV K... D1117`.
- **Checklist (janela do inversor), conferido no valor gravado:**
  - Atividade 1 · Partida pela IHM, com dados de placa de **exemplo** (220 V, 60 Hz, 3,0 A, 4 polos, 1720 rpm: conferir a placa real), rampas 5 s, P046 = 1, P047 = 1, partir e levar a 45 Hz, parar.
  - Atividade 2 · Partida pelo CLP, 2 fios: P046 = 2, t062 = 48, t064 = 0, P047 = 1 ou 6, ligar pelo Y0.
- **Testado em 15/11:**
  - direta: 18 L/min;
  - IHM: 5 s de rampa, 45 Hz, 2,87 A, 13,5 L/min;
  - CLP: D1117 = 2000 → 30 Hz, 9 L/min, b012 = 062;
  - F007 com P033 = 0,5 A → X7 = 1, e o Stop limpa.

### CLP (aba "Programar CLP" e painel na tela cheia)
- **Instruções:** NA, NF, ↑P (LDP), OUT, SET, RST, CMP, MOV, ADD, SUB, MUL, DIV. Até 6 contatos + 1 linha paralela por rede, comentários por rede.
- **Monitoramento:** ao vivo, com unidades de engenharia.
- **Mapa de E/S** (endereços e escalas analógicas **conferidos no manual do DVP-SX2** em 13/11; mapa digital X/Y é escolha didática, conferir com a fiação real):

| Endereço | Ligação | Escala |
|---|---|---|
| X0 / X1 | LSL-101 / LSH-101 | 1 = atuado |
| X2 / X3 / X4 | LIGA (NA) / DESLIGA (NF) / seletora AUTO | |
| X5 / X6 | TSH-104 / PSH-103 | |
| X7 | falha do inversor PF525 (relé R1, padrão “Fault”) | 1 = em falha |
| Y0 / Y1 / Y2 / Y3 / Y4 | bomba / VY-01 / alarme / sinaleiro / resistência TZ-104 | |
| D1110 | AI CH0 LIT-101 | 2000 = 100 % |
| D1111 | AI CH1 TT-104 | 10 contagens = 1 °C |
| D1112 | AI CH2 FIT-102 | 2000 = 30 L/min |
| D1113 | AI CH3 PIT-103 | 2000 = 6 bar |
| D1116 | AO CH0 → FY-102 | **4000 = 100 %** (AO 4–20 mA = 0..4000) |
| D1117 | AO CH1 → inversor PF525, borne 15 (4–20 mA), usado com P047 = 6 | 4000 = 100 % da faixa P043–P044 |
| D1115 | modo das E/S analógicas | **H1F1F (K7967)** = AD0–AD3 e DA0 em 4–20 mA; gravado no 1º scan (M1002) |
| D1062 / D1118 | nº de amostras da média (padrão 2) / tempo de amostragem (2 ms) | não simulados |
| D200 / D210 / D211 | SP temperatura / nível liga / nível desliga (painel) | |
| D220 / D222 | SP vazão / abertura pedida da FV (painel) | D220: 2000 = 30 L/min · D222: 4000 = 100 % |
| M1000 / M1002 / M1011–M1013 | sempre ON / 1º scan / clocks 10 ms–100 ms–1 s | |

- **Programas-padrão:** nível, temperatura, vazão P (Kp = 2, bias 50%, mostra erro de regime), vazão flutuante (↑M1012), válvula proporcional (posicionamento), pressão (alarme 2,0 bar, PSH 2,2 bar), bancada completa, partida com selo.
- **Simulação:**
  - temperatura on/off: TSH 90 °C; P = (T−25)×0,035 bar;
  - nível ~300 L;
  - FV-102 com curso de ~1,5 s;
  - sem proteção no programa, o tanque **transborda** (didático).

## 6. Plano de continuação (próximos passos sugeridos)

1. **Fotos da bancada real:** quando o Ederson mandar, redesenhar os instrumentos fiéis aos modelos reais (PT100/Novus, Smar, pressostato, boias, solenoide, rotâmetro, painel).
2. ~~Confirmar endereços e escalas do DVP20SX2~~ **feito (BUILD -9).** Fonte: ficha técnica oficial DVP-SX2 (Delta) e manual de programação ES2/EX2/SS2/SA2/SX2 (D1110–D1118, D1062, D1115). Resta: conferir na bancada real a fiação (curto V+/I+ nas entradas de corrente) e o mapa X/Y.
3. **Bloco 4 · Calibração:** próxima aula anunciada nos slides. Tela/atividade de calibração (padrão × instrumento, erro, ajuste de zero/span) quando chegarem os slides.
4. **PID:** instrução PID simplificada no CLP (ou PI por ADD/SUB com clock) e um exemplo de malha de nível/vazão contínua; os slides citam o PID para "adiante".
5. **Malha de nível contínua pela FV-102** (em vez de liga/desliga) e malha de temperatura proporcional (PWM na resistência).
6. **Exportar/importar o programa ladder** (arquivo JSON) para os alunos entregarem atividades. Lembrar que download por link não funciona no artifact; usar área de copiar/colar texto.
7. **Modo avaliação:** atividades com objetivo ("mantenha o nível entre 40 e 60% por 2 min") e correção automática.
8. **Atualizar o prompt do ChatGPT** com as mudanças posteriores (variáveis ao vivo, válvula nova, programas-padrão), se o Ederson continuar a versão no ChatGPT.
9. **Testar em PC do laboratório e no projetor** (desempenho do 3D e modo leve automático).
10. **Republicar o link** a cada versão estável (mesmo artifact).

### 6.1 Roteiro do inversor PowerFlex 525 (aprovado pelo Ederson em 15/11)
1. ~~Fase 1: modelo 3D no painel + janela ao clicar~~ **feito (BUILD -14).**
2. ~~Fase 2: IHM interativa fiel ao manual + checklist da Atividade 1 + seletora DIRETA/INVERSOR~~ **feito (BUILD -14).**
3. **Fase 3:** refinar o motor e a bomba no inversor: curva de corrente mais fiel, rpm com escorregamento, mostrar Hz e rpm na cena, inércia na partida direta (corrente de partida ~6× FLA).
4. **Fase 4:**
   - programa-padrão de CLP para controle de **vazão pela rotação** (FIT-102 → D1117);
   - relé de falha R1 → X7 já existe;
   - mais falhas didáticas (F004 subtensão, F012 sobrecorrente, F006 motor travado);
   - atividade 3 (4–20 mA) e atividade 4 (falhas) no checklist.

## 7. Histórico resumido (13/11/2026)

- **Começo:** REA 6.9.0 instalado no Claude Code/Codex. Pacote SCORM analisado: ele só carrega do servidor do SENAI (o simulador Unity não está no zip).
- **App 2D:** Blocos 1–3 a partir dos slides.
- **Bancada 3D:** do TQ-01 até a planta completa; sala real, CLP, animações, realismo (GTAO), colisão, variáveis ao vivo, programas-padrão.
- **Publicação:** link no claude.ai.
- **BUILD -9 (13/11):** escalas do CLP conferidas no manual. Entradas D1110–D1113: 4–20 mA = 0..2000 (já estava certo). **Saída D1116 corrigida para 0..4000** (antes 0..2000). Programas-padrão ajustados (bias K2000, Kp ×4, passo K40, limite K4000, MOV K4000). Novo D1115 = K7967 (H1F1F) no 1º scan em todos os programas com analógica; monitor avisa "não configurado" se faltar. Simulação testada (vazão P/flutuante/válvula/completa).
- **13/11 (Lucas):** criado o repositório GitHub `LucasVitalBR/bancada-instrumentacao` (privado). `app-instrumentacao.html` renomeado para `index.html`; `.gitignore` e README criados. GitHub passa a ser a cópia oficial.
- **13/11 (Lucas):** regra 00 criada (ler CLAUDE.md + comparar/baixar do GitHub no início; commit + push no fim; IA lembra se esquecerem). Lista do que não vai para o GitHub documentada na 1.2.
- **BUILD -10 (14/11, pedido do Ederson):** eletrodutos cinza do TQ-01 refeitos em `buildPanel` (`app-3d.js`). Antes terminavam soltos no ar; agora saem da eletrocalha com bucha e terminam numa conexão (unidut) no prensa-cabo de TE/TT-104, PIT-103, PSH-103, TSH-104 e TZ-104. TSH e TZ descem por fora do costado e sobem ao prensa-cabo por baixo (curva de gotejamento). Cada eletroduto só aparece com o instrumento instalado (`S.conduits`, conferido em `stepAnims`); o da resistência TZ-104 é fixo. Saiu o pedaço de cabo solto do TE-104. Enviado ao Drive e ao GitHub (14/11). Link publicado ainda na BUILD -8.
- **13/11 (Lucas):** site publicado no Vercel (https://bancada-instrumentacao.vercel.app), ligado ao GitHub: cada push no `main` atualiza o site. Testado com a BUILD -10 (3D e CLP carregam, sem erros no console).
- **BUILD -11 (14/11, pedido do Lucas):** ícone do site criado: `favicon.svg` (manômetro com ponteiro laranja na faixa alta + onda quadrada do sinal 4–20 mA, cores da identidade), `favicon.ico`, `icons/` (180/192/512 px) e `site.webmanifest`; links no `<head>` do `index.html`.
- **BUILD -12 (14/11, pedido do Ederson):** régua do tanque de acrílico (`buildLine`, `app-3d.js`) passou de 11 traços sem número para escala **0–100 %**: traço a cada 5 %, número a cada 10 %, 50 % em laranja. 0 % = fundo (y 0,65) e 100 % = nível máximo (y 1,53), a mesma conta de `setWater` e do LIT-101, então a água bate com a régua. Testado na cena (nível 68,7 % na marca certa). Enviado ao GitHub/Vercel; Drive não atualizado.
- **14/11 (Ederson):** decidido trabalhar **só pelo GitHub**; a regra 1.1 (salvar também no Drive) foi desativada. Sem mudança no app (BUILD continua -12).
- **14/11 (Lucas):** envios do Ederson apareciam como "Blocked" no Vercel (plano Hobby + repositório privado). Criado o Deploy Hook `github-push` no Vercel e a automação `.github/workflows/vercel-deploy.yml` (GitHub Actions), que publica o site a cada envio de outro colaborador.
- **BUILD -13 (14/11, pedido do Ederson):** líquido da bancada trocado de azul-claro para **rosa claro**, porque a bancada física usa fluido dessa cor. Mudou: água do tanque de acrílico, superfície com ondas, jato de entrada, filete do dreno, bolhas (`app-3d.js`) e a cor `--water` das telas 2D (planta). Canos continuam verdes (NBR 6493). Testado na cena.
- **14/11 (Ederson):** BUILD -13 no GitHub, mas o site seguiu na -12 apesar da automação (Deploy Hook aceito, PENDING). Problema e opções registrados na seção 0.0 para decisão com o Lucas.
- **15/11 (Ederson):** criado o site no **Cloudflare Pages** da conta do Ederson (https://bancada-instrumentacao.pages.dev), publicado a partir do PC dele com o wrangler. BUILD -13 no ar. O Vercel continua na -12. Procedimento e pendências na seção 0.0.
- **15/11 (Ederson, manhã):** combinado que o site oficial será o **Cloudflare Pages** e o Vercel será desligado depois que o Cloudflare publicar sozinho. Pendências do Lucas listadas em "PENDENTE PARA O LUCAS" (seção 0.0).
- **BUILD -14 (15/11, pedido do Ederson):** inversor **Allen-Bradley PowerFlex 525 (25B-B5P0N104)** no painel: modelo 3D com display ao vivo, IHM interativa fiel ao manual 520-UM001 (navegação, edição por dígito, Start/Stop/Reverse/potenciômetro), parâmetros reais dos grupos b, P, t e A, falhas F007/F048, checklist das Atividades 1 (IHM) e 2 (CLP), e **seletora de partida DIRETA/INVERSOR**. Novo arquivo `app-pf525.js`. CLP: D1117 (velocidade, borne 15) e X7 (falha do inversor). Fases 3–4 do roteiro na seção 6.1.
- **BUILD -15 (15/11, pedido do Ederson):** o Ederson não achava como entrar nos parâmetros. A edição funcionava, mas o caminho não era óbvio. Mudanças:
  - caixa laranja **“Próxima tecla”** abaixo do teclado, que diz o que apertar em cada etapa (ex.: na tela inicial, “Esc 2 vezes, ▲ até P, ↵”);
  - link **“como fazer ›”** em cada item do checklist, que mostra o passo a passo até aquele parâmetro, com o número de toques no ▲;
  - aviso ao dar Enter num parâmetro do grupo b, que é só leitura.
- **BUILD -16 (15/11, pedido do Ederson):** o checklist e as orientações ficam num **painel ao lado da cena 3D**, e o aluno opera as **teclas do inversor no próprio painel 3D**. Vista nova "Inversor". A janela grande continua no botão "IHM ampliada". `PF525.mount(el, { compact: true })` monta só o painel; vários lugares podem estar montados ao mesmo tempo (`hosts`).
- **BUILD -17 (15/11, pedido do Ederson):** rosa do fluido mais escuro. O jato da mangueira e o filete do dreno ainda saíam azuis, porque a textura `texStreak` tinha fundo azul: agora a base é branca. As setas de fluxo nos canos também ficaram rosa.
- **BUILD -18 (15/11, pedido do Ederson):** andar pela cena com o teclado (`S.walk` no laço do `app-3d.js`):
  - **W A S D ou setas** para frente, trás e lados, no plano horizontal da câmera;
  - **Q/E ou PageDown/PageUp** para descer e subir;
  - **Shift** anda mais rápido;
  - não reage enquanto se digita num campo ou com uma janela (`.ovl3d.on`) aberta.
- **BUILD -19 (15/11, pedido do Ederson):** a frente do PF525 (3D e IHM ampliada) passou a usar a **imagem enviada pelo Ederson** (`vendor/pf525-img.js`) no lugar do desenho simples. Por cima da imagem, `drawFace()` desenha:
  - o display verde com o conteúdo da simulação (pisca, FWD/REV, unidade, PROGRAM);
  - o LED FAULT;
  - o **potenciômetro** e a tecla de **reversão**, que o PF525 tem e a imagem não mostra;
  - o destaque da tecla apertada.
  - A imagem é de um PowerFlex 523: o "523" da etiqueta foi coberto com o cinza da própria imagem e trocado por "525".
  - As posições das teclas estão em `FACE` (coordenadas da imagem 400 × 885), usadas pelo `hitKey` (cliques no 3D) e pelas áreas clicáveis da IHM ampliada.
  - No teclado azul, ◄ = Esc e ► = ↵.
- **BUILD -20 (15/11, pedido do Ederson):**
  - **Eletrodutos da linha:** a eletrocalha continua até x 2,55. Saem eletrodutos para FIT-102, FY-102, LIT-101, LSH-101, LSL-101, VY-01 (novo prensa-cabo no topo da bobina) e motor da bomba (prensa-cabo virado para trás). Os trajetos contornam o tanque de acrílico e os canos, e os pontos finais foram medidos nos prensa-cabos com tudo montado. Cada eletroduto só aparece com o instrumento instalado (o da bomba é fixo). Os prensa-cabos levam `userData.gland`.
  - **Botão "🔌 Eletrodutos: visíveis/ocultos"** no menu Ações.
  - **Foto nova do PF525,** vista de frente e já com o potenciômetro (`vendor/pf525-img.js`, 400 × 855). As posições foram refeitas em `FACE`; a reversão ⇆ fica entre o teclado azul e o botão verde.
  - **Potenciômetro:** o clique (no 3D ou na IHM ampliada) abre uma **barra deslizante vertical** (`PF525.potSlider`), de 0 a 100 %, mostrando os Hz pedidos. Fecha no ✕, com Esc ou clicando fora. No lugar do antigo arrastar/girar, que era difícil.
- **BUILD -21 (15/11, pedido do Ederson: pacote 1 de renderização):**
  - **MSAA 4×** no buffer do composer: bordas lisas com os efeitos ligados.
  - **Brilho (UnrealBloomPass,** limiar 1,05) só no que acende: lâmpadas e LEDs ganharam intensidade maior quando ligados; o vidro das janelas virou `MeshBasic` para não estourar.
  - **Reflexos da própria sala:** `S.captureEnv()` gera o mapa de ambiente (PMREM) a partir de um ponto à frente do TQ-01, deslocando a cena, sem o TQ-01 e os ghosts.
  - **Acrílico com paredes de 10 mm,** verniz (clearcoat) e quinas aparentes, no lugar da caixa única com linhas.
  - **Tom de cor `NeutralToneMapping`,** que preserva as cores.
  - **Níveis Alto/Médio/Leve.**
  - O bundle subiu de 755 KB para 821 KB.
  - Testado no navegador interno; **falta testar o desempenho no PC do laboratório e no projetor.**
- **15/11 (Ederson):** repositório agora **público** (feito pelo Lucas). CLAUDE.md atualizado: tirado o link da pasta do Drive e anotado na seção 0.0 que o Vercel deve passar a publicar os envios do Ederson.
- **15/11 (Ederson):** escolhido o **Vercel** como site oficial (https://bancada-instrumentacao.vercel.app). A publicação no Cloudflare foi encerrada.
