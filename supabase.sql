-- LOGISSA REDAÇÃO V4 - execute uma vez no SQL Editor do Supabase.
-- Autenticação é feita pelo Supabase Auth. Nunca armazene senhas nestas tabelas.
create table if not exists public.plans (
  id text primary key,
  nome text not null,
  months integer not null check(months between 1 and 36),
  monthly_price numeric(10,2) not null check(monthly_price > 0)
);
insert into public.plans (id,nome,months,monthly_price) values
 ('mensal','Mensal',1,200),('semestral','Semestral',6,180),('anual','Anual',12,160)
on conflict (id) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  role text not null default 'student' check (role in ('student','admin')),
  plan_id text references public.plans(id) on delete set null,
  subscription_status text not null default 'pending' check (subscription_status in ('pending','active','inactive')),
  subscription_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check(tipo in ('aulas','materiais','recomendacoes','depoimentos')),
  titulo text not null,
  categoria text not null default '',
  descricao text not null default '',
  link text not null default '',
  topicos text[] not null default '{}',
  autorizado boolean not null default false,
  created_at timestamptz not null default now()
);

-- Este gatilho cria um perfil PENDENTE após cadastro de e-mail e senha.
-- O usuário não pode escolher a própria função/permissão ou aprovar pagamento.
create or replace function public.logissa_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,name,phone,role,plan_id,subscription_status)
  values(new.id, new.email,
         left(coalesce(new.raw_user_meta_data->>'name',''),100),
         left(coalesce(new.raw_user_meta_data->>'phone',''),22),
         'student',
         case when exists(select 1 from public.plans where id = new.raw_user_meta_data->>'plan_id')
              then new.raw_user_meta_data->>'plan_id' else null end,
         'pending');
  return new;
end; $$;
drop trigger if exists logissa_auth_signup on auth.users;
create trigger logissa_auth_signup after insert on auth.users
for each row execute function public.logissa_new_user();

-- Consultas de permissão são SECURITY DEFINER para evitar recursão no RLS.
create or replace function public.logissa_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
create or replace function public.logissa_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles
   where id=(select auth.uid()) and subscription_status='active' and subscription_end > now());
$$;
revoke all on function public.logissa_is_admin() from public;
revoke all on function public.logissa_is_active() from public;
grant execute on function public.logissa_is_admin() to authenticated;
grant execute on function public.logissa_is_active() to authenticated;

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.contents enable row level security;
revoke all on public.plans,public.profiles,public.contents from anon,authenticated;
grant select on public.plans to anon,authenticated;
grant insert,update,delete on public.plans to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.contents to authenticated;

create policy "plans public view" on public.plans for select to anon,authenticated using (true);
create policy "plans admin insert" on public.plans for insert to authenticated with check ((select public.logissa_is_admin()));
create policy "plans admin update" on public.plans for update to authenticated using ((select public.logissa_is_admin())) with check ((select public.logissa_is_admin()));
create policy "plans admin delete" on public.plans for delete to authenticated using ((select public.logissa_is_admin()));
create policy "profiles self or admin read" on public.profiles for select to authenticated using (id=(select auth.uid()) or (select public.logissa_is_admin()));
create policy "profiles only admin update" on public.profiles for update to authenticated using ((select public.logissa_is_admin())) with check ((select public.logissa_is_admin()));
create policy "contents subscribers read" on public.contents for select to authenticated using ((select public.logissa_is_admin()) or (select public.logissa_is_active()));
create policy "contents admin insert" on public.contents for insert to authenticated with check ((select public.logissa_is_admin()));
create policy "contents admin update" on public.contents for update to authenticated using ((select public.logissa_is_admin())) with check ((select public.logissa_is_admin()));
create policy "contents admin delete" on public.contents for delete to authenticated using ((select public.logissa_is_admin()));

-- PRIMEIRO ADMIN: após criar uma conta na plataforma, execute NO EDITOR SQL:
-- update public.profiles set role = 'admin' where email = 'SEU_EMAIL_AQUI';
-- Demais administradores podem ser promovidos no painel futuramente.

-- Conteúdos demonstrativos. Mantidos apenas para apresentação do projeto.
insert into public.contents(tipo,titulo,categoria,descricao,topicos,link,autorizado) values
('aulas','Primeiros passos na redação','Módulo 1 · Fundamentos','Conheça a estrutura básica e saiba por onde começar.',array['Tema e proposta','Planejamento','Estrutura do texto'],'',false),
('aulas','Como construir uma tese','Módulo 2 · Argumentação','Transforme uma opinião em posicionamento claro.',array['Ponto de vista','Recorte temático','Coerência'],'',false),
('aulas','Desenvolvimento e repertório','Módulo 3 · Desenvolvimento','Organize argumentos e conecte repertórios ao tema.',array['Parágrafo argumentativo','Exemplos','Conectivos'],'',false),
('aulas','Conclusão com propósito','Módulo 4 · Conclusão','Feche seu texto de maneira consistente.',array['Síntese','Retomada da tese','Proposta de intervenção'],'',false),
('materiais','Checklist de revisão','Guia · TXT','Um roteiro para revisar o texto.',array[]::text[],'materiais/checklist-redacao.txt',false),
('materiais','Planejamento de redação','Exercício · TXT','Planeje tese e argumentos.',array[]::text[],'materiais/planejamento-redacao.txt',false),
('recomendacoes','Palestras sobre comunicação','Palestras','Seleção futura da Raíssa.',array[]::text[],'',false),
('recomendacoes','Documentários para repertório','Documentários','Curadoria futura.',array[]::text[],'',false);