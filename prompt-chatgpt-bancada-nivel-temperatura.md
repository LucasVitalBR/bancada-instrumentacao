# Prompt para o ChatGPT: Bancada 3D de Nível e Temperatura com CLP Delta DVP20SX2

> Como usar: copie tudo a partir de "PROMPT" e cole no ChatGPT. Peça uma etapa por vez (a seção 12 traz a ordem). Ao final de cada etapa, teste no navegador e só então peça a próxima.

---

## PROMPT

Você é um desenvolvedor sênior de aplicações web 3D educacionais. Vai construir comigo, por etapas, um **simulador didático de uma bancada de instrumentação industrial** para aulas de um curso técnico do SENAI (Eletromecânica, unidade "Implementação de Equipamentos e Dispositivos"). O simulador tem duas malhas: **controle de nível** e **controle de temperatura**. Ele inclui um **CLP Delta DVP20SX2 programável em ladder** dentro do próprio app, e o programa feito pelo aluno comanda a cena 3D em tempo real.

Escreva tudo em **português do Brasil** (textos de tela, comentários e mensagens). Use **JavaScript puro (sem framework)** e **Three.js**. O app precisa funcionar **offline**, abrindo o HTML com dois cliques (file://), em Chrome e Edge, e rodar em PCs de laboratório escolar.

### 1. Objetivo pedagógico

O aluno deve:
1. **Montar a bancada:** instalar cada instrumento no ponto certo, lendo a tag ISA (TE-104, TT-104, LIT-101, LSH-101…).
2. **Entender o sinal 4–20 mA:** ver em cada transmissor o valor da variável e a corrente correspondente.
3. **Programar o CLP em ladder:** contatos NA/NF, bobinas, SET/RST, bloco comparador CMP e MOV.
4. **Ver a diferença entre malha de controle e intertravamento:** o controle mantém o valor; a chave de segurança atua só no limite. Se o programa não usar a proteção, o tanque **transborda** ou **superaquece**, e o app explica o porquê.

### 2. Arquitetura de arquivos (offline)

Uma pasta com:
- `index.html`: página, CSS, abas e textos.
- `app-3d.js`: cena 3D, montagem, simulação física e animações.
- `app-clp.js`: CLP simulado (editor de ladder + varredura), expõe `window.PLC`.
- `vendor/three-bundle.js`: Three.js **empacotado num único arquivo IIFE** (sem import/ES modules, para funcionar via file://).

Gere o bundle assim, num projeto Node à parte:
```js
// entry.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
window.THREE = Object.assign({}, THREE, { OrbitControls, CSS2DRenderer, CSS2DObject, RoomEnvironment, EffectComposer, RenderPass, OutputPass, GTAOPass });
```
```bash
npm install three@0.170.0 esbuild@0.24.0
npx esbuild entry.js --bundle --minify --format=iife --outfile=vendor/three-bundle.js
```
- O HTML carrega os scripts **só quando a aba 3D é aberta** (lazy), nesta ordem: `vendor/three-bundle.js` → `app-clp.js` → `app-3d.js`.
- Se algum arquivo faltar, mostre a mensagem: "Mantenha a pasta vendor, app-clp.js e app-3d.js junto deste HTML".
- Se o WebGL não iniciar, mostre uma mensagem amigável em vez de quebrar.

### 3. Identidade visual

- **Cores do material das aulas:** azul-marinho `#1E3A5F`, laranja `#E87722`, fundo `#EEF2F7`, azul `#2F6DB5`, verde-azulado `#2E8B7A`, vermelho `#B83A2E`.
- **Fonte:** Calibri (com fallback Carlito / Segoe UI / Arial). Tags em Courier New.
- **Texto:** frases curtas, linguagem de sala de aula.
- **Layout:** tem que funcionar em projetor (fontes grandes) e no celular (sem rolagem horizontal).

### 4. A sala 3D (laboratório real)

**Não use foto como fundo.** A perspectiva não acompanha a câmera. Modele a sala em 3D com base na foto do laboratório:
- **Piso:** granitina clara, brilhante (roughness ~0,22), com juntas a cada 1 m. Textura gerada em canvas com milhares de pontinhos cinza/bege.
- **Paredes e forro:** paredes brancas, rodapé de granito cinza, forro branco com 9 luminárias de LED quadradas (emissivas).
- **Parede do fundo:**
  - duas janelas grandes com **caixilho azul** (`#1E4FB4`), montante central e ~9 travessas horizontais, com vidro claro emissivo (luz do dia);
  - ar-condicionado split no alto;
  - placa verde "ELETROMECÂNICA";
  - duas caixas elétricas cinza com eletroduto azul-claro.
- **Móveis:**
  - armários **cinza-claro** (`#CDD2D8`) de duas portas no fundo, à direita;
  - paredes de armários embutidos cinza-claro nas laterais;
  - bancada didática de alumínio com rodízios, painel de módulos (medidores, disjuntores, botoeiras, emergência) e monitor;
  - cone laranja;
  - carrinho com motores azuis.
- **Iluminação:** HemisphereLight suave, DirectionalLight principal com sombras PCFSoft (radius 4), luz fria vinda das janelas e um PointLight de preenchimento. Use `RoomEnvironment` + PMREM como environment (reflexos nos metais). Tone mapping ACES, `outputColorSpace = SRGB`.
- **Oclusão ambiente (GTAOPass)**, com botão "✨ Gráficos: realista / ⚡ leve":
  - medir FPS e, se ficar abaixo de 24 por ~4 segundos, trocar sozinho para o modo leve e avisar;
  - **ATENÇÃO:** o GTAOPass só ignora Points/Lines. Sprites e materiais transparentes (água, vapor, setas, vidro) saem **pretos** se entrarem no cálculo. Sobrescreva `overrideVisibility()` para esconder, durante o G-buffer, todo objeto `isSprite` ou com `material.transparent`.

### 5. Equipamentos e instrumentos (somente nível e temperatura)

Medidas em metros, sistema da cena com Y para cima.

**TQ-01, tanque de aço inox (malha de temperatura):**
- Corpo cilíndrico (r 0,55; altura 1,2), tampos abaulados (meia-esfera achatada), anéis de solda, 4 pernas com sapatas e plaqueta azul "TQ-01 · aço inox".
- Respiro em pescoço de ganso no topo, por onde sai vapor.
- Resistência **TZ-104**: flange lateral com caixa de ligação, prensa-cabo e lâmpada que acende ao aquecer.

**Tanque de processo de acrílico (malha de nível):**
- Caixa transparente (0,66 × 0,9 × 0,56) com tampa, sobre suporte de perfil metálico.
- Régua de nível pintada, água azul translúcida com altura proporcional ao nível e dreno com válvula.

**Hidráulica:**
- Bomba com motor verde aletado, ventilador traseiro (que gira), acoplamento e voluta azul, sobre base.
- Sucção saindo do fundo do TQ-01 até a bomba.
- Recalque da bomba até a entrada lateral superior do tanque de acrílico, passando pela **VY-01** (solenoide) e por um **rotâmetro** (tubo de vidro com boia vermelha e escala).
- Retorno do acrílico para o TQ-01 pela parte alta.

**Tubulação realista** (é o que mais dá sensação de "real"):
- Curvas de 90° com `TorusGeometry` (raio de curvatura ≈ 3,2× o raio do tubo), não esferas nas esquinas.
- Anéis de solda nas pontas das curvas.
- Flanges duplos com 4–8 parafusos sextavados nas conexões com equipamentos.
- Suportes de perfil (poste + sapata + abraçadeira) nos trechos longos.

**Instrumentos a instalar (Bancada de Peças):**

| Tag | O que é | Onde instala | Observação |
|---|---|---|---|
| TE-104 | PT100 com poço, niple e cabeçote de alumínio com prensa-cabo | Bocal flangeado no topo do TQ-01 | O cabeçote fica **aberto** até receber o TT-104 |
| TT-104 | Transmissor de cabeçote (disco branco com bornes, tipo Novus) + tampa | Dentro do cabeçote do TE-104 | Só libera depois do TE-104; ao instalar, a tampa fecha |
| TSH-104 | Termostato de imersão (cabeça redonda, botão de ajuste vermelho, haste) | Luva lateral do TQ-01 | Proteção: corta o aquecimento no limite |
| LIT-101 | Transmissor de nível ultrassônico (caixa clara com visor, cone emissor) | Bocal na tampa do acrílico | Item didático: a bancada real só tem as boias |
| LSH-101 | Chave boia horizontal (corpo + haste + boia) | Furo lateral **perto do topo** do acrílico | H = alto |
| LSL-101 | Chave boia horizontal | Furo lateral **perto do fundo** do acrílico | L = baixo |
| VY-01 | Válvula solenoide (corpo de latão, bobina preta, conector) | Trecho flangeado vazio do recalque | Rótulo do fabricante, fora da norma ISA |
| (sem tag) | Termopar tipo K | Não vai em lugar nenhum | "A bancada usa PT100, essa peça sobra" |

### 6. Mecânica de montagem

- **Bancada de Peças**, abaixo da cena (não sobreposta a ela): cartões com ícone SVG, nome físico e tag.
- **Escolher e instalar:** o aluno escolhe uma peça e as **áreas de encaixe** (caixas azul-ciano translúcidas com contorno) piscam. Ele toca no ponto onde acha que a peça vai.
- **Acerto:** a peça desce animada até o lugar e aparece o rótulo com a tag.
- **Erro:** a área fica vermelha por 0,6 s e uma dica explica o motivo, ligada às pegadinhas da aula:
  - LSH no lugar do LSL: "a última letra diz o limite: H = alto (high)…";
  - LIT na parede: "o transmissor mede o nível continuamente, de cima, pela tampa; os furos laterais são das chaves boia";
  - TT antes do TE: "o transmissor de cabeçote vai dentro do cabeçote do sensor. Primeiro instale o PT100".
- **Contador de erros** e mensagem final ("Bancada completa! Com N tentativas erradas").
- **Botões extras:** "Recomeçar" e "Montar automaticamente" (este na aba do CLP).
- **Leitura da tag:** ao clicar num instrumento já instalado, mostre a leitura gerada a partir das letras ("Transmissor de temperatura da malha 104").

### 7. Rótulos (evitar poluição visual)

- **CSS2DRenderer** para os rótulos.
- **Modo compacto (padrão):** só a tag, pequena. Os valores aparecem ao passar o mouse sobre o instrumento (borda laranja) ou quando ele está em alarme (borda e fundo vermelhos).
- **Botão "🏷 Rótulos":** alterna entre compactos, completos e ocultos.
- **Sem sobreposição:** a cada ~150 ms, meça os retângulos dos rótulos na tela e esconda (`visibility: hidden`) os que se sobrepõem. Prioridade: alarme, depois hover, depois os mais próximos da câmera.
- **Rótulos auxiliares** (nomes dos tanques, bomba, rotâmetro) ficam ocultos no modo compacto.

### 8. Câmera e controles

- **OrbitControls** com amortecimento, distância de 0,35 a 7,5 e ângulo máximo logo acima do horizonte.
- **Botões de vista** com transição suave (easing cúbico): Vista geral, Topo do TQ-01, Lateral do TQ-01, Tanque de acrílico, Tubulação, Painel e CLP (close no CLP).
- **Colisão:** depois de cada `controls.update()`:
  - prenda câmera e alvo dentro da sala;
  - empurre a câmera para fora das caixas (armários, bancada, painel, tanques) e cilindros (TQ-01) com margem de 0,14 m;
  - **use só empurrões que levem para dentro da sala**, senão os armários encostados na parede "puxam" a câmera para dentro deles.
- **Tela cheia:** botão que usa `requestFullscreen` na caixa que contém a cena e a Bancada de Peças. Se o navegador recusar, use um modo `position: fixed` que ocupa a janela. Esc sai.

### 9. CLP Delta DVP20SX2

**Modelo 3D**, dentro de um painel elétrico bege de porta aberta, preso na parede (escala 2:1 para ficar legível):
- corpo cinza-claro, com "DVP20SX2" no topo;
- LEDs POWER, RUN, ERROR, USB, RS-232 e RS-485;
- coluna **IN 0–7** (LEDs verdes) e **OUT 0–5** (LEDs laranja) que **acendem ao vivo**;
- porta mini-USB, chave RUN/STOP (a alavanca muda com o estado), dois potenciômetros azuis e porta mini-DIN redonda;
- **quatro réguas de bornes verdes destacáveis** com as legendas reais:
  - A/D: V0+, I0+, VI0-, V1+, I1+, VI1-, V2+, I2+, VI2-;
  - V3+, I3+, VI3-, FE, VO0, IO0, VO1, IO1, AG;
  - S/S, X0–X7;
  - C0, Y0, Y1, Y2, •, C1, Y3, Y4, Y5;
- fios coloridos saindo dos bornes para as canaletas.

Desenhe a face num canvas 512×640 e redesenhe a cada atualização. No painel também: trilhos DIN, canaletas, contator da bomba (com lâmpada), disjuntores, fonte 24 V e bornes. Na porta, um IHM e lâmpadas (verde = sinaleiro, vermelha = alarme).

**Mapa de E/S** (ilustrativo; confirmar com o manual do DVP-SX2 e o ISPSoft):

| Endereço | Ligado a | Endereço | Ligado a |
|---|---|---|---|
| X0 | LSL-101 (1 = nível ≤ 15%) | Y0 | Bomba (contator K1) |
| X1 | LSH-101 (1 = nível ≥ 85%, histerese até 82%) | Y1 | VY-01 (solenoide) |
| X2 | Botão LIGA (NA, pulsante) | Y2 | Lâmpada de alarme |
| X3 | Botão DESLIGA (**NF**: 1 em repouso) | Y3 | Sinaleiro bomba ligada |
| X4 | Seletora AUTO | Y4 | Resistência TZ-104 (contator K2) |
| X5 | TSH-104 (1 = temperatura ≥ 90 °C) | | |
| D1110 | AI CH0 ← LIT-101 | D1111 | AI CH1 ← TT-104 |

Especiais: M1000 (sempre ON em RUN) e M1002 (pulso no 1º scan).

**Escala analógica** (ilustrativa): 4–20 mA = 0 a 2000 contagens.
- Nível: 0–100% → 0–2000.
- Temperatura: 0–200 °C → 0–2000 (logo, 10 contagens = 1 °C).
- Sem o TT-104 ligado, a entrada lê 0 mA e o app indica FALHA.

**Editor de ladder** (`app-clp.js`, expõe `window.PLC`):
- **Paleta:** NA, NF, OUT, SET, RST, CMP, MOV, Editar e Apagar.
- **Estrutura de cada rede:** 6 células de contato à esquerda em série (E), uma **linha paralela opcional** (OU) e 1 saída à direita (OUT / SET / RST / CMP / MOV). Botões por rede: "+ paralelo", ↑, ↓ e ✕. Botão "+ Nova rede".
- **Edição:** escolhe a ferramenta e toca na célula. Abre um popover para digitar o endereço (com datalist de sugestões e Enter para confirmar).
- **Validação**, com a mensagem do erro:
  - OUT não pode escrever em X;
  - M1000/M1002 são só leitura;
  - CMP: S1 e S2 devem ser K ou D, e D deve ser bit com D+1 e D+2 válidos;
  - MOV: destino D, e D1110/D1111 são só leitura;
  - rede sem saída;
  - linha paralela vazia.
  A rede com erro fica com borda vermelha, e não deixe entrar em RUN com erro.
- **Semântica:**
  - CMP S1 S2 D: liga D se S1 > S2, D+1 se forem iguais, D+2 se S1 < S2 (só executa com a rede energizada);
  - SET/RST: travam/destravam;
  - OUT: segue a rede;
  - MOV: copia o valor.
  - Ao entrar em RUN, zere M e Y.
- **Varredura:** a cada quadro, a cena escreve as entradas (X0, X1, X5, D1110, D1111), o CLP executa as redes em ordem e a cena lê as saídas.
- **Monitoramento ao vivo em RUN:** fios e contatos energizados em verde, bobinas ligadas em laranja e, embaixo de cada CMP, os valores (S1, S2 e os três bits).
- **Programa salvo** em `localStorage`, com try/catch.
- **Painel de operação:**
  - RUN/STOP;
  - botões físicos LIGA (verde) e DESLIGA (vermelho), que valem enquanto pressionados (pointerdown/up);
  - seletora AUTO;
  - abrir dreno, falhas simuladas e tabela de E/S ao vivo (X, Y, D e os M usados no programa).
- **Exemplos prontos:**
  1. "Nível por comparador":
     - `M1000 → CMP K800 D1110 M10`;
     - `M1000 → CMP K1400 D1110 M20`;
     - `M10 → SET M0`;
     - `M22 → RST M0`;
     - `X4 · M0 · /X1 → OUT Y0`;
     - `Y0 → OUT Y1`;
     - `X0 → OUT Y2`;
     - `Y0 → OUT Y3`.
  2. "Temperatura por comparador":
     - `M1000 → CMP K580 D1111 M30` (abaixo de 58 °C);
     - `M1000 → CMP K620 D1111 M40` (acima de 62 °C);
     - `M30 → SET M1`;
     - `M42 → RST M1`;
     - `X4 · M1 · /X5 → OUT Y4`.
  3. "Partida com selo": `(X2 OU Y0) · X3 · /X1 → OUT Y0`, feito com a linha paralela.
- **Onde fica:**
  - aba "Programar CLP", com o editor à esquerda e a cena 3D ao lado (mova o mesmo elemento da cena entre as abas, sem criar outro renderer);
  - botão **"⌨ Programar CLP" dentro da tela cheia**, que abre um painel lateral (~46% da largura) com o painel de operação compacto e o editor, e a bancada grande à direita;
  - ao fechar ou sair da tela cheia, devolva os elementos para a aba.

### 10. Simulação (física simplificada, passo de tempo × 5)

**Nível (tanque de acrílico, ~300 L):**
- Vazão de entrada: `Q = (bomba && VY-01) ? 30 L/min × abertura : 0`.
- Saída: `(dreno ? 14 : 3) × √(nível/100)` L/min.
- `nível += (Q − saída) / 60 / 300 × 100 × dt × 4`.
- **Avisos:**
  - **Transbordou:** nível ≥ 99,5% com vazão > 0. O aviso ensina a usar o NF do X1.
  - **Bomba contra válvula fechada:** Y0 ligado com Y1 desligado. Não há vazão, e o app avisa.
  - **LSH atuado com a bomba ligada:** o programa não protege, e o app avisa.
- **Falha simulada "LIT-101 travado em 10%":** D1110 fica fixo em 200. O CLP continua enchendo e só o LSH protege.

**Temperatura (TQ-01):**
- `T += ((resistência ligada ? 1,6 : 0) − 0,01 × (T − 25)) × dt`.
- A resistência liga com Y4 (e só se o TSH não tiver atuado).
- **Proteção do TSH-104:** a 90 °C, corta a energia do TZ-104 em hardware (independente do CLP). O rearme só é possível depois de esfriar alguns graus.
- **Falha simulada "relé colado":** a resistência fica ligada mesmo com Y4 desligado, e só o TSH protege.

**Comando local (CLP em STOP):** botões "Ligar bomba" e "Aquecer" no painel lateral. Nesse modo, o LSH e o TSH atuam como intertravamento.

### 11. Animações (todas ligadas ao estado da simulação)

**Água e nível:**
- **Superfície:** PlaneGeometry subdividida (36×30) com deslocamento por vértice a cada quadro: duas senoides suaves, mais ondas circulares no ponto de impacto do jato (amplitude ∝ vazão). Chame `computeVertexNormals()` a cada quadro.
- **Jato de entrada:** TubeGeometry numa curva parabólica da entrada até a superfície, com textura de estrias rolando (`offset.x`) e espessura ∝ vazão. Some quando a entrada fica submersa.
- **Bolhas:** InstancedMesh com até 70 esferas, nascendo sob o ponto de impacto e subindo até a superfície (quantidade ∝ vazão).
- **Dreno:** filete de água caindo num ralo de piso quando o dreno está aberto.
- **Boias LSH/LSL:** pivô que inclina para cima quando a água alcança a altura da chave.
- **LIT-101:** anel do ultrassom descendo do sensor até a superfície a cada 0,7 s, expandindo e sumindo.

**Fluxo e equipamentos:**
- **Setas nos canos:** "luvas" cilíndricas transparentes um pouco maiores que o tubo, com textura de chevron rolando ao longo do tubo (`offset.y = −distância/0,11`). Velocidade ∝ vazão; aparecem e somem gradualmente.
- **Bomba:** ventilador do motor girando, com partida e parada suaves e leve vibração.
- **Rotâmetro:** a boia sobe ∝ vazão e oscila.

**Temperatura:**
- **Vapor:** 30 sprites de fumaça (textura radial, cor cinza `#7F8C99`, porque branco some na parede branca) saindo do respiro acima de 55 °C, mais intenso quanto mais quente. Sobem, crescem e desaparecem.
- **Botão "🌡 Visão térmica":** o casco do TQ-01 recebe emissive de azul (frio) a vermelho (quente), HSL 0,66→0, conforme a temperatura. Use um material só para o casco.
- **Lâmpadas:** a do TZ-104 acende ao aquecer; LEDs do CLP, contator e lâmpadas da porta acompanham as saídas.

### 12. Ordem de entrega (uma etapa por resposta)

1. Estrutura de arquivos, bundle do Three.js, HTML com abas, carregamento lazy e mensagem de erro do WebGL.
2. Sala 3D completa (piso, paredes, forro, janelas, móveis), iluminação e câmera com vistas, colisão e tela cheia.
3. TQ-01, tanque de acrílico, bomba e tubulação realista (curvas toro, flanges, soldas, suportes).
4. Instrumentos, Bancada de Peças, áreas de encaixe, dicas de erro e rótulos (modo compacto sem sobreposição).
5. Simulação de nível e temperatura em comando local, com intertravamentos e falhas.
6. CLP DVP20SX2 em 3D, com LEDs ao vivo.
7. Editor de ladder, varredura, validação, monitoramento, exemplos, painel de operação e integração com a cena.
8. Painel do CLP dentro da tela cheia.
9. Animações de todas as variáveis.
10. Oclusão ambiente, modo leve automático e polimento visual.

Em cada etapa: entregue os arquivos completos (ou as funções alteradas com o local exato), diga como testar e liste o que ficou de fora.

### 13. Armadilhas conhecidas (evite)

- Em Three.js, `object.position` é **somente leitura**: `Object.assign(mesh, { position: … })` quebra. Use `mesh.position.copy(v)` (crie uma função `at(obj, pos)`).
- Textura em `CylinderGeometry`: a coordenada v do UV cresce de baixo para cima. Ao rolar a textura para "frente", use offset negativo.
- O GTAOPass deixa sprites e transparentes **pretos**: veja a seção 4.
- Rótulos CSS2D não somem atrás de objetos: por isso o modo compacto e o descarte de sobreposição.
- Não crie dois renderers WebGL: mova o mesmo `<div>` da cena entre a aba 3D, a aba do CLP e o painel da tela cheia, e chame `resize` (ResizeObserver).
- Navegadores pausam o `requestAnimationFrame` em abas ocultas. Limite o `dt` a 0,1 s para a simulação não "pular".
- Tudo que for salvo em `localStorage` precisa de try/catch (modo privado pode bloquear).
- Não copie modelos, texturas ou logos de simuladores comerciais ou do SCORM do SENAI. Todos os modelos são feitos em código.

### 14. Critérios de aceite (testes que eu vou fazer)

**Montagem:**
- As 7 peças encaixam nos lugares certos e o termopar sobra.
- LSH no furo do LSL dá a dica certa.
- O TT-104 só aparece depois do TE-104.

**Nível com o exemplo 1 (RUN + AUTO):**
- Com o dreno aberto, o nível oscila entre ~40% e ~70%.
- Removendo o contato NF do X1 e travando o LIT em 10%, o tanque transborda e o aviso aparece.
- Com o NF do X1, a bomba para em 85%.

**Temperatura com o exemplo 2:**
- O TQ-01 fica entre ~58 e ~62 °C.
- Com "relé colado", o TSH-104 corta a 90 °C.

**Selo (exemplo 3):**
- LIGA mantém a bomba ligada depois de soltar o botão.
- DESLIGA (NF) desliga.

**Visual e desempenho:**
- Em RUN, os LEDs do CLP 3D acompanham X e Y.
- A câmera não atravessa paredes nem móveis.
- Os rótulos não se sobrepõem.
- Num PC fraco, o modo leve entra sozinho.
- Nada aparece preto com os gráficos realistas.

**Uso offline:** funciona abrindo o `index.html` direto do disco, sem internet.

Comece pela etapa 1.
