> **AVISO PARA A VERSÃO 4.1:** seu Supabase já está configurado. Não siga os passos de criação de projeto e execução do `supabase.sql` abaixo; use `COMECE-AQUI.md` para ativar a conta. Este documento é referência histórica da instalação manual.

# Logissa Redação v4 — Banco de dados na nuvem, sem terminal

Mantivemos o visual da v3, a logo e as páginas. Esta versão substitui `server.js` por **Supabase Auth + PostgreSQL**, administrados na nuvem. O `server.js` foi removido desta versão para evitar confusão.

## Configuração inicial (uma única vez)

1. Acesse https://supabase.com/ e crie um projeto gratuito (sujeito aos limites e preços vigentes).
2. No painel, abra **SQL Editor → New Query**. Copie o conteúdo INTEIRO de `supabase.sql`, cole e clique em **Run**. Isso cria planos, perfis, conteúdos e regras de permissão no banco.
3. No Supabase abra **Project Settings → API Keys** (ou **Connect**, conforme a interface). Copie a **Project URL** e a chave **publishable** (ou `anon` legada). Abra `config.js` no VS Code e substitua somente os dois campos. **Nunca cole a chave secret/service_role no HTML/JS!**
4. Em **Authentication → Providers → Email**, verifique se o login com e-mail e senha está ativo. Por padrão pode haver confirmação por e-mail. Confirme seu e-mail pelo link recebido. Em **Authentication → URL Configuration**, informe o endereço real onde vai testar/publicar (para desenvolvimento use o endereço servido pelo Live Server). Não use o arquivo aberto via `file://`.
5. Abra `index.html` usando a extensão **Live Server** do VS Code. Escolha um dos planos e crie SUA conta com seu Gmail e uma **senha nova** (não a senha que foi compartilhada no chat). O status ficará **pendente**, pois não há pagamento real.
6. Volte ao **SQL Editor**, rode este comando após substituir seu Gmail:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'seu_gmail@gmail.com';
   ```

7. Saia e entre novamente no site. O link **Administração** abre o painel. Administradores futuros devem ser promovidos por uma conta administrativa via função segura a desenvolver, ou inicialmente pelo SQL Editor.

## Como funciona

- **Visitantes** consultam o preço dos planos (R$200 mensal, R$180/mês semestral, R$160/mês anual).
- **Alunos** escolhem um plano, registram Gmail e senha e aguardam aprovação. Após verificar manualmente uma compra fictícia, o administrador edita o aluno e muda `pending` para `active` (com data de término atribuída).
- **Administradores** cadastram e editam conteúdos, planos e dados de assinatura usando o painel.
- **As permissões estão no banco via RLS**. Alterar JavaScript não concede acesso administrativo.
- **Login, contas e dados persistem** no Supabase entre dispositivos.

## Limitações importantes

- **Pagamento é simulado e NÃO desbloqueia acesso automaticamente.** Para pagamentos reais são necessários checkout e confirmação segura por webhook no servidor.
- **Cadastro de alunos pelo administrador** não está disponível diretamente no navegador: o aluno cria sua senha privadamente, depois o administrador ativa sua assinatura. A opção na tela informa isso. Criar contas de terceiros sem expor segredos exige uma Edge Function ou serviço seguro.
- **Excluir aluno** no painel significa **desativar sua assinatura**; a exclusão completa no Auth não é feita pelo browser. Isso evita tentar apagar usuários privilegiados sem autorização.
- **Arquivos TXT locais em `materiais/` são demonstrativos e públicos para quem conhece o link**. Materiais pagos reais devem ficar num bucket privado do Supabase Storage, com política de acesso ou URLs assinadas.
- **Não foi integrada cobrança real nem hospedagem**. Abra usando Live Server (sem executar comandos `node`). Para publicar, configure domínio, URL de redirecionamento, proteção de dados e política de privacidade.
- O período ativo é calculado de modo aproximado no protótipo (`30 dias × meses`); antes da venda, substitua por regras comerciais/calendário adequadas.

## Pastas

- `index.html` – interface original preservada.
- `style.css` – cores individualizadas da v2.
- `script.js` – funcionalidades conectadas ao Supabase.
- `config.js` – URL e chave **pública** do Supabase (não é senha).
- `supabase.sql` – tabelas, planos, permissões e registros demonstrativos.
- `materiais/` – arquivos demonstrativos.

## Segurança

Não compartilhe senhas. Uma senha enviada em capturas ou mensagens anteriores deve ser trocada. O `SQL Editor` é a única etapa técnica inicial para dar privilégios ao primeiro administrador, pois permitir que qualquer Gmail se torne administrador automaticamente criaria uma falha grave de segurança.