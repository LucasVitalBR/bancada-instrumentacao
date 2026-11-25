# Histórico
- 19/11/2026 · Adicionado controle para recolher/expandir a área Bancada de Peças e a dica inferior; estado salvo para a próxima visita. BUILD 20261119-35.
- 19/11/2026 · Bancada do tanque, bomba e tubulação aproximada mais 25 cm do painel; deslocamento compartilhado mantém alinhadas as conexões e os eletrodutos. BUILD 20261119-34.
- 19/11/2026 · Movido “Montar automaticamente” da bancada de peças para o menu de ações, junto aos controles de tela cheia e vista dividida; permanece acessível no menu compacto do modo dividido. BUILD 20261119-33.
- 19/11/2026 · Adicionado modo “Vista lado a lado”: a bancada ocupa a janela do navegador encaixada em meia tela, recolhe o menu e oculta temporariamente o painel de dados; saída pelo menu ou Esc restaura a disposição anterior. BUILD 20261119-32.
- 19/11/2026 · Jato de entrada agora permanece parado enquanto a vazão se mantém; trajetória fixada ao nível do início do fluxo, com ajuste apenas quando a vazão muda. Ao submergir o bocal, o jato livre desaparece. BUILD 20261119-31.
- 19/11/2026 · Jato de entrada ajustado para se manter no bocal e acompanhar suavemente a subida da água: geometria recalculada a cada 1 mm e tubo mais fino. BUILD 20261119-30.
- 19/11/2026 · Contatores e relés refeitos como modelos 3D geométricos, com terminais/parafusos visíveis e fiação alinhada aos pontos de conexão; removidas as imagens planas da cena. BUILD 20261119-29.
- 19/11/2026 · Fiação do painel refeita para seguir as canaletas e desaparecer por dentro delas. Slider de velocidade do dreno (0–100%, até 60 L/min) adicionado ao painel, iniciando em 100%. BUILD 20261119-28.
- 19/11/2026 · Ajustes visuais e etapa seguinte: ambiente mais claro, materiais ajustados sem reflexos pesados, textura de piso restaurada em baixa resolução, fiação elétrica adicionada para K1/K2 e KA1/KA2; removidos trechos obsoletos de LIT-101/FV-102 e setBand/spLo/spHi. BUILD 20261119-27.
- 19/11/2026 · Etapa 4: simplificação gráfica em padrão único, sem sombras, reflexo de ambiente, pós-processamento ou textura procedural do piso; pixel ratio limitado a 1,25. Mantidas texturas funcionais das telas, rótulos e imagens dos componentes. BUILD 20261119-26.
- 19/11/2026 · Etapa 3: botão “Comando direto” renomeado para “Simular sem programa”, deixando claro que o aluno pode operar a bancada sem programa no CLP. BUILD 20261119-26.
- 19/11/2026 · Imagens fotorrealistas transparentes do contator trifásico e relé de interface integradas aos componentes K1/K2 e KA1/KA2 do painel. BUILD 20261119-26.
- 19/11/2026 · Etapa 2: painel interno agora mostra K1 (bomba), K2 (resistência) e relés de interface KA1/KA2; as indicações de bobina acompanham os comandos locais e do CLP. BUILD 20261119-25.
- 19/11/2026 · Etapa 1: entradas X0–X17 clicáveis no painel ISPSoft. Cada clique alterna ligado/desligado e o valor manual prevalece sobre o sinal automático no endereço escolhido; saídas Y seguem somente como leitura. BUILD 20261119-24.
- 15/11/2026: projeto criado a partir da base da skill simulador-bancada-3d.

## 15/11/2026 · Etapa 1: base enxuta (BUILD 20261115-25)
- index.html: removidas abas Planta, Controle, Quiz, Laço 4–20 mA, Conversões, Tags (HTML+JS); mantidas Bancada 3D, CLP e Ligação do PT100. Título/rodapé "Controle de Nível Simples". Carregador sem scripts de inversor ausentes.
- app-3d.js: buildRoom simplificada (piso+fundo); removidos PIT-103, PSH-103, LIT-101, FIT-102, FV-102, FY-102, termopar TC, rotâmetro (tubo contínuo no lugar), eletrodutos e sliders correspondentes; plcInputs sem D1110/D1112/D1113/X6.
- localStorage com prefixo nivel-: hud3d, menu3d, gfx3d, cond3d, vfd-aba, programa do CLP (nivel-clp-programa-v1).
- Validado: node --check, servidor estático 8765, console sem erros, autoInstall + PLC.setRun(true).

## Etapa 2 (15/11/2026, build 20261115-26)
Modo comando direto: novo modo-direto.js (botoeira LIGA/DESLIGA, selo K1, LSH NF, AUTO por LSL, termostato da resistência, esquema no HUD, seletor direto×CLP). Ganchos pontuais em app-3d.js e carga em index.html. Testado por texto (_tick/MD.press), console sem erros.

## Etapa 3 · modo CLP com inversor (build 20261115-27)
- Novo `inversor.js` (window.INV): rampa, Hz, corrente (∝ n³), falha simulada, IHM em canvas no painel 3D, painel no HUD e dock lateral. Y0 = marcha, D1116 = referência, X7 = falha.
- app-3d.js: removidos DRV/seletora/3 inversores; stepDrive usa INV; motorN vem do inversor só com o CLP em RUN; válvula manual fixa em 100 % (L.fv); D220/spQ/setFlowSp removidos.
- app-clp.js: exemplos reescritos (nivel por boias, velFixa, velPainel, rampa, completa, selo com X7); removidos FIT/FY/PIT/LIT, D1110/D1112/D1113/D210/D211/D220/X6 e o botão de falha do LIT.
- index.html: dock do inversor simplificado, inversor.js carregado em load3dAll.
- Testado por texto (servidor Node :8765): exemplos em RUN, rampa 0→36/60 Hz, falha → X7/Y0 desliga, rearme, selo, comando direto, console sem erros.

## 16/11/2026 · cena reduzida a um tanque + inversores reais (build 20261116-1)
- buildTank esvaziado (inox, retorno, manômetro fora); resistência/PT100/TSH passam ao tanque de acrílico; sucção sai do fundo do tanque; eletrodutos e vistas reajustados.
- Resistência TZ-104: serpentina imersa com brilho vermelho e PointLight proporcionais ao aquecimento (S.tzGlow suaviza).
- inversor.js (genérico) removido; voltaram app-pf525/app-drives/vendor imgs do projeto antigo, ligados ao D1116 (ref) e Y0 (marcha), X7 = falha.
- Testado por texto: autoInstall, aquecimento até o SP, PF525 pelo CLP (30 Hz com D222 = 50 %), comando direto, console limpo.

## 16/11/2026 (2) build 20261116-2
buildRoom detalhado voltou (cenário do laboratório); bancada deslocada DX=-3.4 m para perto do painel (grupo S.bench; eletrodutos, bandeja, vistas e obstáculos ajustados).

## 16/11/2026 (3) build 20261116-3
Modo ISPSoft: ponte.js + modo-ispsoft.js + INICIAR-PONTE.bat. Descoberto por varredura: o simulador DVP (porta 10004) responde em Modbus ASCII/TCP; X, M e D são graváveis, Y legível. Teste ponta a ponta com o ladder do usuário (Y0/Y2 responderam às entradas da página).

## 16/11/2026 (4) build 20261116-5
Porta articulada no quadro do CLP (a antiga abria para dentro da parede e ficava invisível), com botoeiras, seletora, emergência e 5 sinaleiros; X6 no CLP interno; EMERG/SELRES no mapa do ISPSoft (cfg v3).

## 16/11/2026 (5) build 20261116-6
Editor de ladder interno removido da interface; botão ISPSoft + inversor; painel ao vivo de E/S; contatos das boias e do TSH forçáveis por clique no 3D.

## 16/11/2026 (6) build 20261116-7
Aba Ligação do PT100 removida do menu (código fica no index.html); TT-104 sempre ligado; botões de ligação saíram do HUD e das dicas.

## 16/11/2026 (7) build 20261116-8
Dreno: caixa vermelha trocada por registro esfera com alavanca que gira (aberto = alinhada ao cano) e clicável (tag DRENO); vista "dreno".

- 16/11 BUILD -9: flanges vazadas (ExtrudeGeometry com furo), boca oca (openEnd) e ralo do dreno. BUILD -10 a -12: resistência TZ-104 vermelha contínua; etapa 4 validada (Y4/D1111/X5); TSH forçado não rearma sozinho no CLP.

- 16/11 BUILD -13: mapa de E/S livre (listas X0–X17/Y0–Y17, conflitos, edição ao vivo) em modo-ispsoft.js.

- 16/11 BUILD -14: bocais passa-parede ocos (entrada e sucção) dentro do tanque.

- 17/11 BUILD -15: parâmetros automáticos dos inversores (HUD). node.exe portátil + .bat para o pendrive.

- 17/11 BUILD -16: parâmetros automáticos em lote (sem travar) e velocidade 100 % por padrão quando D1116 = 0.

- 17/11 BUILD -17: Aplicar agora assíncrono + atualização do HUD agrupada.

- 17/11 BUILD -18: parametrização automática só sob demanda, por inversor.

- 17/11 BUILD -19: corrigida a trava do 3D com ISPSoft/CLP em RUN (const ai reatribuída em stepDrive).

- 18/11 BUILD -20: dreno mais rápido (22 L/min).

- 18/11 BUILD -21: jato de entrada mais forte (pressão aparente).

- 18/11 BUILD -22: dreno de volta a 14 L/min.

- 18/11 BUILD -23: jato não sai mais do tanque.

## 22-23/11/2026 build 20261122-36
PT100 descalibrável por erro de zero + termômetro padrão no 3D. Ponte/.bat: libera a porta, sem cache, mostra pasta e build. (Reaplicado em 23/11: a pasta do OneDrive havia voltado à versão de 19/11.)

## 23/11/2026 build 20261123-38
Física da resistência: temperatura própria até 200 °C, aquece mais rápido com menos água, fervura a 100 °C com bolhas e evaporação, queima sem água e troca da resistência.

## 23/11/2026 build 20261123-40
Temperatura até 200 °C (sem teto de 100), TSH em 180 °C, fumaça escura ao queimar a resistência.

## 24/11/2026 build 20261124-42
LT-101 (nível por pressão, D1110, 0–10 kPa), indicador padrão de nível, área Professor para os erros de zero, dreno padrão 30 
## 24/11/2026 build 20261124-44
Rótulos só ao passar o mouse; botão Rótulos removido; botão Professor no menu.
## 24/11/2026 build 20261124-45
Água mais realista: balanço (slosh) da superfície com amortecimento, bolhas com deriva/oscilação, gotas de respingo (jato, ebulição, ralo) em pool fixo de 96; cor inalterada.
## 24/11/2026 build 20261124-46
Ponte em segundo plano: INICIAR-OCULTO.vbs, REGISTRAR-INICIO-AUTOMATICO.bat (atalho nivelponte: + inicio com o Windows), PARAR-PONTE.bat; botão ISPSoft + inversor inicia a ponte sozinho se estiver parada.
## 24/11/2026 build 20261124-47
Jato de entrada trocado do tubo estático por partículas balísticas (pool 220, esticadas na direção da velocidade, desfazem-se em gotas ao bater na água).
## 24/11/2026 build 20261124-48
Água menos densa: corpo 0.64→0.30, superfície 0.74→0.45, jato 0.85→0.60 de opacidade (mesma cor).
## 24/11/2026 build 20261124-49
Jato: gotas bem menores e mais numerosas (pool 420, ~260-520/s), menos esticadas e com menos ruído, para parecer filete d'água e não corda.
## 24/11/2026 build 20261124-50
Jato refeito: filete fino translúcido deformado por quadro (ondulação, afinamento, estrangulamento) + poucas gotas satélite; água ainda menos opaca (corpo 0.20, superfície 0.34). Mesma cor.
## 24/11/2026 build 20261124-51
Jato com mais água: filete ~2x mais grosso (raio 5,5–11 mm), mais gotas satélite (pool 140) e opacidade 0.5.
## 24/11/2026 build 20261124-52
Desague do jato: filete termina na superfície e abre em leque; espuma de bolhas no impacto (pool 90) e pluma de bolhas maior (pool 240).
## 24/11/2026 build 20261124-53
Microbolhas em suspensão no volume (pool 110, circulam com a vazão) e bolhas do jato mergulham antes de subir (sensação de diluição).
## 24/11/2026 build 20261124-54
Botão Tela cheia agora ocupa só a janela da página (classe .max, position fixed), sem requestFullscreen.
## 24/11/2026 build 20261124-55
Página usa toda a largura da janela (main sem max-width) e a bancada 3D ganha altura = janela - 230 px.
## 24/11/2026 build 20261124-56
Altura da bancada adaptável: clamp(420px, min(100dvh-210px, 88vw), 1300px); em telas baixas (<=820px) usa 100dvh-150px; celular 78dvh.
## 24/11/2026 build 20261124-57
Aba Bancada 3D só com a cena: removidos título/texto, cartão do CLP e nota; Bancada de Peças e dica ocultas (display:none, JS intacto). Altura da cena = janela - 150 px.
## 24/11/2026 build 20261124-58
Bancada 3D fixa sem rolagem: html/body 100dvh, cabeçalho estático, main preenche o resto e a cena 3D ocupa toda a área (rolagem removida).
## 24/11/2026 build 20261124-59
Corrige tela em branco do BUILD -58: altura da cena por flex (main/section/box3d) em vez de height:100%.
## 24/11/2026 build 20261124-60
Bancada fixa: seção posicionada em absoluto (inset) dentro do main, altura definida sem depender de flex/porcentagem.
## 24/11/2026 build 20261124-61
Corrige tela branca: o main com margin:auto num body flex encolhia para 20 px de largura; agora width:100%, margin:0.
## 24/11/2026 build 20261124-62
Controles de navegação (arrastar, roda, WASD, Q/E, Shift, clique) movidos para a barra azul superior.
## 24/11/2026 build 20261124-63
Identidade visual EducaWEB aplicada (EducaWEB-identidade-visual.html): paleta tinta #0F2236 / laranja #EE7A10 / névoa #F5F6F8, fontes Bricolage Grotesque + IBM Plex Sans/Mono (Google Fonts, com fallback offline), logo no cabeçalho e favicon.
## 24/11/2026 build 20261124-64
Dreno: tubulação e registro movidos para x 0,12 / z 0,14–0,30 do tanque (antes cruzava a sucção em x -0,2); ralo do piso reposicionado; filete do dreno refeito como o jato (balístico, ondulação, leque no impacto) com vazão = abertura × raiz do nível, gotas satélite e respingo no ralo.
## 24/11/2026 build 20261124-65
Fundo do cenário: bancada didática real (buildRealBench: perfis de alumínio com faixa preta, tampo preto, faixa de comando, 3 linhas de painéis com inversor CFW500 e soft-starter SSW07, 3 caixas, medidores mA/A/V, cobertura, monitor em braço, teclado, vitrine com motor azul e servomotor). Chaves boia LSH/LSL redesenhadas (cabeça sextavada, arruela cinza, rosca com anéis, rabicho, haste articulada e boia cilíndrica que cai a ~50° sem água). Removido o suporte do cano de recalque em x 2,0 que sobrepunha o ralo do dreno.
## 24/11/2026 build 20261124-66
Bancada de fundo: desenhos (faixa, painéis, caixas, medidores, teclado) afastados 5-6 mm da face + polygonOffset (fim do z-fighting/afundamento); monitor avançado para frente da estrutura (atravessava a prateleira) com braço e cabos reposicionados.
## 24/11/2026 build 20261124-67
Chaves boia LSH/LSL 30% menores (escala 0,7 do grupo).
## 24/11/2026 build 20261124-68
Bancada de fundo: estrutura rasa; faixa de comando e linha de painéis colados na face da frente (sem prateleiras profundas), caixas e medidores encaixados rentes à frente, cobertura recolocada.
## 24/11/2026 build 20261124-69
Computador da bancada refeito: all-in-one ital (painel fino, queixo com logo, corpo atrás, webcam, placa VESA) em braço articulado com base/coluna/2 segmentos/juntas; teclado compacto e mouse sem fio (sem cabos), um cabo de energia.
## 24/11/2026 build 20261124-70
Removidos da tampa do tanque o termômetro padrão (TREF) e o indicador padrão de nível (NPAD). O HUD segue mostrando temperatura/nível reais.
## 24/11/2026 build 20261124-71
Nova aba CLP: modo de comando, partida/inversor, conexão ao ISPSoft e mapa de E/S saíram do painel 3D para a aba CLP (renderClpTab em app-3d.js). O painel 3D ficou só com simulação (setpoint, dreno, Aquecer, Relé, LIGA/DESLIGA/AUTO, Ligar bomba, tabelas, Professor) e um botão Configurar o CLP. Com a aba da bancada oculta a simulação e a comunicação com o ISPSoft continuam rodando. Atalhos de navegação só aparecem na aba da bancada.
## 24/11/2026 build 20261124-72
Aba CLP: conexão com o ISPSoft e mapa de E/S passou para a esquerda (principal, maior, com faixa laranja); modo de comando e partida/inversor ficaram na direita.
## 24/11/2026 build 20261124-73
Mapa de E/S: o checkbox inv. virou dois botões de contato NA (aberto) e NF (fechado) com símbolo. NA envia X = 1 quando o dispositivo é acionado; NF envia X = 1 em repouso. Padrões equivalentes ao anterior (emergência NF, demais NA; boia LSL acionada = boia levantada). cfg do localStorage passou para v4 (endereços antigos voltam ao padrão).
## 24/11/2026 build 20261124-74
Mapa de E/S do ISPSoft começa VAZIO a cada abertura da página (nenhuma X/Y, nenhum D; a configuração não é mais restaurada do localStorage; porta continua 10004). Só o botão Montar automaticamente preenche o padrão da aula (ISP.applyDefaults); botões Preencher com o padrão da aula e Limpar tudo na aba CLP. D vazio = a página não escreve nem lê aquele registrador.
## 24/11/2026 build 20261124-75
Recarregar a página não perde mais o mapa de E/S: a configuração fica no sessionStorage da aba (restaura no F5, some ao fechar a aba, então abrir de novo continua vazio). Botões Salvar em arquivo / Carregar de arquivo (mapa-es-clp.json). Montar automaticamente só preenche se o mapa estiver vazio e, após recarregar, a bancada é remontada sozinha se já estava montada.
## 24/11/2026 build 20261124-76
Removidos os botões Salvar/Carregar arquivo do mapa de E/S (difícil para os alunos). Fica só o salvamento automático na guia (sessionStorage): sobrevive a recarregar e se perde apenas ao fechar a guia.
## 24/11/2026 build 20261124-77
Removido o texto explicativo do salvamento automático embaixo dos botões do mapa de E/S.
## 24/11/2026 build 20261124-78
Mapa de E/S: ordem das entradas agora Emergência, LIGA, DESLIGA, Seletora da resistência, boias LSL/LSH, AUTO, TSH, Falha (os endereços padrão não mudaram).
## 24/11/2026 build 20261124-79
Padrão da aula no mapa de E/S segue a ordem das linhas: X0 Emergência, X1 LIGA, X2 DESLIGA, X3 Seletora da resistência, X4 LSL, X5 LSH (antes DESLIGA X3 e Seletora X2). O ladder Controle_Tanque do ISPSoft precisa usar X2 = DESLIGA e X3 = seletora.
## 24/11/2026 build 20261124-80
Botão laranja Simular sem programa no menu Ações da bancada 3D (modo demonstração): monta a bancada, passa ao comando direto e roda em ciclo: enche até a boia superior (LSH), abre o dreno a 100 % e esvazia até a inferior (LSL), recomeça. Vira Parar demonstração. Não preenche o mapa de E/S.
(BUILD 80: o AUTO do HUD passa a mostrar sim durante a demonstração.)
## 24/11/2026 build 20261124-81
Cabos (eletrodutos) reorganizados: raio 4,5 mm (antes 9 mm), trajetos retos com curvas arredondadas, feixe único dos 4 cabos do tanque que se separam no nível de cada instrumento, enforca-gatos (fitas com cabeça e rabicho) e buchas/conexões menores.
(BUILD 81: enforca-gatos em cinza claro para aparecerem sobre os cabos pretos.)
## 24/11/2026 build 20261124-82
Cabos: ondulação suave e curvas amplas (mesma fase no feixe, ficam paralelos); enforca-gatos só no feixe de 2+ cabos (refeitos conforme as peças instaladas); a ponta de cada cabo agora termina no prensa-cabo real da peça montada (boias, TSH, transmissor TT-104 ganhou prensa-cabo lateral). Teste headless: sem erros.
## 24/11/2026 build 20261124-83
Quadros elétricos (CLP e inversores) mais realistas, com base nas imagens de referência: trilho DIN ômega com furos oblongos e parafusos, canaletas ranhuradas com tampas, réguas de bornes modulares (cinza, PE amarelo, azul, fim de linha, jumper), fonte 24 V DIN, barra de terra, parafusos da chapa, guarnição de borracha, aba contra chuva, orelhas de fixação; porta com nervura, maçaneta com trava, dobradiças, grade de ventilação e trilho perfurado interno; fios com ponteira e marcador amarelo; contatores/relés com engate, ventilação e bloco auxiliar.
## 24/11/2026 build 20261124-85
Cabos com física plausível: saem da eletrocalha na vertical, descem retos e só curvam perto da peça com folga que pende (raio 7,2 mm); derivações de eletrocalha sobre o tanque, a tampa e atrás do tanque; o cabo da bomba voltou ao trajeto clássico. Quadro: porta de cantos arredondados com friso de reforço, maçaneta de alavanca com trava, dobradiças, grade e filtro-ventilador, plaqueta, aba de chuva inclinada com olhais. Resistência TZ-104: aquecedor flangeado de 3 grampos com aleta helicoidal, brilho incandescente corre pelo elemento (laranja a amarelo-branco), fervura bem mais intensa (a partir de ~95 °C, 420 bolhas, espuma na superfície).
## 24/11/2026 build 20261124-86
Quadro do CLP e dos inversores a partir das fotos de referência: chapa de montagem laranja, canaletas cinza ranhuradas (horizontais e verticais laterais), bornes push-in com botões laranja, etiquetas amarelas nos equipamentos, fios preto/marrom/azul com luvas brancas, bandeirola e abraçadeira, disjuntor modular QM1. Bolhas mais brancas e maiores.
## 24/11/2026 build 20261124-87
Corrigido vazamento fantasma: com o dreno fechado o nível caía devagar porque stepLevel tinha uma saída fixa de 3 L/min (x raiz do nível). Agora dreno fechado = saída 0. A única perda sem dreno é a evaporação com a resistência ligada acima de ~98 °C.
## 24/11/2026 build 20261124-88
Quadro simplificado conforme referência de gabinete de parede: cor verde-acinzentada, porta lisa maior que a boca (ressalto), dobra de retorno na porta, gaxeta preta em anel na face interna, dobra e ressalto na boca do gabinete, fechadura de came de 1/4 de volta, dobradiças pequenas. Removidos aba de chuva com olhais, orelhas, quinas cilíndricas, maçaneta de alavanca, grade de ventilação e filtro-ventilador.
## 24/11/2026 build 20261124-89
Tela do computador do fundo agora mostra o logo EducaWEB animado (brilho pulsante, arcos laranja girando, partículas em órbita, barra de progresso), em vez de tela preta. Canvas 384x216 redesenhado ~15x/s.
## 24/11/2026 build 20261124-91
Cabos: sobem do topo do quadro pela descida da calha, correm dentro da calha lado a lado e saem por baixo sobre cada peça; calha principal com vãos nas paredes e derivações limpas; cabos finos de novo (4,5 mm); enforca-gatos nos trechos com 2+ cabos. Registros de volante trocados por válvulas esfera inox com uniões de PPR e alavanca amarela ACEPIL que gira 90 graus; clicáveis (REG-1 a REG-4). Fechar qualquer registro zera a vazão; bomba ligada com registro fechado sobreaquece (cor do motor, linha Bomba na tabela) e a cerca de 90 °C o inversor ativo entra em falha de sobrecarga (PF525 F007, ATV12 OLF, CFW500 F072); na partida direta atua o relé térmico. Reset reabre os registros.
## 24/11/2026 build 20261124-92
Bomba queima quando o registro fica fechado com ela ligada: junto da falha do inversor/relé térmico o motor escurece, sai fumaça (a partir de 70 °C já solta fumaça leve) e a bomba só volta com o botão Substituir bomba (painel ou clique na bomba). Válvula esfera menor (0,8x), empunhadura de topo plano com ON/OFF colado, sem a marca.
## 24/11/2026 build 20261124-93
Registro de esfera também no dreno (mesmo modelo). Página hospedada (Vercel/qualquer domínio) fala com a ponte em http://localhost:8765 no computador do aluno; ponte responde ao pré-voo de rede privada (Access-Control-Allow-Private-Network).
## 24/11/2026 build 20261124-94
Alavanca do registro de esfera: empunhadura mais longa (7,2 r) e fina (0,95 r de largura, 0,5 r de espessura).
## 24/11/2026 build 20261124-95
Registro de esfera um pouco menor: escala 0,72 e empunhadura de 5,3 r (meio-termo), mesma espessura.
## 24/11/2026 build 20261124-96
Tela dividida: CSS para largura <= 760 px (cabeçalho compacto, menu 136 px e recolhido por padrão, painel do processo como folha inferior e oculto por padrão, tabelas e aba CLP em linhas empilhadas). Boias: limiares elétricos iguais à posição das chaves (LSL 17 %, LSH 83 %) e a tabela mostra posição da boia e o contato escolhido (NA/NF, Xn = valor enviado ao CLP).
## 24/11/2026 build 20261124-97
Botão Desempenho no menu Ações: contador de FPS, tempo de quadro (pior quadro), custo médio de simulação x desenho, chamadas de desenho, triângulos, texturas/geometrias, resolução/pixel ratio e nome da GPU (WEBGL_debug_renderer_info) para comparar computadores; lembra o estado (localStorage nivel-perf3d).
## 24/11/2026 build 20261124-98
Qualidade gráfica Alta/Média/Baixa ao lado do FPS (barra sempre visível no topo da cena; botão ⓘ mostra quadro/pior/melhor). Média e baixa reduzem resolução (pixel ratio 0.9/0.65), partículas (55 %/25 %), atualização da superfície da água e do protetor de tela; antialias só em Alta (vale ao reabrir). Padrão pela placa de vídeo (NVIDIA/Radeon = alta; Intel/integrada/software = média); escolha guardada em nivel-q3d. Interior do quadro do CLP só é desenhado com a porta aberta. Aviso quando o FPS fica abaixo de 24 por 3 s.
## 24/11/2026 build 20261124-99
Seletoras da porta (resistência e partida da bomba) trocadas por botão rotativo realista (aro cromado, colar, botão preto ranhurado, ponteiro com linha branca, sem ponta amarela). As duas plaquetas RESISTÊNCIA e DESL/LIG se sobrepunham e piscavam (z-fighting): agora é uma plaqueta só e todas as plaquetas da porta têm polygonOffset.
## 24/11/2026 build 20261124-100
Removido o botão ⓘ e os detalhes de tempo de quadro da barra de desempenho: ficam só o FPS e os botões Alta/Média/Baixa.
## 24/11/2026 build 20261124-101
Resolução interna por qualidade: altura máxima 1080 (Alta), 720 (Média) e 480 (Baixa); a imagem é esticada para a janela adaptável e nunca desenha mais pixels que a janela tem. A barra do FPS mostra a resolução interna (ex.: 1920×1080).
## 24/11/2026 build 20261124-102
Tela estreita (<= 760 px, vista dividida): menu e painel do processo nunca ficam abertos ao mesmo tempo (abrir um recolhe o outro) e o menu sempre começa recolhido; painel com fundo sólido e sombra. Resolução interna por altura (1080/720/480) conferida em 1400x900, 4K e dpr 1,5.
## 24/11/2026 build 20261124-103
Qualidade Baixa = física/visual da água simplificada: superfície plana (sem ondas nem normais por quadro), jato de entrada como cilindro fino, filete do dreno atualizado a cada 8 quadros, sem bolhas/espuma/gotas/microbolhas (pf = 0) e monitor do fundo parado no quadro inicial. O nível, a temperatura e a vazão continuam calculados igual (só a parte visual muda).
## 24/11/2026 build 20261124-104
Qualidade Baixa: removido o segundo feixe de água (cilindro simples) que aparecia embaixo do cano; fica só o jato original. Removida a resolução da barra do FPS.
## 24/11/2026 build 20261124-105
Bolhas sumiam com o zoom perto: a malha instanciada A.bub tinha frustumCulled ligado e a esfera de culling era calculada com poucas bolhas, escondendo as demais fora dela. Agora frustumCulled = false.
## 24/11/2026 build 20261124-106
Painéis laterais fluidos: menu (esquerda) e painel do processo (direita) continuam nas laterais e encolhem com a janela (largura, letras, botões e tabelas em clamp/vw, até 1100 px); removida a folha inferior em tela estreita e a regra de abrir um fechar o outro.
## 24/11/2026 build 20261124-107
Qualidade Média: partículas (bolhas, espuma, gotas, microbolhas, jato) em 30 % da Alta (antes 55 %). Alta = 100 %, Baixa = 0 %.
## 24/11/2026 build 20261124-108
Canaletas do quadro: a face voltada para a porta agora é uma tampa lisa; os furos (dedos) ficam só nas bordas de cima e de baixo, por onde os fios entram (antes a face inteira parecia ranhurada, como se a tampa estivesse virada para cima).
## 24/11/2026 build 20261124-109
Canaletas do quadro refeitas pela foto de referência (horizontais e verticais): PVC cinza-escuro, fundas (7,5 cm, quase a profundidade dos componentes), tampa lisa de frente, rasgos só nas faixas de cima e de baixo (por onde os fios entram), tampas nas pontas.
## 25/11/2026 build 20261125-112
Fiação do quadro refeita (CLP intacto): fios saem dos bornes verdes em leque, entram pelos rasgos das canaletas (alinhados ao passo de 16 mm), correm escondidos dentro delas e saem por outro rasgo até o terminal; contatos de KA1/KA2 sobem pelas canaletas até as bobinas de K1/K2 sem cruzar a frente dos contatores; cabos de saída dos inversores entram na canaleta de baixo.
## 25/11/2026 build 20261125-113
Porta do quadro: luzes piloto em domo sem aro preto, com halo aditivo (visíveis de longe quando acesas); botões LIGA/DESLIGA com anel cromado e símbolo I/O; emergência em cogumelo vermelho sobre plaqueta amarela; IHM simulada (processo + tendência, clique alterna) com carcaça traseira, grampos e cabo até o CLP. Canaleta: frente 100% lisa (sem furo), rasgos só nas paredes de cima/baixo; fiação entra por esses rasgos (alteração da fiação ainda em avaliação pelo Lucas, não commitada).
## 25/11/2026 build 20261125-114
Luzes piloto com corpo reto e tampo quase plano (sem aparência de bola), anel cromado mais fino. Emergência: haste preta de 22 mm sob cabeça de 40 mm (proporção de catálogo); corrigido o buraco preto ao apertar (cabeça do cogumelo agora desenhada nos dois lados) e curso de 6 mm.
## 25/11/2026 build 20261125-115
Fios do CLP entram de lado no parafuso de cada borne (X0..X4 e S/S para a canaleta de cima; Y0, C0, Y4, C1 para as bobinas de KA1/KA2). Fonte 24 V e contator K1/K2 com mais detalhe (bornes, numeração, rótulo). Cabo da IHM faz arco por cima. Cenário: bomba preta com pás branca/vermelha no ventilador; luminárias fluorescentes de 2 tubos e forro de lambri; janelas com vidro escuro e venezianas; ar-condicionado piso-teto com tubulação; armários com puxador em C, fechadura, tampo e grade; caixas na parede com botoeiras; bancada SOMA refeita virada para a sala, com 2 quadros e motores; parte de baixo da bancada de fundo com laterais, puxador, chave amarela e calota do servo.
## 25/11/2026 build 20261125-116
Fios de sinal do CLP bem finos (0,75 mm²: raio 1,1 mm). Luminárias giradas 90° (longas no eixo da profundidade). Bancada SOMA com as costas do quadro encostadas na parede direita. Piso cinza-escuro. Cabo da IHM desce com barriga (mais caída quanto mais longe a porta) e entra no rasgo da canaleta do meio perto da IHM; trecho fixo sobe da canaleta até a tomada do CLP.
## 25/11/2026 build 20261125-117
Iluminação do laboratório: removido o ponto de luz de preenchimento (ficava a 20 cm do forro e fazia um círculo claro); luz ambiente +0,2. Lâmpadas com iluminação falsa e barata: halo aditivo no forro, mancha suave de luz no piso sob cada calha e forro levemente emissivo, sem nenhuma luz real por lâmpada.
## 25/11/2026 build 20261125-118
Ar-condicionado refeito como Fujitsu piso-teto (referência: linha ABBG/ABBH, unidade interna ~170 x 23,5 x 70,5 cm; aqui 1,5 x 0,24 x 0,68 m): corpo extrudado com cantos arredondados e frente inclinada, saída de ar escura com aleta e lâminas verticais, grade de retorno embaixo, logotipo vermelho FUJITSU, display com LEDs, tirantes. Lâmpadas: removidos o halo retangular no forro e as manchas quadradas no piso; fica só um brilho fino em volta de cada tubo.
## 25/11/2026 build 20261125-119
Ar-condicionado ajustado ao modelo de referência Fujitsu ABBG45LRTA (42000 BTU piso-teto): 1,66 x 0,24 x 0,70 m (faixa das unidades internas da linha: 166-170 x 23,5-24 x 70-70,5 cm).
Removida a mancha escura no forro acima do ar-condicionado: o forro fica uniforme, na mesma cor e textura em toda a sala.
## 25/11/2026 build 20261125-120
Ar-condicionado: perfil em cunha com frente/saída de ar mais fina, pontas bem arredondadas (bisel grande), logotipo e display na face frontal. Parede embaixo do ar: removida a placa ELETROMECÂNICA; um só quadro (liga o compressor lá fora) com eletroduto até o furo na parede; linha azul de ar comprimido entra pela parede, passa por filtro-regulador (botão vermelho) e registro amarelo e sai pelo rodapé com engate rápido. Removidos o segundo quadro e o eletroduto que corria pelo peitoril.
Corrigido o tremido (z-fighting) do logotipo, display, LEDs e emendas na frente do ar-condicionado: decalques afastados 4-6 mm da superfície curva e com polygonOffset.
## 25/11/2026 build 20261125-121
Fundo do tanque de acrílico: corrigido o cintilar ao mexer a câmera. Causas: chapa de apoio com a face de cima coplanar ao fundo do acrílico (y 0,64) e a água com o fundo coplanar à chapa do acrílico (y 0,65) e às paredes; ordem de desenho das transparências mudava com a câmera. Agora a chapa fica 1,5 mm abaixo, a água começa 1 mm acima do fundo e 4 mm mais estreita, e acrílico (renderOrder 1) é desenhado antes da água (renderOrder 2).
## 25/11/2026 build 20261125-122
Motor WEG azul (W22) simplificado em wegMotor(): carcaça aletada, tampas, caixa de ligação, pés, eixo com chaveta e placa. Usado na vitrine da bancada de fundo e nos dois motores da prateleira da bancada SOMA (sobre chapa de base). Detalhes da parte de baixo da bancada de fundo (laterais cinza, puxador, chave amarela, servomotor com calota).
## 25/11/2026 build 20261125-123
Gaveta do CLP adaptável ao celular (painel-clp.js): detecta tela pequena (janela <= 760 px, ou toque + largura <= 900) e então fica no canto esquerdo, encolhe para caber na largura e ocupa no máximo metade da altura (zoom mínimo 0,35). No computador continua no tamanho cheio ao lado do menu. Reajusta ao girar a tela.

## 25/11/2026 build 20261125-124 (branch ponte-instalador)
Instalador da ponte por usuário (downloads/Comunicacao-CLP.cmd, baixado como "Comunicação - CLP.cmd", gerado por node instalador/gerar.js) e botão de download na aba CLP quando a ponte não responde. Ponte aceita só os sites do projeto (extras em origens.txt), recusa outro Host e não cai com endereço mal formado. Sem início com o Windows. Falta testar o instalador no Windows (sintaxe PowerShell não validada).

## BUILD 20261125-126
- Aba CLP: passo a passo (instalar o Node.js e a Comunicação - CLP, preparar o ISPSoft e conectar), com os links de download. A Comunicação - CLP também procura o Node em Program Files.
