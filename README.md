# Controle de Nível Simples · EducaWEB

Simulador didático 3D de controle de nível e temperatura (tanque, bomba, boias, resistência, PT100, inversores) para programar o CLP Delta DVP20SX2 no ISPSoft.

## Usar só o simulador
Abra a página hospedada (ou `index.html`). O modo **Simular sem programa** funciona sozinho, sem instalar nada.

## Testar com o ISPSoft (Comunicação - CLP)
A página não fala direto com o ISPSoft; ela usa a **Comunicação - CLP** (`ponte.js`), que roda no computador de quem está programando (Windows 64 bits).

1. Primeira vez em cada usuário do Windows: na aba **CLP**, clique em **Instalar ou reparar a Comunicação - CLP**, abra o arquivo baixado e espere a confirmação.
2. No ISPSoft, ative a simulação com o driver **Simulator** do COMMGR e use na página a mesma porta.
3. Na **Bancada 3D**, clique em **Montar automaticamente**.
4. Na aba **CLP**, confira o mapa de E/S e clique em **Conectar ao ISPSoft**. A comunicação inicia por esse botão (não inicia junto com o Windows).

O instalador é gerado por `node instalador/gerar.js` (rode sempre que mudar `ponte.js`). Só os sites do projeto podem enviar comandos; outro endereço pode ser incluído em `origens.txt`, na pasta instalada.

## Arquivos
`index.html` (interface), `app-3d.js` (cena e processo), `modo-direto.js`, `modo-ispsoft.js`, `ponte.js`, `app-drives.js`/`app-pf525.js` (inversores), `vendor/` (three.js e imagens).

Idealizado por Lucas Ferreira Vital e Ederson Ivan Cardoso; desenvolvido por Lucas Ferreira Vital.
