# TaskForce — Administração simplificada

Frontend independente, preparado para publicação em Wix Headless. Mantém o banco Supabase existente. A página antiga na raiz do repositório permanece preservada.

## Funcionalidades
- Início com próximo compromisso e resumo financeiro.
- Operadores cadastrados diretamente por administradores, sem criar contas de autenticação.
- Fichas de emergência, edição e arquivamento reversível.
- Agenda com campos existentes, lista de participantes e histórico.
- Mensalidades por operador e mês, geração sem duplicar, registro de pagamento, valor e Pix.
- Login restrito a membros cuja função é `admin`; não há cadastro público nem convites.
- Manifesto e service worker para instalação. Somente arquivos públicos do app são armazenados no cache; respostas do Supabase nunca entram nele.

## Banco
A extensão de banco está em `database/admin-only-finance.sql`, já aplicada ao projeto original em 04/11/2026. Não reaplicar cegamente: a criação da tabela não é idempotente.
A tabela `team_admin_fees` tem RLS para administradores da equipe. Os operadores e anônimos não podem ler ou escrever. As tabelas antigas e os registros existentes permanecem intactos.

Dados de operadores antigos são lidos por `admin_list_members`. Alterações administrativas ficam em `team_operator_records`, sem alterar credenciais ou o perfil de login antigo.
Mensalidades antigas são mostradas e contam uma única vez, mesmo se existir uma cobrança correspondente na nova tabela. A data do comprovante legado é somente leitura; a confirmação usa a rotina original.
Os acessos e as políticas da versão antiga ainda existem. O novo frontend não modifica contas antigas nem revoga sessões.

## Publicação no Wix
Publicar os arquivos de `admin-app/` como raiz de um frontend Wix Headless. Não enviar `README.md`, `package.json`, arquivos de testes ou a pasta `vendor/` local.
Este pacote não converte automaticamente um site de Editor Wix; confirmar a configuração Headless antes de enviar. O destino autorizado é o site `4f6bf807-66e1-4aab-83a1-93449b3e47bb`.
O SDK Supabase usa versão 2.119.0 fixa, com SRI SHA-384 e CORS.
A recuperação de senha abre a URL já existente do TaskForce; trocar `config.js` e a lista de redirects do Supabase somente quando a URL Wix estiver definida.
Depois da publicação, testar login de administrador real, bloqueio de operador, cadastro e pagamento em ambiente de validação, instalação Android/iOS e layout em 390px e desktop.
Não há senha de teste, tokens administrativos ou credenciais secretas neste pacote.

## Testes
Testes de lógica e DOM: `tests/admin-app-core.cjs`, `tests/admin-app-flows.mjs`, `tests/run-admin-tests.mjs`.
A instalação de dependências de desenvolvimento é opcional para o frontend, que funciona sem build.
Executar na pasta `admin-app`: `npm install`, depois `npm test`.
Os testes de DOM simulam o Supabase; não substituem o teste de login e layout na versão publicada.
Os testes de RLS foram feitos em uma transação com rollback: admin cria/lê/atualiza na própria equipe; outra equipe e operador são bloqueados.
