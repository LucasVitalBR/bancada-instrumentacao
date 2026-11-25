# Controle de Nível Simples · EducaWEB

Simulador didático 3D de controle de nível e temperatura (tanque, bomba, boias, resistência, PT100, inversores) para programar o CLP Delta DVP20SX2 no ISPSoft.

## Usar só o simulador
Abra a página hospedada (ou `index.html`). O modo **Simular sem programa** funciona sozinho, sem instalar nada.

## Testar com o ISPSoft (ponte local)
A página não consegue falar direto com o ISPSoft; ela usa uma pequena **ponte** (`ponte.js`, Node) que roda no computador de quem está programando.

1. Instale o [Node.js](https://nodejs.org) (ou coloque um `node.exe` na pasta).
2. Baixe esta pasta e dê dois cliques em `INICIAR-PONTE.bat` (abre a página e inicia a ponte).
   - Para a ponte iniciar sozinha, execute `REGISTRAR-INICIO-AUTOMATICO.bat` uma vez; depois o botão **ISPSoft + inversor** da página inicia a ponte em segundo plano.
   - `PARAR-PONTE.bat` encerra a ponte.
3. No ISPSoft, ative a simulação com o driver **Simulator** do COMMGR (porta 10004).
4. Na página, abra a aba **CLP**, preencha o mapa de E/S e clique em **Conectar ao ISPSoft**.

A página hospedada fala com a ponte em `http://localhost:8765` (no computador do aluno). Se o navegador pedir permissão para acessar a rede local, permita.

## Arquivos
`index.html` (interface), `app-3d.js` (cena e processo), `modo-direto.js`, `modo-ispsoft.js`, `ponte.js`, `app-drives.js`/`app-pf525.js` (inversores), `vendor/` (three.js e imagens).

Idealizado por Lucas Ferreira Vital e Ederson Ivan Cardoso; desenvolvido por Lucas Ferreira Vital.
