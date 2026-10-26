/* LOGISSA V4 — JavaScript simples, sem Node.js.
   O Supabase valida o login e as regras RLS protegem os registros no banco.
   O pagamento é DEMONSTRATIVO: a assinatura fica PENDENTE até o administrador ativar. */
'use strict';
const $ = id => document.getElementById(id); // Encontra um elemento pelo identificador.
const el = (tag, cls='', value='') => { const node=document.createElement(tag);node.className=cls;node.textContent=value;return node; }; // Cria elementos sem HTML inseguro.
const dinheiro = x => Number(x).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); // Formata valores.
const aviso = (id,value) => {$(id).textContent=value;}; // Mostra mensagens.
const settings=window.LOGISSA_CONFIG || {}; // Lê chaves públicas no config.js.
const configurado=settings.supabaseUrl?.startsWith('https://') && settings.supabaseAnonKey && !settings.supabaseAnonKey.includes('COLE_AQUI'); // Verifica configuração.
const db=configurado ? window.supabase.createClient(settings.supabaseUrl,settings.supabaseAnonKey) : null; // Conecta à nuvem.
let usuario=null, planos=[],planoEscolhido=null,dadosAdmin=null; // Estado da sessão.
let catalogo={aulas:[],materiais:[],recomendacoes:[],depoimentos:[]}; // Conteúdos em memória.
const rotas=['inicio','aulas','biblioteca','recomendacoes','depoimentos','encontro','planos','cadastro','login','recuperar','nova-senha','minha-conta','gestao']; // Páginas existentes.
const privadas=['aulas','biblioteca','recomendacoes','depoimentos','encontro','minha-conta']; // Requer assinatura.
const seguro = link => typeof link==='string' && (/^https:\/\/[^\s]+$/i.test(link) || /^materiais\/[\w./-]+$/.test(link) && !link.includes('..')) ? link : ''; // Valida links.
function resultado({data,error}) {if(error) throw new Error(error.message);return data;} // Repassa erros amigavelmente.
function perfil(row) {return row ? {id:row.id,email:row.email,name:row.name,phone:row.phone,role:row.role,subscription:{planId:row.plan_id,status:row.subscription_status,endAt:row.subscription_end}} : null;} // Adapta estrutura anterior.
function assinaturaAtiva(u) {return u?.role==='admin' || (u?.subscription?.status==='active' && Date.parse(u.subscription.endAt)>Date.now());} // Expiração.
function atualizarCabecalho(){const link=$('link-login');link.textContent=usuario ? (usuario.role==='admin'?'Administração':'Minha conta') : 'Entrar';link.href=usuario ? (usuario.role==='admin'?'#gestao':'#minha-conta') : '#login';} // Cabeçalho.
function navegar(){let route=location.hash.slice(1);if(!rotas.includes(route))route='inicio';if(route==='gestao' && usuario?.role!=='admin')route='login';if(route==='nova-senha'&&!recuperacaoAutorizada)route='recuperar';if(route==='cadastro'&&!planoEscolhido)route='planos';if(privadas.includes(route) && !assinaturaAtiva(usuario))route=usuario?'minha-conta':'planos';document.querySelectorAll('.pagina').forEach(p=>{p.hidden=p.id!==route;p.classList.toggle('ativa',p.id===route);});document.querySelectorAll('[data-rota]').forEach(a=>a.dataset.rota===route?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));window.scrollTo(0,0);} // SPA.
function cartao(item,tipo){const box=el('article','box cartao-conteudo');box.append(el('span','tag',item.categoria),el('h3','',item.titulo),el('p','',item.descricao));if(tipo==='aulas'&&item.topicos?.length){const ul=el('ul','topicos');item.topicos.forEach(t=>ul.append(el('li','',t)));box.append(ul);}const link=seguro(item.link);if(link){const a=el('a','link-conteudo',tipo==='materiais'?'Abrir / baixar material ↗':'Acessar conteúdo ↗');a.href=link;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}else box.append(el('span','indisponivel','Conteúdo em preparação'));return box;} // Cards.
function grade(tipo,id,itens){const dest=$(id);dest.replaceChildren();if(!itens.length)dest.append(el('p','vazio','Nenhum conteúdo disponível.'));itens.forEach(i=>dest.append(cartao(i,tipo)));} // Grades.
function renderizarAulas(){const busca=$('buscar-aulas').value.toLocaleLowerCase('pt-BR'),categoria=$('filtro-modulo').value;grade('aulas','lista-aulas',catalogo.aulas.filter(i=>[i.titulo,i.descricao,i.categoria,...(i.topicos||[])].join(' ').toLocaleLowerCase('pt-BR').includes(busca)&&(categoria==='todos'||categoria===i.categoria)));} // Filtros.
function renderizarConteudos(){const select=$('filtro-modulo'),old=select.value;select.replaceChildren(new Option('Todos os módulos','todos'));[...new Set(catalogo.aulas.map(i=>i.categoria))].forEach(i=>select.add(new Option(i,i)));select.value=[...select.options].some(o=>o.value===old)?old:'todos';renderizarAulas();grade('materiais','lista-materiais',catalogo.materiais);grade('recomendacoes','lista-recomendacoes',catalogo.recomendacoes);const target=$('lista-depoimentos');target.replaceChildren();const dep=catalogo.depoimentos.filter(d=>d.autorizado);if(!dep.length)target.append(el('p','vazio','Depoimentos autorizados aparecerão aqui.'));dep.forEach(d=>{const b=el('blockquote','box');b.append(el('p','',`“${d.descricao}”`),el('cite','tag',d.titulo));target.append(b);});} // Conteúdos.
function renderizarPlanos(){const target=$('lista-planos');target.replaceChildren();planos.forEach(p=>{const c=el('article','box cartao-plano');c.append(el('span','tag',p.nome));const price=el('div','preco-plano',dinheiro(p.monthlyPrice));price.append(el('small','',' / mês'));c.append(price,el('p','',`${p.months} ${p.months===1?'mês':'meses'} de acesso · Total: ${dinheiro(p.monthlyPrice*p.months)}`),el('p','','✓ Aulas · Biblioteca · Recomendações · Recursos iguais nos três planos.'));const b=el('button','btn-primary','Escolher '+p.nome);b.type='button';b.onclick=()=>{planoEscolhido=p.id;aviso('resumo-plano',`Plano ${p.nome}: ${dinheiro(p.monthlyPrice)} por mês, durante ${p.months} meses. Pagamento demonstrativo, sem cobrança.`);location.hash='#cadastro';};c.append(b);target.append(c);});} // Assinaturas.
async function carregarPlanos(){const rows=resultado(await db.from('plans').select('*').order('months'));planos=rows.map(p=>({id:p.id,nome:p.nome,months:p.months,monthlyPrice:p.monthly_price}));renderizarPlanos();} // Planos persistentes.
async function carregarConteudos(){catalogo={aulas:[],materiais:[],recomendacoes:[],depoimentos:[]};if(assinaturaAtiva(usuario)){const rows=resultado(await db.from('contents').select('*').order('created_at'));rows.forEach(r=>catalogo[r.tipo]?.push(r));}renderizarConteudos();} // RLS também verifica assinatura.
function atualizarConta(){if(!usuario)return;$('boas-vindas').textContent=`Olá, ${usuario.name || usuario.email}!`;$('situacao-assinatura').textContent=usuario.role==='admin'?'Acesso administrativo.':`Assinatura ${usuario.subscription.status} · ${usuario.subscription.endAt?'Válida até '+new Date(usuario.subscription.endAt).toLocaleDateString('pt-BR'):'Aguardando aprovação do pagamento.'}`;} // Status.
async function atualizarSessao(){const {data:{user},error}=await db.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')console.warn(error.message);usuario=null;if(user){const row=resultado(await db.from('profiles').select('*').eq('id',user.id).single());usuario=perfil(row);}atualizarCabecalho();atualizarConta();await carregarConteudos();} // Sessão verdadeira.
async function sair(){resultado(await db.auth.signOut());usuario=null;dadosAdmin=null;atualizarCabecalho();await carregarConteudos();location.hash='#login';navegar();} // Sair.
$('form-cadastro').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;const password=$('senha-cadastro').value;if(password!==$('senha-confirma').value)return aviso('mensagem-cadastro','As senhas precisam ser iguais.');if(!$('aceite-teste').checked)return aviso('mensagem-cadastro','Confirme que este pagamento é apenas um teste.');try{const email=$('email-cadastro').value.trim().toLowerCase();resultado(await db.auth.signUp({email,password,options:{data:{name:$('nome-cadastro').value.trim(),phone:$('telefone-cadastro').value.trim(),plan_id:planoEscolhido}}}));e.target.reset();aviso('mensagem-cadastro','Cadastro enviado. Confirme seu e-mail, se solicitado.');aviso('mensagem-login','Cadastro enviado ao Supabase! Verifique seu e-mail (inclusive Spam) e confirme a conta, se solicitado. Depois, entre com suas credenciais. O acesso de aluno aguarda aprovação.');location.hash='#login';}catch(err){aviso('mensagem-cadastro',err.message);}}); // Cadastro pendente.
$('form-login').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;try{resultado(await db.auth.signInWithPassword({email:$('email-login').value.trim().toLowerCase(),password:$('senha-login').value}));await atualizarSessao();if(usuario?.role==='admin'){await carregarAdmin();location.hash='#gestao';}else location.hash='#minha-conta';$('senha-login').value='';aviso('mensagem-login','');navegar();}catch(err){aviso('mensagem-login',err.message);}}); // Login Supabase.
// Controle temporário: só quem comprovar posse do e-mail poderá cadastrar a nova senha.
let recuperacaoAutorizada = false;

// Ao retornar do link de recuperação, o Supabase valida o token e informa o evento.
db?.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
        recuperacaoAutorizada = true;
        location.hash = '#nova-senha';
        aviso('mensagem-nova-senha', 'E-mail confirmado para recuperação. Escolha uma nova senha.');
    }
});

// Obtém o e-mail informado no fluxo de recuperação.
function emailRecuperacao() {
    const campo = $('email-recuperacao');
    if (!campo.value.trim() || !campo.checkValidity()) {
        aviso('mensagem-recuperacao', 'Digite um e-mail válido para continuar.');
        return null;
    }
    return campo.value.trim().toLowerCase();
}

// Requisição de e-mail: nunca promete entrega se o provedor bloquear envios.
async function solicitarRecuperacao(metodo) {
    const email = emailRecuperacao();
    if (!email || !db) return;
    const botao = $(metodo === 'link' ? 'enviar-link-recuperacao' : 'enviar-codigo-recuperacao');
    botao.disabled = true;
    aviso('mensagem-recuperacao', 'Solicitando a recuperação...');
    try {
        if (metodo === 'link') {
            // O endereço atual precisa estar autorizado em Supabase Auth > URL Configuration.
            const redirectTo = location.origin + location.pathname;
            resultado(await db.auth.resetPasswordForEmail(email, { redirectTo }));
        } else {
            // Não cria uma conta nova; o código precisa estar habilitado no template de e-mail.
            resultado(await db.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: false }
            }));
        }
        aviso('mensagem-recuperacao', metodo === 'link'
            ? 'Solicitação enviada. Verifique a caixa de entrada e o Spam. Abra o link recebido para escolher uma nova senha.'
            : 'Solicitação enviada. Consulte seu e-mail. Para receber seis dígitos, o modelo Magic Link do Supabase precisa incluir o código {{ .Token }}.');
    } catch (erro) {
        aviso('mensagem-recuperacao', 'Não foi possível solicitar a recuperação: ' + erro.message);
    } finally {
        botao.disabled = false;
    }
}
$('enviar-link-recuperacao').addEventListener('click', () => solicitarRecuperacao('link'));
$('enviar-codigo-recuperacao').addEventListener('click', () => solicitarRecuperacao('codigo'));

// O Supabase valida o código no servidor antes de liberar a redefinição.
$('validar-codigo-recuperacao').addEventListener('click', async () => {
    const email = emailRecuperacao();
    const token = $('codigo-recuperacao').value.trim();
    if (!email) return;
    if (!/^\d{6}$/.test(token)) {
        aviso('mensagem-recuperacao', 'O código deve conter seis números.');
        return;
    }
    try {
        resultado(await db.auth.verifyOtp({ email, token, type: 'email' }));
        recuperacaoAutorizada = true;
        location.hash = '#nova-senha';
        navegar();
    } catch (erro) {
        aviso('mensagem-recuperacao', 'Código inválido ou expirado: ' + erro.message);
    }
});

// Atualiza a senha somente após validação de identidade pelo Supabase.
$('form-nova-senha').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!recuperacaoAutorizada) {
        aviso('mensagem-nova-senha', 'Confirme sua identidade pelo link ou código enviado ao seu e-mail.');
        return;
    }
    const senha = $('nova-senha-campo').value;
    if (senha !== $('nova-senha-confirmacao').value) {
        aviso('mensagem-nova-senha', 'As senhas digitadas não são iguais.');
        return;
    }
    try {
        const { data: { user } } = await db.auth.getUser();
        if (!user) throw new Error('Sessão de recuperação expirada. Solicite outro link ou código.');
        resultado(await db.auth.updateUser({ password: senha }));
        recuperacaoAutorizada = false;
        await db.auth.signOut();
        usuario = null;
        atualizarCabecalho();
        evento.target.reset();
        aviso('mensagem-login', 'Senha atualizada! Entre com seu e-mail e a nova senha.');
        location.hash = '#login';
        navegar();
    } catch (erro) {
        aviso('mensagem-nova-senha', 'Não foi possível mudar a senha: ' + erro.message);
    }
});

$('mostrar-senha').addEventListener('click',()=>{const f=$('senha-login');f.type=f.type==='password'?'text':'password';$('mostrar-senha').textContent=f.type==='password'?'Mostrar':'Ocultar';}); // Mostrar senha.
$('sair-conta').addEventListener('click',sair);$('sair-admin').addEventListener('click',sair); // Logout.
$('buscar-aulas').addEventListener('input',renderizarAulas);$('filtro-modulo').addEventListener('change',renderizarAulas); // Busca.
document.querySelectorAll('[data-aba]').forEach(b=>b.addEventListener('click',()=>document.querySelectorAll('.aba-painel').forEach(p=>p.hidden=p.id!=='admin-'+b.dataset.aba))); // Abas.
function linha(title,description,edit,remove){const line=el('div','registro-admin'),left=el('div'),acts=el('div','acoes-registro');left.append(el('strong','',title),el('p','',description));const e=el('button','btn-secondary','Editar'),d=el('button','btn-secondary','Excluir');e.type=d.type='button';e.onclick=edit;d.onclick=remove;acts.append(e,d);line.append(left,acts);return line;} // Linhas administrativas.
async function carregarAdmin(){if(usuario?.role!=='admin')return;const [users,items]=await Promise.all([db.from('profiles').select('*').order('created_at'),db.from('contents').select('*').order('created_at')]);dadosAdmin={users:resultado(users).map(perfil),contents:{aulas:[],materiais:[],recomendacoes:[],depoimentos:[]},plans:planos};resultado(items).forEach(i=>dadosAdmin.contents[i.tipo].push(i));renderAdmin();} // Dados administrativos.
function renderAdmin(){const contents=$('admin-lista-conteudos');contents.replaceChildren();Object.entries(dadosAdmin.contents).forEach(([tipo,items])=>items.forEach(i=>contents.append(linha(`${i.titulo} (${tipo})`,i.categoria,()=>editarConteudo(tipo,i),()=>excluirConteudo(i.id)))));const select=$('novo-aluno-plano');select.replaceChildren();planos.forEach(p=>select.add(new Option(p.nome,p.id)));const users=$('admin-lista-usuarios');users.replaceChildren();dadosAdmin.users.forEach(u=>users.append(linha(`${u.name} — ${u.email}`,`${u.subscription.status} · ${u.subscription.planId||''}`,()=>editarUsuario(u),()=>desativarUsuario(u))));const p=$('admin-lista-planos');p.replaceChildren();planos.forEach(i=>p.append(linha(`${i.nome} — ${dinheiro(i.monthlyPrice)}/mês`,`${i.months} meses`,()=>editarPlano(i),()=>excluirPlano(i.id))));} // Painel.
function limparConteudo(){$('form-gestao').reset();$('id-item').value='';$('tipo-item').disabled=false;} // Limpa formulário.
$('cancelar-edicao-item').addEventListener('click',limparConteudo); // Cancelar.
function editarConteudo(tipo,i){$('id-item').value=i.id;$('tipo-item').value=tipo;$('tipo-item').disabled=true;$('titulo-item').value=i.titulo;$('categoria-item').value=i.categoria;$('descricao-item').value=i.descricao;$('link-item').value=i.link||'';$('autorizado-item').checked=!!i.autorizado;$('form-gestao').scrollIntoView({behavior:'smooth'});} // Editar.
$('form-gestao').addEventListener('submit',async e=>{e.preventDefault();try{const id=$('id-item').value;const item={tipo:$('tipo-item').value,titulo:$('titulo-item').value.trim(),categoria:$('categoria-item').value.trim(),descricao:$('descricao-item').value.trim(),link:$('link-item').value.trim(),autorizado:$('autorizado-item').checked};resultado(id?await db.from('contents').update(item).eq('id',id):await db.from('contents').insert(item));limparConteudo();await carregarAdmin();await carregarConteudos();aviso('retorno-gestao','Conteúdo salvo no banco.');}catch(err){aviso('retorno-gestao',err.message);}}); // CRUD conteúdo.
async function excluirConteudo(id){if(!confirm('Excluir este conteúdo?'))return;try{resultado(await db.from('contents').delete().eq('id',id));await carregarAdmin();await carregarConteudos();}catch(e){alert(e.message);}} // Excluir.
function editarPlano(p){$('plano-id').value=p.id;$('plano-nome').value=p.nome;$('plano-preco').value=p.monthlyPrice;$('plano-meses').value=p.months;$('form-plano').scrollIntoView({behavior:'smooth'});} // Alterar plano.
$('cancelar-plano').addEventListener('click',()=>{$('form-plano').reset();$('plano-id').value='';}); // Cancela.
$('form-plano').addEventListener('submit',async e=>{e.preventDefault();try{const id=$('plano-id').value;const row={id:id||$('plano-nome').value.trim().toLowerCase().replace(/\s+/g,'-'),nome:$('plano-nome').value.trim(),monthly_price:Number($('plano-preco').value),months:Number($('plano-meses').value)};resultado(await db.from('plans').upsert(row));e.target.reset();$('plano-id').value='';await carregarPlanos();await carregarAdmin();aviso('retorno-plano','Plano salvo no banco.');}catch(err){aviso('retorno-plano',err.message);}}); // CRUD planos.
async function excluirPlano(id){if(!confirm('Excluir o plano?'))return;try{resultado(await db.from('plans').delete().eq('id',id));await carregarPlanos();await carregarAdmin();}catch(err){alert(err.message);}} // Excluir plano.
$('form-novo-aluno').addEventListener('submit',e=>{e.preventDefault();aviso('retorno-novo-aluno','Para segurança, o aluno precisa criar a própria conta em Planos → Cadastro. Depois você poderá ativá-lo nesta área. Não é permitido ao navegador criar senhas para terceiros.');}); // Não simula criação privilegiada.
async function editarUsuario(u){if(u.role==='admin')return alert('A gestão de administradores deve ser feita pelo banco, com autenticação segura.');const name=prompt('Nome:',u.name);if(name===null)return;const phone=prompt('Telefone:',u.phone||'');if(phone===null)return;const planId=prompt('ID do plano ('+planos.map(p=>p.id).join(', ')+'):',u.subscription.planId||'');if(planId===null)return;const status=prompt('Situação: pending, active ou inactive',u.subscription.status);if(status===null)return;if(!['pending','active','inactive'].includes(status)||!planos.some(p=>p.id===planId))return alert('Plano ou situação inválida.');const plan=planos.find(p=>p.id===planId);const endAt=status==='active'?new Date(Date.now()+plan.months*30*86400000).toISOString():null;try{resultado(await db.from('profiles').update({name,phone,plan_id:planId,subscription_status:status,subscription_end:endAt}).eq('id',u.id));await carregarAdmin();}catch(err){alert(err.message);}} // Administrador aprova acesso fictício.
async function desativarUsuario(u){if(u.role==='admin')return alert('Um administrador não pode ser desativado por esta tela.');if(!confirm('Desativar o acesso deste aluno?'))return;try{resultado(await db.from('profiles').update({subscription_status:'inactive',subscription_end:null}).eq('id',u.id));await carregarAdmin();}catch(err){alert(err.message);}} // Não exclui identidade do Auth.
const logo=document.querySelector('.logo-imagem');if(logo)logo.addEventListener('error',e=>{e.target.hidden=true;document.querySelector('.logo-texto').hidden=false;}); // Logo alternativa.
window.addEventListener('hashchange',navegar);$('ano').textContent=new Date().getFullYear(); // Navegação.
(async()=>{if(!db){aviso('mensagem-login','Configure config.js com a URL e a chave publicável do Supabase. Consulte INSTRUCOES-V4.md.');navegar();return;}try{await carregarPlanos();await atualizarSessao();if(usuario?.role==='admin')await carregarAdmin();}catch(err){console.error(err);aviso('mensagem-login',err.message);}navegar();})(); // Inicialização.