# Controle de Nível Simples — resumo para montar slides

Documento de contexto para criar apresentações fora do Claude Code (Claude no chat, PowerPoint, Canva etc.).
Autor do projeto: prof. Ederson Cardoso (SENAI · Eletromecânica · Automação). Estado de referência: build 20261122-36.

## 1. O que é o simulador

Simulador didático 3D de um sistema de **controle de nível e temperatura**, em uma única página HTML que abre no navegador (Chrome/Edge), sem instalar nada. Representa uma bancada real de laboratório:

- **Tanque de acrílico** com água, dreno com registro (válvula esfera) e entrada de água.
- **Duas boias de nível:** LSL (nível baixo) e LSH (nível alto).
- **Motor + bomba** (motor trifásico verde), com solenoide VY-01 na tubulação.
- **Resistência de aquecimento (TZ-104)** dentro do tanque: fica vermelha e emite brilho enquanto aquece.
- **PT100 (TE-104)** + **transmissor de temperatura TT-104 (4–20 mA)**, e **termostato de segurança TSH-104**.
- **Termômetro padrão** (display digital na tampa) que mostra a temperatura **real**, para comparar com o que o CLP lê.
- **Quadro elétrico** com CLP **Delta DVP20SX2** e três inversores de frequência reais: **PowerFlex 525**, **Altivar ATV12** e **WEG CFW500** (IHMs clicáveis).
- **Porta do quadro** (abre e fecha ao clicar) com botoeiras **LIGA**, **DESLIGA**, **EMERGÊNCIA** (trava), **seletora da resistência** e **5 sinaleiros** (LIGADO, NÍVEL ALTO, NÍVEL BAIXO, RESISTÊNCIA, EMERGÊNCIA).
- Cenário: laboratório de eletromecânica real (janelas, armários, bancada).

Identidade visual do projeto: azul `#1E3A5F`, laranja `#E87722`, fundo branco/claro, fonte Calibri.

## 2. Modos de operação (a progressão da aula)

1. **Sem programa (comando direto):** botoeira LIGA (NA) + DESLIGA (NF), contator **K1 com selo**, LSH (NF) como intertravamento, chave AUTO (a LSL dá a partida), dreno manual, resistência por termostato. Ensina o circuito de comando elétrico clássico. O HUD mostra o esquema do circuito de comando.
2. **CLP com programa no ISPSoft:** o aluno programa o ladder no **ISPSoft (Delta)** e o simulador 3D reage às saídas do CLP, como se o CLP estivesse ligado à bancada.
3. **CLP + inversor:** a bomba parte pelo inversor (Y0 liga; a saída analógica comanda a velocidade; a vazão acompanha a rotação).

## 3. Conceitos que cada parte ensina

| Parte | Conceito |
|---|---|
| Comando direto | Contato NA/NF, selo, intertravamento, emergência, contator |
| Boias LSL/LSH | Sensores de nível discretos, lógica de proteção, histerese |
| Resistência + termostato | Controle liga/desliga (on-off), setpoint, proteção por TSH |
| PT100 + TT-104 | Entrada analógica 4–20 mA, escala, calibração |
| Erro de zero (descalibrar) | Diferença entre valor real e valor lido; erro de offset; calibração |
| Inversor | Partida suave, rampa, velocidade por referência 4–20 mA, lei de afinidade (vazão ∝ rotação) |
| Ponte ISPSoft | Comunicação CLP ↔ processo (E/S), simulação de campo |
| Forçar contatos | Teste de programa sem depender do nível real |

## 4. Números e endereços importantes (Delta DVP-SX2)

- **Entrada analógica:** 4–20 mA ↔ **0 a 2000 contagens**. No simulador, o PT100 usa **D1111**, com **10 contagens = 1 °C** (faixa do transmissor 0–200 °C).
- **Saída analógica:** **D1116**, 4–20 mA ↔ **0 a 4000**, usada como **referência de velocidade do inversor** (0–60 Hz).
- **D222** = velocidade pedida pelo painel (usada em exemplos); **D200** = setpoint de temperatura.
- Modo 4–20 mA no DVP-SX2: registrador D1115 = H1F1F (K7967).
- Padrão de E/S do programa da aula (editável no painel ISPSoft; endereços octais como no Delta, X0–X17 e Y0–Y17):
  - Entradas: X0 emergência (NF, 1 = normal) · X1 LIGA · X2 seletora da resistência · X3 DESLIGA · X4 boia baixa (invertida) · X5 boia alta · X7 falha do inversor.
  - Saídas: Y2 bomba (e solenoide) · Y3 tanque cheio · Y0 resistência.
- **PowerFlex 525** partindo pelo CLP: `P046 = 2`, `P047 = 6`, `t062 = 48` (o simulador pode aplicar os parâmetros automaticamente).

## 5. Descalibrar o PT100 (atividade pronta)

- No painel "Malha de temperatura" há o controle **Erro de zero do TT-104**, de −10 a +10 °C.
- O CLP passa a ler D1111 = (temperatura real + erro). O **termômetro padrão** continua mostrando o valor real.
- O painel mostra **Padrão (real) × TT-104 (lido) × Erro**, e o botão **Calibrar (zerar o erro)**.
- Exemplo de aula: aplicar +5 °C → o CLP lê 50 contagens a mais → o aquecimento desliga 5 °C antes do real; mostrar o efeito no processo.
- Atividade para o aluno: medir o erro comparando com o termômetro padrão e corrigir por programa (subtrair o erro na escala) ou calibrando o transmissor.

## 6. Como o aluno usa (para um slide de "como acessar")

- **Sem ISPSoft:** abrir a pasta do projeto e abrir o `index.html` no Chrome/Edge. Funciona offline.
- **Com ISPSoft:** executar `INICIAR-PONTE.bat` (usa o `node.exe` que vem dentro da pasta, testado em máquina do SENAI), abrir `http://localhost:8765`, no ISPSoft ativar a simulação com o driver **Simulador** do COMMGR (porta 10004) e clicar em **ISPSoft + inversor** na página. A ponte fala **Modbus ASCII sobre TCP** com o simulador do ISPSoft.
- Teclas e mouse: arrastar gira a câmera; roda do mouse aproxima; W A S D / setas andam; Q/E sobem e descem. Clicar no 3D abre a porta, aciona botões, abre o dreno e **força os contatos** das boias e do termostato.

## 7. Sugestão de estrutura de slides (aula introdutória de CLP com o simulador)

1. Título e objetivo da aula (controle de nível e temperatura com CLP Delta).
2. A bancada: o que há no tanque e no quadro (foto/captura do 3D).
3. Revisão: contato NA/NF, selo, contator (comando direto) — demonstração no simulador.
4. Sensores discretos: boias LSL/LSH e a lógica de nível.
5. Do relé ao CLP: entradas X, saídas Y, varredura.
6. Primeiro programa no ISPSoft (partida com selo + intertravamento da boia alta).
7. Entrada analógica: 4–20 mA → contagens → °C (tabela e fórmula).
8. Escalonamento no ladder: MOV, MUL, DIV, ADD (exemplo com D1111).
9. Controle de temperatura liga/desliga (CMP, setpoint, TSH).
10. PT100 descalibrado: erro de zero, comparação com o termômetro padrão, correção.
11. Saída analógica e inversor: D1116, rampa, vazão proporcional à velocidade.
12. Segurança: emergência, termostato, falha do inversor.
13. Atividade prática e critérios de avaliação.
14. Fechamento e próximos passos (erro de ganho, deriva, controle proporcional).

Capturas de tela: abrir o simulador, usar as vistas do menu à esquerda (Vista geral, Topo do tanque, Lateral, Tanque de acrílico, Tubulação, Painel, CLP, Inversores) e capturar a tela.

## 8. Limitações e pontos em aberto

- O simulador não substitui a bancada real: é didático (física simplificada: aquecimento linear, vazão proporcional à rotação).
- O editor de ladder interno e a aba do PT100 antiga foram tirados da interface; a programação é feita no **ISPSoft**.
- O modo ISPSoft precisa de ISPSoft/COMMGR instalados e da ponte rodando no computador do aluno; em máquinas bloqueadas só o modo sem programa é garantido.
- Ainda não implementados: erro de ganho (span), deriva do sensor, guia de entrada analógica dentro do simulador, exercício de correção no ladder.
