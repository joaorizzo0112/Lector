<h1><img src="./icons/icon-192.png" alt="Ícone do LECTOR" width="44"> LECTOR</h1>

[![Linguagem: JavaScript](https://img.shields.io/badge/LANGUAGE-JavaScript-F7DF1E?style=flat-square&labelColor=353535)](https://developer.mozilla.org/docs/Web/JavaScript) ![Frontend: HTML5 e CSS3](https://img.shields.io/badge/FRONTEND-HTML5%20%26%20CSS3-3776AB?style=flat-square&labelColor=353535) ![Plataforma: Web / PWA](https://img.shields.io/badge/PLATFORM-Web%20%2F%20PWA-4472C4?style=flat-square&labelColor=353535) [![Licença: MIT](https://img.shields.io/badge/LICENSE-MIT-4C9A2A?style=flat-square&labelColor=353535)](LICENSE) ![Formatos: EPUB, PDF, CBZ, TXT](https://img.shields.io/badge/FORMATS-EPUB%20%7C%20PDF%20%7C%20CBZ%20%7C%20TXT-7952B3?style=flat-square&labelColor=353535)

**Aplicação web para leitura digital, organização de bibliotecas pessoais e acompanhamento de hábitos de leitura.**

O Lector é um projeto de leitor digital desenvolvido como uma *Progressive Web App* (PWA). Reúne recursos de leitura, gestão de acervo e acompanhamento de progresso em uma interface responsiva e personalizável, priorizando o controle dos dados pelo usuário.

## Funcionalidades

### Biblioteca digital

- Importação e leitura de arquivos EPUB, PDF, CBZ e TXT.
- Organização de livros em estantes e favoritos.
- Pesquisa, filtros e ordenação do acervo.
- Capas, informações dos livros e acompanhamento individual de progresso.
- Acesso rápido às leituras em andamento e aos títulos recentes.

### Leitura e anotações

- Retomada da posição de leitura.
- Marcadores, destaques e anotações.
- Ajustes de visualização de acordo com o formato.
- Pesquisa no conteúdo, conforme os recursos disponíveis para cada arquivo.
- Vocabulário pessoal com revisão e exportação.

### Interface e personalização

- 25 temas de interface, com modos claro, escuro e automático.
- Ajustes de tipografia, aparência e acessibilidade.
- Layout adaptado a computadores, tablets e smartphones.
- Perfis locais com personalização de avatar.

### Estatísticas e gerenciamento de dados

- Metas, histórico de atividade e estatísticas de leitura.
- Armazenamento local de livros e preferências.
- Exportação e restauração de backups.
- Lixeira com possibilidade de recuperação.
- Sincronização opcional de progresso e metadados por meio do Supabase.
- Recursos PWA de instalação e funcionamento offline.

## Tecnologias

| Tecnologia | Aplicação |
| --- | --- |
| HTML5 | Estrutura da interface |
| CSS3 | Temas, estilização e responsividade |
| JavaScript | Lógica e interações |
| IndexedDB e Web Storage | Persistência local |
| Service Worker e Web App Manifest | Recursos PWA e cache offline |
| PDF.js | Renderização de PDFs |
| EPUB.js | Leitura de EPUBs |
| JSZip | Processamento de arquivos compactados |
| Supabase | Autenticação e sincronização opcionais |

## Arquitetura

O projeto mantém HTML, CSS e JavaScript separados e organiza os arquivos por responsabilidade funcional, favorecendo a manutenção e a evolução do código.

```text
Lector/
├── css/
├── icons/
├── js/
├── libs/
├── index.html
├── manifest.json
├── offline.html
└── sw.js
```

## Privacidade e persistência

O Lector prioriza o armazenamento local: os arquivos dos livros permanecem no dispositivo. A integração com o Supabase é opcional e utilizada para sincronizar informações compatíveis com esse recurso.

A persistência local depende das condições de armazenamento do navegador. Por isso, o projeto inclui mecanismos de backup e restauração.

## Autoria

Desenvolvido e mantido por **[@joaorizzo0112](https://github.com/joaorizzo0112)**.

As bibliotecas de terceiros permanecem sujeitas às licenças dos respectivos autores. O projeto não distribui obras protegidas por direitos autorais.
