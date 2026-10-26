# Logissa Redação

Plataforma de redação com catálogo de aulas, biblioteca de materiais, recomendações, depoimentos, planos fictícios e áreas de aluno/administrador.

## Como abrir

1. Clone o repositório no VS Code.
2. Abra `index.html` com a extensão **Live Server**.
3. O projeto já contém `config.js` com a URL e a **chave pública** do Supabase da Logissa.

Não exige `npm install` nem `node server.js` para visualizar a interface.

## Banco de dados

A base já foi configurada no Supabase do projeto. A autenticação é feita pelo Supabase Auth, e as permissões de leitura e escrita dependem das políticas RLS.

- Planos: mensal R$ 200/mês, semestral R$ 180/mês, anual R$ 160/mês (valores demonstrativos).
- Cadastro: cria conta de aluno com assinatura **pendente**; aprovação é administrativa e **não** significa pagamento real.
- Administrador: é necessário cadastrar primeiro a conta pelo site e então atribuir o papel `admin` na tabela `profiles` no Supabase.
- Não compartilhe senhas ou chaves secretas. Apenas a chave **publishable** aparece em `config.js`.

## Arquivos principais

- `index.html`: estrutura visual da plataforma.
- `style.css`: estilos e variáveis de cores.
- `script.js`: navegação, formulários, login e painel.
- `config.js`: URL e chave pública do Supabase.
- `supabase.sql`: referência do esquema de banco usado pela versão.
- `materiais/`: arquivos de exemplo.

## Atenção antes de publicar

Esta versão é um protótipo: **não faz cobranças reais** e não armazena arquivos privados em bucket protegido. Antes da operação comercial, integrar um provedor de pagamentos com webhook, revisar políticas do banco e hospedagem/proteção dos materiais.