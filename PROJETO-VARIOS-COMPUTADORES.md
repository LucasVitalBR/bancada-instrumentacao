# Projeto (não implementado): vários computadores sobre o mesmo tanque

Objetivo: o computador do professor (**mestre**) guarda o estado do processo (nível, temperatura, erros injetados) e 2 a 3 computadores de grupos (**clientes**), cada um com seu ISPSoft e sua ponte, agem sobre o **mesmo tanque**.

## 1. Arquitetura proposta

```
 PC do grupo A                          PC mestre (professor)                      PC do grupo B
 ISPSoft + simulador (10004)            Página 3D + física do tanque               ISPSoft + simulador (10004)
      │  Modbus ASCII local                  (única cópia do processo)                  │
 ponte-cliente ── HTTP/JSON, LAN ──►  ponte-mestre (porta 8780) ◄── HTTP/JSON ── ponte-cliente
```

- **A física roda só no mestre** (a página 3D que já existe). Os clientes não simulam nada.
- **ponte-mestre:** a ponte atual, ouvindo também na rede local (hoje só em 127.0.0.1) e com novos endpoints por grupo (`/api/grupo/A/xchg`).
- **ponte-cliente:** a ponte atual, mas em vez de entregar as saídas à página local, envia ao mestre as saídas (Y, D1116) lidas do seu simulador e recebe de volta os sensores (boias, D1110 nível, D1111 temperatura, estado de emergência) para escrever no seu simulador.
- **Cliente sem tela 3D própria:** o grupo acompanha o 3D pela tela do professor/projetor. Opcional, em outra etapa: "modo visualização" da página, que só desenha o estado recebido do mestre.

## 2. Sincronização

- O mestre calcula a física em passos fixos (ex.: 10 por segundo) e mantém o último estado.
- Cada cliente troca dados a cerca de **5 a 8 vezes por segundo** (mesma cadência de hoje com o ISPSoft), por HTTP simples com JSON. Não é preciso WebSocket.
- Mensagem do cliente → mestre: `{grupo, saídas: {Y2: 1, D1116: 2400}, hora}`. Mensagem do mestre → cliente: `{X: {...}, D1110, D1111, D200, emergência, nível, temperatura}`.
- **Falha segura:** se um cliente fica mais de ~2 s sem falar, o mestre trata as saídas dele como **desligadas** (bomba parada, resistência desligada).
- Atraso esperado em rede local: dezenas de milissegundos, bem abaixo do tempo do processo (o nível leva dezenas de segundos para variar).

## 3. Regra de quem escreve em quê (sem disputa)

| Grupo | Pode comandar | Recebe |
|---|---|---|
| **A** | Bomba/solenoide (Y2/Y1) e referência de velocidade (D1116) | Boias, nível (D1110), emergência |
| **B** | Resistência (Y0) | Temperatura (D1111), setpoint (D200), nível (D1110) e boia baixa (para não aquecer a seco), emergência |
| **C** (opcional) | Dreno (abertura) | Boias, nível (D1110) |

- O **mestre ignora** saídas fora da "posse" do grupo e avisa no painel do professor.
- **Emergência, erros de zero e abertura da porta** ficam só no mestre. Os sliders de erro ficam na área "Professor" do mestre.
- Os dois CLPs não disputam saída, porque cada saída tem um único dono.

## 4. Segurança e rede

- A ponte-mestre só deve ouvir na rede local, nunca na internet. Cada grupo recebe um **código curto** (ex.: A7K) que o cliente envia, para um grupo não se passar por outro.
- O Windows costuma abrir um aviso de firewall na primeira vez que o Node escuta na rede; em computador bloqueado pode ser preciso apoio do TI.

## 5. Teste mínimo antes de desenvolver (15 minutos)

1. No PC mestre, anote o IP (`ipconfig`, procure o "Endereço IPv4").
2. No mestre, abra um terminal na pasta do projeto e rode um servidor de teste: `node -e "require('http').createServer((q,r)=>r.end('ok')).listen(8780,'0.0.0.0')"`.
3. Em um PC de aluno, abra `http://IP-DO-MESTRE:8780` no navegador. **Aprovado** se mostrar "ok".
4. Se não abrir, teste a porta 80 ou 8080 (algumas redes só liberam essas). Se nenhuma abrir, a rede isola as máquinas (comum em Wi-Fi) ou o firewall bloqueia.
5. Meça o atraso: no PC do aluno, recarregue a página 10 vezes; deve responder quase instantâneo (< 100 ms).
6. Repita com os 2 ou 3 PCs ao mesmo tempo.
7. **Plano B** se a rede bloquear: um **roteador pequeno** só da turma (cabo ou Wi-Fi próprio), sem internet, ligando mestre e clientes.

## 6. O que seria desenvolvido (depois do teste passar)

- Modo mestre/cliente na ponte (um único `ponte.js` com parâmetro).
- Painel do professor com status de cada grupo (conectado, atraso, o que está comandando).
- Mapa de posse e falha segura no mestre.
- Opcional: modo visualização da página para os clientes.
