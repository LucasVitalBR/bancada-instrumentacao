# Sistema de Esteiras Industriais

Protótipo 3D didático inspirado na imagem de referência. É um projeto separado do simulador de nível.

## Abrir

Abra `index.html` diretamente no navegador. O simulador usa a cópia local do Three.js em `../vendor/three-bundle.js`, sem dependências de instalação. Também pode ser servido por HTTP a partir da pasta principal do projeto em `/esteiras-industriais/`.

## Controles do protótipo

- **Iniciar linha / Parar linha** anima as caixas e indica o estado das esteiras.
- **Emergência** interrompe a movimentação; pressione novamente para liberar.
- **Velocidade** ajusta a velocidade visual das caixas.
- **Manual / Automático** alterna a demonstração do desviador.
- Arraste na cena para orbitar a câmera, use a roda para aproximar e clique em uma caixa para identificá-la.

O estado **OFFLINE** do CLP é intencional neste protótipo visual. A comunicação com CLP/ISPSoft, lógica real de classificação e endereçamento de entradas e saídas são etapas futuras.
