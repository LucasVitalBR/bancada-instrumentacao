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

- **Versão:** BUILD `20261114-12` (14/11/2026).
- **Última etapa feita:** régua do tanque de acrílico em % (BUILD -12). Antes: ícone do site (favicon de manômetro + sinal 4–20 mA, BUILD -11). Antes: eletrodutos do TQ-01 ligados aos prensa-cabos dos instrumentos (BUILD -10). Antes: item 2 do plano (endereços e escalas do DVP20SX2 conferidos no manual; saída D1116 corrigida para 0..4000; D1115 = K7967 no 1º scan).
- **Próxima etapa sugerida:** escolher entre os itens 4 (PID), 6 (exportar/importar ladder) ou 7 (modo avaliação) do plano; itens 1 e 3 dependem de fotos/slides.
- **Repositório oficial:** GitHub `LucasVitalBR/bancada-instrumentacao` (privado), ver 1.2. Lucas e colega trabalham por pull/push.
- **Site:** https://bancada-instrumentacao.vercel.app (atualiza a cada push).
- **Drive:** não é mais usado (desde 14/11 só GitHub; ver 1.1).

## 0.1 Regra fixa: manter este arquivo atualizado

- **A cada modificação no projeto, reescrever este CLAUDE.md antes de encerrar**, para quem abrir o projeto (Lucas ou o colega) saber em que etapa estamos:
  1. atualizar a seção **0. Situação atual** (versão/BUILD, última etapa feita, próxima etapa);
  2. marcar o que foi concluído no **plano de continuação**;
  3. acrescentar uma linha no **histórico** (data, BUILD, o que mudou e quem pediu);
  4. ajustar as demais seções se algo mudou (arquivos, convenções, mapa de E/S).
- Depois de atualizar, fazer **commit + push no GitHub** (regra 1.2). Não salvar no Drive.
- Esta regra vale para qualquer pessoa ou IA que trabalhe no projeto.

## 1.1 Google Drive (desativado)

- **Desde 14/11/2026 (decisão do Ederson) as atualizações vão só para o GitHub.** Não enviar mais nada para a pasta do Drive "Bancada de Instrumentação - App" (https://drive.google.com/drive/folders/1_B6YByHBpEh2IXBdSGdLoJg1QqpLFLFq), que ficou parada na BUILD -10, com cópias antigas renomeadas `.v9`.
- Motivo: o conector do Drive não substitui arquivos (só cria novos), o que gerava duplicados.

## 1.2 GitHub (repositório oficial)

- Repositório: https://github.com/LucasVitalBR/bancada-instrumentacao (privado, ramo `main`). Colega entra como **collaborator**.
- **Antes de começar:** `git pull` (traz o que o outro enviou).
- **Ao terminar:** atualizar este CLAUDE.md (regra 0.1), `git add -A`, `git commit -m "o que mudou"`, `git push`. Se o push for recusado, fazer `git pull`, resolver conflitos e enviar de novo.
- A pasta de trabalho fica **fora do Google Drive** (o Drive corrompe a pasta `.git`).
- **O que NÃO vai para o GitHub** (bloqueado no `.gitignore`; manter esta lista igual ao arquivo):
  - `senaiscormhub_*/` e `*.zip`: pacote SCORM do SENAI com **token de acesso**;
  - `bloco1.pptx` e `*.pptx`: material do SENAI e arquivo grande (18 MB);
  - `backup-*/` e `*.vN.js`: backups locais (o histórico do git já guarda as versões);
  - `.claude/`, `node_modules/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`: arquivos de ferramenta/sistema.
- Antes de enviar, conferir com `git status` que nada dessa lista aparece.
- **Site no ar (Vercel):** https://bancada-instrumentacao.vercel.app — projeto `bancada-instrumentacao` na conta Vercel do Lucas (Hobby), preset "Other", sem build. **Cada push no `main` publica sozinho** em ~30 s. Depois de publicar, Ctrl+F5 no navegador.

## 2. Arquivos (sempre juntos na mesma pasta)

| Arquivo | Papel |
|---|---|
| `index.html` | Página principal: abas, telas 2D, CSS, carregamento sob demanda do 3D e do CLP, tela cheia, painel lateral do CLP, janela de ligação do PT100 |
| `app-3d.js` | Cena 3D (Three.js): sala, TQ-01, tanque de acrílico, bomba, tubulação, instrumentos, montagem, simulação física, animações, câmera e colisão. Expõe `window.App3D` |
| `app-clp.js` | CLP Delta DVP20SX2 simulado: editor de ladder, varredura, validação, programas-padrão e painel de operação. Expõe `window.PLC` |
| `vendor/three-bundle.js` | Three.js 0.170 + OrbitControls, CSS2DRenderer, RoomEnvironment, EffectComposer, RenderPass, OutputPass e GTAOPass, empacotados em IIFE com esbuild (`window.THREE`) |
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

- **`const BUILD = "20261114-12"`** no HTML: **incrementar a cada versão**. Ele é usado como `?v=` nos scripts para o navegador não usar cache antigo (já causou a "solenoide sumida").
- **Three.js:** `object.position` é somente leitura. Use o helper `at(obj, pos, scale)`, nunca `Object.assign(mesh, {position})`.
- **GTAOPass (oclusão ambiente):** deixa sprites/transparentes **pretos**. `overrideVisibility()` foi sobrescrito para esconder `isSprite` e `material.transparent` no G-buffer.
- **Gráficos:** modo realista ↔ leve. Cai sozinho para o leve se ficar abaixo de 24 fps por 4 s.
- **Janelas do navegador:** não usar `confirm/alert/prompt` (não funcionam no link publicado). Use `armed()` em `app-clp.js`: o primeiro clique pede "Clique de novo para confirmar".
- **localStorage**, sempre com try/catch:
  - `clp-sx2-programa-v1` (programa);
  - `hud3d` (painel escuro visível);
  - `menu3d` (menu lateral recolhido).
- **Edições grandes:** foram feitas com scripts Node de substituição exata (`patch-*.js` no scratchpad) e backup antes (`app-3d.vN.js`). Validar com `node --check`. Para o HTML, extrair os `<script>` inline e checar.
- **Cores de tubulação (NBR 6493):** água de processo verde, ar comprimido azul, eletroduto cinza-escuro, vapor/respiro branco.
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
  - eletrocalha suspensa e eletrodutos;
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

### CLP (aba "Programar CLP" e painel na tela cheia)
- **Instruções:** NA, NF, ↑P (LDP), OUT, SET, RST, CMP, MOV, ADD, SUB, MUL, DIV. Até 6 contatos + 1 linha paralela por rede, comentários por rede.
- **Monitoramento:** ao vivo, com unidades de engenharia.
- **Mapa de E/S** (endereços e escalas analógicas **conferidos no manual do DVP-SX2** em 13/11; mapa digital X/Y é escolha didática, conferir com a fiação real):

| Endereço | Ligação | Escala |
|---|---|---|
| X0 / X1 | LSL-101 / LSH-101 | 1 = atuado |
| X2 / X3 / X4 | LIGA (NA) / DESLIGA (NF) / seletora AUTO | |
| X5 / X6 | TSH-104 / PSH-103 | |
| Y0 / Y1 / Y2 / Y3 / Y4 | bomba / VY-01 / alarme / sinaleiro / resistência TZ-104 | |
| D1110 | AI CH0 LIT-101 | 2000 = 100 % |
| D1111 | AI CH1 TT-104 | 10 contagens = 1 °C |
| D1112 | AI CH2 FIT-102 | 2000 = 30 L/min |
| D1113 | AI CH3 PIT-103 | 2000 = 6 bar |
| D1116 | AO CH0 → FY-102 | **4000 = 100 %** (AO 4–20 mA = 0..4000) |
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
