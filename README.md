# TASKFORCE Team Manager

## Auditoria e validação de autenticação

Consulte [a auditoria de 17/10/2026](docs/AUTH-AUDIT-2026-10-17.md) para achados,
configuração pendente de SMTP/Google e critérios de homologação antes de produção.
Execute os testes de fluxo com `node --test tests/auth.test.cjs` (Node.js 18+).
Os testes usam SDK/rede/DOM simulados e não enviam e-mails.

Aplicativo web responsivo para gerenciamento administrativo de equipes de Airsoft, pensado para uso no celular e no computador.

## Estado atual

Primeiro MVP estático publicado a partir do GitHub e preparado para o Cloudflare Pages.

## Módulos atuais

- Comando / visão geral
- Cadastro e ficha de operadores
- Dados de emergência e saúde
- Calendário de jogos
- Cadastro de campos com endereço e GPS
- Financeiro
- Documentos
- Contatos
- Cadastro da equipe
- Português, Español e English
- Tema escuro e claro

## Arquitetura

- **GitHub:** código-fonte e histórico
- **Cloudflare Pages:** publicação do front-end
- **Supabase:** autenticação, banco de dados, storage e regras de acesso

## Segurança

Dados pessoais e de saúde não devem ficar expostos. Na integração com Supabase serão aplicadas políticas de Row Level Security (RLS) e permissões por perfil.

Nunca coloque `service_role`, secret keys ou senhas no código público do navegador.

## Estrutura

- `index.html`
- `css/style.css`
- `js/app.js`
- `js/config.js`
- `js/translations.js`

## Próxima etapa

Conectar o MVP ao Supabase e substituir o armazenamento local por dados autenticados e protegidos.
