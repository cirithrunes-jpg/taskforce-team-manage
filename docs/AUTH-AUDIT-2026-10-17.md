# TASKFORCE — auditoria de autenticação

Data: 17/10/2026. Base auditada: `0003b1163ebc68753ef9b55f171e07239ede22b3`.
Projeto: `taskforce-manager` (`eqonbegeyzvbszrgdyut`).

## Resultado e limites

As correções estão em uma branch de revisão. Nenhuma configuração de produção,
permissão, conta, equipe ou dado foi alterado nesta auditoria. Não houve envio de
e-mails nem login em contas reais. O código e os SQLs propostos precisam passar
por homologação antes de merge/deploy ou execução no banco.

## Achados confirmados

| Prioridade | Achado | Correção / situação |
| --- | --- | --- |
| Alta | `auth-clean.js`, carregado pelo `index.html`, removia o fragmento de confirmação/OAuth, com `detectSessionInUrl:false`, sem consumir a sessão. | Callback unificado consome tokens ou código antes de limpar a URL; erros são exibidos. |
| Alta | `installDialogSafety()` chamava `$("dialog").forEach`, mas `$` retorna um elemento. A exceção interrompia o restante de `app.js`. | Corrigido para `$$("dialog")`; teste de Escape, botão e fundo do diálogo. |
| Alta | Google está desativado no endpoint público `/auth/v1/settings`. | Implementado `signInWithOAuth`; botão aparece somente quando o servidor informa que o provedor está ativo. Credenciais externas ainda pendentes. |
| Alta | Não havia reenvio de confirmação no fluxo ativo. | Formulário de reenvio, preservando convite e sem afirmar que uma conta existe. |
| Média | Recuperação aceitava sessão comum existente quando o link não tinha tokens/código. | Exige callback válido e preserva convite após a troca de senha. |
| Média | Chamadas REST usavam uma cópia da sessão que não acompanhava a renovação do token. | `onAuthStateChange` sincroniza a sessão usada pelo REST. |
| Média | 19 funções `SECURITY DEFINER` públicas têm EXECUTE para `anon`. | Há verificações internas de usuário/equipe nas funções revisadas; o alerta não comprova vazamento. Proposta de retirada dos grants anônimos em `db/review`, sem execução em produção. |
| Média | RPC legado `create_team` chama `private.create_team`, que não tem as verificações de revogação e equipe única presentes em `create_team_v2`. | Pendência de endurecimento; manter compatibilidade ao delegar a rotina antiga para a nova, com testes em homologação. |
| Média | `private.manage_member` não valida que `new_group` pertence à equipe; overload antigo de `create_invitation` não faz essa validação nem limita `use_limit`. | Revisar constraints e chamadas legadas antes de alterar; não aplicado. |
| Média | Proteção de senhas comprometidas está desativada, segundo o advisor. | Avaliar habilitação conforme disponibilidade do plano. |

Todas as 25 tabelas públicas têm RLS. Sete não têm políticas diretas: isso pode
ser intencional porque o acesso passa por RPCs; não abrir essas tabelas para
eliminar o aviso. As funções privilegiadas revisadas têm `search_path` explícito.
Não foi encontrada autorização baseada em `user_metadata` nas funções coletadas.
Não foi identificada chave `service_role` no cliente; a chave usada é pública.

## Entrega de e-mail: diagnóstico ainda incompleto

O endpoint público confirma `email:true`, cadastro habilitado e
`mailer_autoconfirm:false`: confirmar o e-mail é obrigatório. Há quatro usuários,
todos confirmados, e três com login anterior. Isso não comprova entrega de mensagens.

As ferramentas conectadas não oferecem leitura/edição da configuração privada de
Auth/SMTP. Não é possível afirmar se SMTP próprio já está configurado. O stream
de logs disponível no momento continha somente Postgres e PgBouncer; a tabela
`auth.audit_log_entries` estava vazia. Não houve evidência histórica suficiente
para atribuir a falha de envio a um provedor específico.

Segundo a documentação oficial, o SMTP padrão restringe destinatários aos membros
autorizados da organização e não é indicado para produção. Se for o serviço em
uso, é uma hipótese forte para o bloqueio relatado, a confirmar no painel.

### Configuração necessária para entrega confiável

1. Abrir [SMTP do projeto](https://supabase.com/dashboard/project/eqonbegeyzvbszrgdyut/auth/smtp)
   e verificar se há SMTP próprio, remetente e provedor.
2. Configurar SMTP transacional de um provedor com domínio de envio verificado.
   Host, porta, usuário, senha e endereço From precisam vir da conta do provedor.
   Não colocar esses segredos no GitHub nem no JavaScript.
3. Validar SPF, DKIM e DMARC do domínio e desativar rastreamento de links no provedor.
4. Conferir templates de confirmação e recuperação usando `{{ .ConfirmationURL }}`.
5. Conferir limites de envio e logs de entregas, bounces e rejeições no provedor.
6. Em [URLs de Auth](https://supabase.com/dashboard/project/eqonbegeyzvbszrgdyut/auth/url-configuration),
   verificar Site URL `https://taskforce-team-manage.pages.dev` e permitir os
   retornos de confirmação, convite e recuperação, inclusive suas query strings.
   Testar explicitamente `/?invite=...` e `/?invite=...&recovery=1`; restringir
   padrões ao domínio esperado. Não liberar domínios arbitrários de preview.
7. Manter confirmação obrigatória: o vínculo por convite depende de e-mail
   confirmado e correspondente ao destinatário.

## Ativação do Google

1. No Google Auth Platform, configurar marca TASKFORCE, público e escopos básicos
   `openid`, e-mail e perfil; obter OAuth Client ID e Client Secret de aplicação web.
2. Origem autorizada: `https://taskforce-team-manage.pages.dev`.
3. Callback autorizado no Google:
   `https://eqonbegeyzvbszrgdyut.supabase.co/auth/v1/callback`.
4. Inserir Client ID e Secret somente no [provedor Google do Supabase](https://supabase.com/dashboard/project/eqonbegeyzvbszrgdyut/auth/providers?provider=Google)
   e habilitá-lo. A conexão atual não expõe essa operação.
5. Testar criação, conta já existente com mesmo e-mail e convite restrito a e-mail.
   Conferir se o usuário mantém UUID, dados e vínculo existentes; não fazer união
   manual de contas nem conceder cargos a partir de metadados do Google.

## Validação executada

- `node --test tests/auth.test.cjs`: 14 testes passaram. São testes com doubles do
  DOM, SDK e rede; cobrem callbacks implícitos/PKCE, erros, reenvio, senha, Google,
  convite preservado, token renovado e diálogos. Não equivalem a testes reais de
  entrega ou consentimento Google.
- `node --check` em todos os arquivos JavaScript de `js/` e `control/`: passou.
- Leitura transacional de permissões/RLS no banco atual: anônimo recebeu
  `permission denied` em perfis; usuário autenticado sem equipe viu zero perfis,
  equipes e recursos; operador viu zero perfis de terceiros, zero outras equipes,
  lista administrativa vazia e nenhum overview de plataforma. Usados somente
  SELECT/SET LOCAL com rollback, sem alterar registros.
- Advisor de segurança consultado. Os SQLs de revogação/retorno estão apenas
  preparados para revisão; não foram executados ou validados como migração.
- Tentativa de preparar navegador de testes foi bloqueada por download inválido
  do Chromium. A revisão visual e os testes em navegador/dispositivos seguem pendentes.

## Homologação obrigatória antes da produção

Usar Supabase de teste e `config.js` de teste com `appUrl` apontando para a própria
homologação. Um preview com a configuração atual continua apontando para o banco e
retorno de produção; não presumir isolamento por estar em outra branch.

| Cenário | Resultado esperado | Estado |
| --- | --- | --- |
| Cadastro em Gmail e outro provedor | Receber e confirmar; concluir perfil | Pendente de SMTP/teste real |
| Reenvio e link vencido | Novo link funciona; antigo mostra erro útil | Fluxo simulado passou; entrega pendente |
| E-mail/senha correto e incorreto | Entrar ou explicar erro sem expor conta | Fluxo simulado passou; integração pendente |
| Google novo e existente | Consentimento, callback, perfil e mesmo vínculo | Fluxo simulado passou; ativação pendente |
| Convite operador/admin | Respeitar destinatário, grupo, papel, expiração e uso | Preservação no cliente passou; RPC ponta a ponta pendente |
| Recuperação | Receber link, trocar senha e entrar novamente | Fluxo simulado passou; entrega pendente |
| Outro navegador/dispositivo | Confirmar e recuperar sem depender de sessão anterior | Pendente |
| Isolamento entre equipes | Impedir leituras/escritas e ações administrativas cruzadas | Leituras selecionadas passaram; escritas pendentes |
| RPCs endurecidas | Anônimo negado, usuário autorizado funciona | SQL de revisão, não aplicado |

## Web, Android e iPhone

O repositório atual é uma aplicação web estática; não contém projeto Android/iOS,
Capacitor, manifesto PWA ou service worker. A auditoria de sintaxe incluiu todos os
scripts atuais, mas não atesta a saúde funcional de todos os módulos.

Ordem de continuidade:

1. Concluir SMTP/Google e a matriz acima em homologação.
2. Homologar equipe, operadores, perfis/emergência, agenda, campos, financeiro,
   comprovantes, documentos/termos, contatos, news, suporte e Control, com papéis
   distintos. Revisar Storage e RPCs legadas, incluindo permissões de escrita.
3. Preparar manifesto e ícones de instalação. Se adicionar service worker, evitar
   cache de respostas de Auth, API e informações pessoais/emergência.
4. Escolher empacotamento Android/iOS após confirmar os requisitos de recursos
   nativos. Para wrapper nativo, implementar retorno OAuth por links verificados,
   navegador de sistema e armazenamento de sessão apropriado; não presumir que o
   callback web funcione automaticamente no aplicativo.
5. Gerar builds assinados e testar em Android/iPhone reais; preparar contas de
   desenvolvedor, identidade do aplicativo e requisitos das lojas antes de publicar.

Nenhum APK, AAB ou IPA foi gerado; nenhuma versão móvel está pronta para publicação.

## Fontes oficiais consultadas

- [SMTP e restrições do remetente padrão](https://supabase.com/docs/guides/auth/auth-smtp)
- [Login com Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Senha, confirmação e recuperação](https://supabase.com/docs/guides/auth/passwords)
- [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls)
- [Advisor: funções privilegiadas acessíveis por anônimos](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Advisor: tabelas com RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Senhas comprometidas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Changelog: retirada futura de cifras TLS antigas](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
  consultado; não exige mudança no fluxo web moderno desta correção.
