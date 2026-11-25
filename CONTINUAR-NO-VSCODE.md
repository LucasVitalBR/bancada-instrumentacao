# Continuidade do projeto no VS Code

Este arquivo reúne o contexto necessário para retomar o **Controle de Nível Simples** em outra sessão ou diretamente no VS Code.

## Projeto

Simulador didático 3D de controle de nível com tanque, bomba, dreno, boias, resistência e PT100. Tem simulação sem programa, modo CLP com inversores e integração com ISPSoft/COMMGR por uma ponte local Modbus ASCII/TCP.

## Estado atual

- Build atual: `20261119-35` (`const BUILD` em `index.html`).
- A bancada 3D está funcional; a interface atualmente expõe a aba **Bancada 3D**.
- Os modos sem programa, CLP e ISPSoft, a montagem automática e a vista lado a lado estão implementados.
- A ponte ISPSoft é servida em `http://localhost:8765` por `ponte.js`.
- Leia `HISTORICO.md` somente quando precisar dos detalhes de alterações anteriores.
- **Há trabalho local sem commit.** Ao iniciar, confira `git status` e preserve as alterações existentes. Não reverta nem faça commit delas sem combinar a etapa com Ederson.

## Abrir e executar

1. No VS Code, abra esta pasta do projeto (`controle-nivel-simples`).
2. Para ver a simulação, use o servidor local da porta 8765 se ele já estiver rodando. Não inicie outra cópia do servidor.
3. Se precisar iniciar a ponte, execute `INICIAR-PONTE.bat` na pasta do projeto. Ela abre `http://localhost:8765` e executa `ponte.js`, usando o `node.exe` portátil quando presente ou o Node instalado.
4. Para integração com ISPSoft, configure o COMMGR/DVPSimulator conforme `CLAUDE.md` e conecte pelo painel ISPSoft da aplicação.

## Arquivos principais

- `index.html`: interface, carregamento dos scripts e identificador de build/cache.
- `app-3d.js`: cena, controles 3D, tanque e simulação do processo.
- `app-clp.js`: CLP interno e exemplos de lógica.
- `modo-direto.js`: botoeiras, selo e lógica de comando sem programa.
- `modo-ispsoft.js`: painel, mapeamento de E/S e comunicação com ISPSoft.
- `ponte.js`: servidor local e comunicação Modbus com o simulador Delta.
- `app-drives.js`, `app-pf525.js`: modelos e comportamento dos inversores.
- `CLAUDE.md`: especificação de trabalho, regras, arquitetura e mapa de sinais.
- `HISTORICO.md`: registro cronológico das etapas concluídas.

## Orientações para continuar

- Antes de editar, leia `CLAUDE.md` e confira `git status`/`git diff` para entender o trabalho já iniciado.
- Não leia `app-3d.js` nem `index.html` por inteiro. Localize funções com `rg -n` e leia apenas os trechos relevantes.
- Faça alterações pequenas e mantenha o incremento de `const BUILD` em `index.html` ao mudar a aplicação.
- Depois de alterações JavaScript, valide a sintaxe com `node --check` nos arquivos modificados.
- Registre a etapa concluída em `HISTORICO.md`; faça commit somente ao fechar uma etapa.
- Não altere o projeto antigo da Bancada de Instrumentação. Este repositório é separado.

## Contexto de hardware e sinais

Mapa de E/S e configuração padrão do ISPSoft estão em `CLAUDE.md`. Em resumo: `Y0` aciona bomba/marcha, `Y4` resistência, `X7` indica falha do inversor, `D1111` transporta a temperatura do PT100 e `D1116` a referência de velocidade. Consulte o guia antes de alterar endereços: o mapa pode ser configurado pelo usuário.

## Próxima tarefa

Ainda não foi definida no registro atual. Combine com Ederson qual ajuste ou funcionalidade será a próxima etapa antes de fazer mudanças no simulador.
