# Validação — 04/11/2026

- Projeto Supabase original confirmado: taskforce-manager, ativo.
- Identificados dois administradores com e-mail já confirmado.
- Registros anteriores preservados: 2 recursos, 0 registros manuais e 0 mensalidades.
- Extensão team_admin_fees aplicada. RLS ativa; anon não tem SELECT.
- Teste transacional real: administrador insere, lê e atualiza na própria equipe; inclusão em outra equipe negada; operador lê zero linhas e não pode inserir. Rollback executado; nenhum registro de teste permanece.
- 10 verificações de lógica: datas de fevereiro bissexto e não bissexto, mês inválido, fuso São Paulo, centavos sem erro de soma, isenções, escape HTML, junção de cadastro legado com sobreposição administrativa.
- 8 testes de DOM com respostas de servidor simuladas: visitante bloqueado, operador bloqueado, erro de conexão mantém painel fechado, administrador vê quatro módulos e dados escapados, cadastro manual sem conta, geração repetida sem duplicação, pagamento, limpeza dos dados ao sair.
- Sintaxe JavaScript verificada para app, core, config e service worker.
- SDK 2.119.0 fixo com SRI SHA-384.
- Publicação Wix e inspeção visual em navegador: pendentes. A sessão do navegador integrado retornou "browser.user is unavailable"; a tentativa de reconexão expirou.
- Não foi testado login real com a senha do usuário, instalação em aparelhos ou layout renderizado.
- Não foram removidas as contas, sessões e políticas da versão antiga; o novo painel recusa operadores e as cobranças novas são exclusivas de administradores no banco.
