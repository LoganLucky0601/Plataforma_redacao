# Logissa Redação v4.1 — Conexão com o Supabase já preenchida

A interface e as funcionalidades visuais da versão 4 foram preservadas. O arquivo `config.js` já possui a URL e a chave **pública** do seu projeto Supabase. Você não precisa executar `node server.js`, instalar pacotes ou rodar novamente o `supabase.sql`.

## Como cadastrar o primeiro administrador

1. No VS Code, abra `index.html` com **Open with Live Server**.
2. Na Logissa, entre em **Planos**, escolha um plano de demonstração e preencha o cadastro com o Gmail que será administrador. Não haverá cobrança de verdade.
3. Se o Supabase pedir, confirme o cadastro pelo e-mail. A tela de login agora exibe o lembrete dessa etapa.
4. No Supabase, abra o [SQL Editor](https://supabase.com/dashboard/project/jmbpnhidcbjfjdpzmbyo/sql/new) e rode:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) = 'loganlucky0629@gmail.com'
RETURNING email, role;
```

5. **Se aparecer uma linha com `admin`**, saia e entre de novo na plataforma: o painel Administração ficará disponível. Se aparecer **No rows returned**, a conta ainda não foi criada no Supabase Auth ou não corresponde ao e-mail do comando. Verifique em **Authentication → Users** antes de repetir a atualização.

## Teste da conexão

- Os planos devem aparecer em **Planos**. Eles vêm da tabela `public.plans`, não de valores fixos no HTML.
- Quando cadastrar, confira o usuário em **Supabase → Authentication → Users**. O banco cria uma linha correspondente em `public.profiles` automaticamente.
- Cadastro de Gmail administrativo só concede permissões depois do `UPDATE` acima: **não** basta digitar o Gmail no `config.js`.

## Limites desta versão

- A conexão pública está preenchida, mas os logins dependem de um cadastro real do usuário no Supabase.
- Os pagamentos são **simulados**; a assinatura inicial do aluno fica pendente.
- Os materiais locais são demonstrativos, não devem hospedar materiais pagos privados.
- Para produção, revise autenticação, privacidade e armazenamento protegido.
- Nunca coloque senhas nem uma chave `service_role`/secret no `config.js`.

**Arquivos do projeto:** `index.html` (interface), `style.css` (cores), `script.js` (lógica), `config.js` (ligação pública ao banco), `materiais/` (arquivos demonstrativos). O `supabase.sql` é uma referência para reconstrução em um banco vazio e **não precisa ser executado novamente** no seu projeto já configurado.