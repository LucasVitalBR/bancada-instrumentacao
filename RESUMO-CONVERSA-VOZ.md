# Resumo para conversar por voz: Controle de Nível Simples

Estado em 24/11/2026, build **20261124-44**, pasta do OneDrive (Área de Trabalho). Texto escrito para ser lido ou colado no chat e servir de base para alinhar ideias.

## O que é o projeto (em uma frase)
Simulador 3D de uma bancada de controle de nível e temperatura que abre no navegador, offline. O aluno programa o CLP **Delta DVP20SX2 no ISPSoft** e o simulador reage como se o CLP estivesse ligado ao tanque. Uso em aulas do SENAI (Eletromecânica, automação e instrumentação), grupos de dois alunos.

## O que a bancada tem hoje
- **Um tanque de acrílico** com duas boias (baixa e alta), dreno com registro, resistência de aquecimento, PT100 com transmissor TT-104, termostato de segurança, bomba com motor e solenoide.
- **Quadro com porta:** CLP Delta, três inversores reais (PowerFlex 525, ATV12, CFW500), botoeiras LIGA, DESLIGA, EMERGÊNCIA, seletora da resistência e cinco sinaleiros.
- **Três modos:** comando direto (contator com selo), programa no ISPSoft, e programa no ISPSoft com inversor.
- **Ponte local** (`INICIAR-PONTE.bat`): fala com o simulador do ISPSoft por Modbus ASCII, porta do driver Simulator do COMMGR.
- **Cenário:** laboratório de eletromecânica real.

## O que fizemos nos últimos dias
**Calibração e instrumentação**
- **PT100 descalibrável:** erro de zero de −10 a +10 °C. O CLP lê D1111 com o erro; um termômetro padrão no 3D mostra a temperatura real.
- **Transmissor de nível LT-101** (novo hoje): mede a pressão da coluna de água, faixa 0–10 kPa = 4–20 mA = 0–2000 contagens no **D1110**. Tanque cheio (88 cm) = 1726 contagens. Também tem erro de zero (±10 cm) e um indicador padrão com o nível real.
- **Área "Professor":** seção recolhida no painel, aberta pelo botão "🎓 Professor" no menu, onde ficam os dois erros injetados, para o aluno não ver o valor.

**Física da resistência**
- Temperatura própria da resistência até **200 °C**; aquece mais rápido com menos água.
- A água passa de 100 °C (setpoint até 200 °C), com bolhas de fervura e evaporação.
- **Sem água, a resistência queima:** escurece, solta fumaça escura e o aluno precisa **substituí-la** (botão ou clique), com o comando desligado.
- Termostato de segurança em 180 °C.

**Programação no ISPSoft**
- O simulador envia ao CLP o **setpoint em D200** (10 = 1 °C), a temperatura em D1111, e agora o nível em D1110. A referência de velocidade do inversor vem de D1116.
- Corrigi um erro de lógica do aluno (saída Y0 em várias redes, comparação ao contrário e MOV ao contrário).
- Escrevi programas de exemplo: controle liga/desliga simples em três degraus e a versão com setpoint.

**Interface e organização**
- Dreno e abertura movidos para perto do setpoint; abertura padrão 30 % para o nível ficar controlável.
- **Rótulos (balões)** só aparecem ao passar o mouse; clicar explica o instrumento.
- Corrigi a ponte e o `.bat`: ele fecha pontes antigas na porta e mostra pasta e build; havia **três cópias** do projeto e uma ponte velha mostrava versão antiga.
- Projeto (só desenho) de **vários computadores sobre o mesmo tanque**, com teste de rede para o SENAI.
- Textos prontos para o ambiente virtual: atividade de controle de temperatura com entrega de foto do ladder.

## Decisões do professor que valem lembrar
- A boia LSH **não corta** a bomba no modo ISPSoft: se o aluno não proteger, o tanque transborda (autonomia do aluno).
- Editor de ladder interno **fora da interface**; a programação é só no ISPSoft.
- Setpoint vai até 200 °C, mesmo sabendo que a água ferve e evapora acima de 100 °C (vira exercício).
- Registrador do nível: D1110. Tag: LT-101. Faixa: 0–10 kPa.

## Pontos em aberto para alinhar
1. **Commit:** há bastante trabalho **sem commit** na pasta do OneDrive, e a pasta já foi revertida uma vez pelo OneDrive. Fazer commit agora?
2. **Três cópias do projeto:** a "oficial" (Documentos) está atrasada. Consolidar em uma só, com backup?
3. **Computadores do SENAI bloqueados:** a ponte pode não rodar. Vale um modo sem ISPSoft para os alunos? Voltar o editor de ladder interno?
4. **Siemens/TIA Portal:** dá para criar outro driver na ponte (Modbus TCP com MB_SERVER, ou S7). Depende de PLCSIM Advanced ou CLP real, e da licença.
5. **Vários computadores:** só há o desenho. Testar primeiro a rede do SENAI; decidir os grupos e quem comanda o quê.
6. **Controle de nível proporcional:** a malha (nível em D1110, bomba por D1116) está preparada, mas **não testei** uma malha completa de ponta a ponta.
7. **Ideias que ficaram de fora:** erro de ganho (span) e deriva no sensor; guia de entrada analógica dentro do simulador; exercício de correção no ladder; tela do PT100 refeita a partir de uma imagem que o professor vai mandar.
8. **Teste visual pendente:** fumaça da resistência e o LT-101 no 3D foram verificados por números, não vistos de perto.

## Perguntas boas para começar a conversa
- Qual é a **sequência de aulas**: temperatura primeiro (liga/desliga, histerese, calibração) e depois nível proporcional com inversor?
- Como avaliar o aluno: pela foto do ladder, ou por um desafio dentro do simulador (por exemplo, "ache o erro injetado")?
- O que vale mais agora: Siemens, vários computadores, ou preparar o material das aulas?
