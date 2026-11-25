# Integração da bancada 3D ao portal EducaWEB (plano, 25/11/2026)

Só planejamento. Nada foi alterado no portal nem na bancada por causa deste plano.

## Decisão
Colocar a bancada **dentro do mesmo domínio** do portal (https://educaweb.online/), como 4º simulador, em uma pasta `NivelWEB/` do repositório do portal, no mesmo padrão das outras três (`ComandoWEB/`, `HidraulicaWEB/`, `PneumaticaWEB/`, cada uma com o próprio `index.html`). O card novo da página inicial aponta para `NivelWEB/index.html`.

Por que assim: a bancada é HTML/JS estático (33 arquivos, ~5 MB sem o `node.exe`), usa nomes globais (`App3D`, `PLC`, `ISP`, `DRV`, `MD`) e chaves próprias (`nivel-*` no localStorage, `nivel-isp-cfg-v4` no sessionStorage). Em pasta própria não conflita com os outros simuladores e continua dando para evoluir/publicar separado.

## Como o portal está montado (lido da página pública em 25/11/2026)
- Página inicial com `<nav class="paineis" id="simuladores">` e 3 cards `<a class="painel" href="…/index.html" style="--cor:#…" data-i="0|1|2">`.
- Cores: Comando #ee7a10, Hidráulica #c0392b, Pneumática #2f7fe0 (a bancada precisa de uma cor própria; sugestão: verde-azulado #2E8B7A, já usado na aba Bancada 3D).
- Estrutura de cada card: `.foto.papel` (SVG animado de fundo), `.ruido`, `.veu`, `.icone` (SVG), `.vertical` (rótulo + `<small>` com o nome), `.info` (`.tipo`, `h2`, `p.anim[data-txt]` com texto digitado, `.linha` com `.abrir` e `.chip`s).
- Acordeão: largura animada por `--fech` / `--aberto` (provavelmente calculadas para 3 painéis) e atraso de entrada por `:nth-child(n)` (.45s, .55s, .65s).
- Também mencionam os 3 simuladores: título "Comandos elétricos, hidráulica e pneumática" (h1), `<title>`, `description`, `og:*`, `twitter:*` e o JSON-LD (um `WebApplication` por simulador).
- Fontes: Archivo + IBM Plex Mono. Tema claro/escuro (botão Tema). Botão "Reportar erro" leva a um Google Forms.
- O HTML publicado é gerado (imagens embutidas em base64). Trabalhar no código-fonte/repositório do portal, não editar o arquivo publicado.

## O que fazer no portal (quando for a hora)
1. Branch separado no repositório do portal; nada direto na principal.
2. Criar `NivelWEB/` com a bancada (ver "Limpeza").
3. Card novo (4º) seguindo as regras dos outros: SVG de fundo (tanque + bomba + água subindo), ícone, rótulo vertical "Controle de nível / NívelWEB" (nome a decidir), texto digitado, chips (sugestão: "CLP Delta DVP20SX2", "ISPSoft", "Modbus", "3D").
4. Ajustar: `--fech`/`--aberto` para 4 painéis, `:nth-child(4)` (atraso .75s), h1/meta/og/twitter para citar controle de nível, novo `WebApplication` no JSON-LD, sitemap/robots se existirem.
5. Conferir em celular (o acordeão em tela estreita) e nos temas claro/escuro.
6. Só publicar depois de o Lucas aprovar o visual.

## Cuidados técnicos da bancada dentro do domínio
- **Ponte local:** a página em `https://educaweb.online/NivelWEB/` fala com `http://localhost:8765` (BASE em `modo-ispsoft.js`; a ponte responde `Access-Control-Allow-Private-Network`). AINDA NÃO TESTADO de ponta a ponta (domínio -> ponte -> ISPSoft). O Chrome pode pedir "permissão de rede local". Testar antes de integrar.
- Caminhos: tudo é relativo (`vendor/…`, `app-*.js?v=BUILD`); funciona em subpasta. Conferir o `?v=` de cache ao publicar.
- localStorage/sessionStorage ficam por origem: no mesmo domínio, as chaves `nivel-*` não colidem com as dos outros simuladores, mas vale conferir se algum deles usa o mesmo prefixo.
- Tema: a bancada tem identidade EducaWEB própria (tinta #0F2236, laranja #EE7A10, névoa #F5F6F8); ver se o botão Tema do portal deve afetar a bancada (hoje não).

## Limpeza antes de subir
- `assets/contator-trifasico.png` e `assets/rele-interface.png` (1,7 MB cada) não são mais carregados desde o BUILD 29 (viraram geometria 3D): confirmar com busca e remover.
- Apagar `zz_*.html` temporários; `node.exe` já fica fora do git (.gitignore).
- Decidir o que vai para `NivelWEB/`: só o necessário para rodar a página (index, app-*.js, modo-*.js, painel-clp.js, vendor/, favicon). Ponte (`ponte.js`, .bat/.vbs, README da ponte) é do aluno/professor: avaliar disponibilizar como download à parte ou página de instruções.

## Pendências relacionadas (da bancada)
- Testar a conexão real domínio -> ponte -> ISPSoft.
- Ideias do Lucas para testar antes (a anotar amanhã).
- Canaletas do quadro ainda não aprovadas (ver CLAUDE.md).
- Commit local atual: 4b5d803 (BUILD 20261125-111); nada enviado ao GitHub desde 1b0d012.

## Atualização (25/11/2026, noite): teste real e ordem de trabalho
- **Teste feito pelo Lucas:** a bancada hospedada no navegador iniciou a ponte local, comunicou com o CLP (ISPSoft) e funcionou. Isso resolve a pendência "domínio -> ponte -> ISPSoft" para o endereço de teste do Vercel; repetir quando estiver em `educaweb.online/NivelWEB/`.
- **Ordem combinada:** amanhã o Lucas faz mais testes na bancada e voltamos a planejar. Se a funcionalidade de salas (abaixo) for muito complexa, vai-se ao portal assim mesmo com a bancada atual e as melhorias entram depois, com git só na pasta da bancada (ela continua sendo um repositório próprio; no portal só se copia a versão aprovada para `NivelWEB/`).
- **Nada a alterar por enquanto:** o projeto está estável; não mexer até o próximo planejamento.

## Ideia futura: salas com vários grupos e painel do professor (escopo do Lucas, 25/11/2026)
Escopo: o professor fica com o computador na mesa principal, com a bancada aberta (projetor). Alunos entram no portal, na bancada 3D, divididos em grupos: um programa só o **controle de nível**, outro o de **temperatura**, outro o de **pressão ou vazão**. Cada grupo simula no seu CLP/ISPSoft. Ao "submeter", o programa do grupo passa a atuar na bancada do professor, e no fim os três controles rodam juntos na mesma bancada para verificar se tudo funciona. O professor, e só ele, pode colocar/tirar defeitos, desajustar sensores (para os alunos calibrarem), etc. Os alunos não veem isso; só percebem ao testar o programa na bancada do professor.

Avaliação: **viável**, mas exige um servidor de tempo real (o portal é estático) e um mínimo de contas.
- **Servidor:** serviço de tempo real externo (Supabase Realtime ou Firebase; plano gratuito atende uma turma). Vercel sozinho não mantém conexões longas.
- **Contas:** só o professor precisa de login. Alunos entram com **código da sala + nome do grupo** (sem dados pessoais). O servidor só aceita comandos de defeito/calibração do papel professor.
- **Como submeter (duas opções):**
  1. Enviar o arquivo do projeto ISPSoft; o professor o abre no próprio ISPSoft. Simples, manual; o ladder só roda no simulador do ISPSoft (Windows). Rodar no navegador exigiria o interpretador interno (`app-clp.js`) entender o ladder exportado (subconjunto de instruções).
  2. **Recomendada:** a ponte de cada aluno passa a falar com a **bancada do professor** (dona da simulação) em vez da local; entradas/saídas dos 3 CLPs conversam com ela ao vivo. Sem trocar arquivo; o professor liga/desliga cada grupo e vê os 3 controles juntos. Alunos testam localmente sem defeitos; os defeitos só existem na bancada do professor.
- **Desenho prévio:** `PROJETO-VARIOS-COMPUTADORES.md` (modo mestre/escravo na rede); comparar com este plano.
- **O que resolver:**
  - **Dono de cada saída** (ex.: nível = bomba/dreno; temperatura = resistência; vazão/pressão = velocidade do inversor), senão dois programas disputam a mesma saída.
  - **Vazão/pressão** foram removidas do projeto (só nível e temperatura existem): refazer o 3º sensor e a física.
  - **Ponte do aluno** hoje fala com a simulação local; no modo sala fala com o servidor (mais atraso, aceitável para nível/temperatura).
  - **Computador do professor:** a simulação roda no navegador dele; a aba não pode ficar em segundo plano/dormindo.
  - **Rede da escola** pode bloquear conexões em tempo real; permissão de rede local do navegador.
- **Etapas sugeridas:** (1) sala com código, bancada do professor como dona, ponte de 1 aluno conectada (validar com 2 computadores reais: rede, atraso, permissão); (2) 3 alunos ao mesmo tempo, saídas por grupo e painel de status do professor; (3) painel de defeitos e calibração só do professor; (4) histórico/checklist por atividade; (5) contas reais só se quiserem guardar resultados por aluno.
