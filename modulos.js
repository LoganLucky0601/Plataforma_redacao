/* LOGISSA | MÓDULOS REAIS — usa a sessão Supabase e as políticas RLS existentes.
   Não altera login, assinatura, planos ou as demais páginas do projeto. */
'use strict';
(() => {
    const E = id => document.getElementById(id);
    const node = (tag, className = '', text = '') => { const e = document.createElement(tag); e.className = className; e.textContent = text; return e; };
    const message = (text, error = false) => { const area = E('modulos-retorno'); if (area) { area.textContent = text; area.className = error ? 'modulos-aviso' : 'mensagem'; } };
    const uid = () => crypto.randomUUID();
    const allowed = link => { try { const u = new URL(link); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const embed = link => {
        try {
            const u = new URL(link), host = u.hostname.toLowerCase(); let code = '';
            if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) code = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/) || [])[1];
            if (host === 'youtu.be') code = u.pathname.slice(1);
            if (/^[\w-]{11}$/.test(code || '')) return 'https://www.youtube-nocookie.com/embed/' + code;
            if (['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)) { const id = u.pathname.split('/').find(p => /^\d+$/.test(p)); if (id) return 'https://player.vimeo.com/video/' + id; }
        } catch { /* URL inválida. */ }
        return '';
    };
    const query = async p => { const { data, error } = await p; if (error) throw error; return data; };
    let modules = [], lessons = [], attachments = [], selectedModule = null, selectedLesson = null;
    let adminModule = null, editingLesson = null, stagedFile = null;
    let loadCounter = 0;

    // Cria somente os novos elementos na estrutura existente, sem substituir o layout original.
    const catalog = E('aulas');
    catalog.insertAdjacentHTML('beforeend', `
      <div id="modulos-barra" class="modulos-barra"><span id="modulos-contador" class="modulo-selo">Módulos</span><input id="modulos-pesquisa" placeholder="Pesquisar módulos e aulas..." aria-label="Pesquisar módulos e aulas"></div>
      <div id="modulos-grid" class="modulos-grid"></div>
      <div id="modulos-detalhe" hidden>
        <button id="modulos-voltar" type="button" class="modulos-voltar">← Voltar aos módulos</button>
        <div class="modulos-capa"><span class="modulo-selo" id="modulos-numero"></span><h2 id="modulos-titulo"></h2><p id="modulos-descricao"></p><small id="modulos-total"></small></div>
        <div class="modulos-colunas"><aside class="modulos-lateral"><h3>Aulas do módulo</h3><div id="modulos-lista-aulas"></div></aside>
        <article class="modulos-aula"><div id="modulos-video" class="modulos-video"></div><div class="modulos-detalhes"><span class="modulo-selo" id="modulos-aula-numero"></span><h2 id="modulos-aula-titulo"></h2><p id="modulos-aula-descricao"></p><div id="modulos-topicos" class="modulos-chips"></div><h3>Materiais desta aula</h3><div id="modulos-anexos"></div></div></article></div>
      </div><p id="modulos-erro" class="modulos-aviso" role="status"></p>`);

    const tabs = document.querySelector('.abas-gestao');
    const btn = node('button','btn-secondary','Organizar módulos'); btn.type='button';btn.dataset.aba='modulos';
    tabs.insertBefore(btn,tabs.firstChild);
    const admin = node('div','aba-painel'); admin.id='admin-modulos';admin.hidden=true;
    admin.innerHTML = `
    <h2>Organização de módulos e aulas</h2><p class="subtitulo">Edite títulos, descrições, vídeos e anexos. As alterações são salvas no Supabase.</p>
    <div class="modulos-admin-layout">
    <aside class="box modulos-admin-lateral"><h3>Módulos</h3><button id="modulos-novo" type="button" class="btn-primary">+ Novo módulo</button><div id="modulos-admin-lista"></div></aside>
    <div class="modulos-admin-edicao">
    <form id="modulos-form-modulo" class="box modulos-form" hidden>
      <h3>Editar módulo</h3><label>Título</label><input id="modulos-form-titulo" maxlength="150" required>
      <label>Chamada</label><input id="modulos-form-subtitulo" maxlength="180">
      <label>Descrição</label><textarea id="modulos-form-descricao" maxlength="2000" rows="3"></textarea>
      <label>Ordem</label><input id="modulos-form-posicao" type="number" min="0" step="1" required>
      <div class="modulos-acoes"><button class="btn-primary" type="submit">Salvar módulo</button><button id="modulos-excluir" type="button" class="btn-secondary modulos-btn-perigo">Excluir módulo e aulas</button></div>
    </form>
    <div id="modulos-listagem-editor" class="box modulos-form" hidden><h3>Aulas neste módulo</h3><div id="modulos-admin-aulas"></div><button id="modulos-nova-aula" type="button" class="btn-primary">+ Adicionar aula</button></div>
    <form id="modulos-form-aula" class="box modulos-form" hidden>
      <h3 id="modulos-editor-titulo">Editar aula</h3><label>Título da aula</label><input id="modulos-aula-nome" maxlength="150" required>
      <label>Descrição</label><textarea id="modulos-aula-texto" maxlength="3000" rows="3"></textarea>
      <label>Tópicos (um por linha)</label><textarea id="modulos-aula-topicos" rows="3"></textarea>
      <label>Link do vídeo (YouTube, Vimeo ou HTTPS)</label><input id="modulos-aula-video" type="url" placeholder="https://...">
      <label>Ordem da aula</label><input id="modulos-aula-posicao" type="number" min="0" step="1" required>
      <h4>Anexos</h4><p class="modulos-admin-info">Adicione links HTTPS ou envie arquivos até 10 MB. Arquivos são privados e exigem acesso autorizado.</p>
      <div id="modulos-editor-anexos"></div><button id="modulos-add-anexo" type="button" class="btn-secondary">+ Anexar link</button>
      <label>Enviar arquivo (PDF, imagem, DOCX ou TXT)</label><input id="modulos-anexo-upload" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt">
      <div class="modulos-acoes"><button class="btn-primary" type="submit">Salvar aula e anexos</button><button id="modulos-cancelar-aula" class="btn-secondary" type="button">Cancelar</button></div>
    </form>
    <p id="modulos-retorno" class="mensagem" role="status"></p>
    </div></div>`;
    document.getElementById('gestao').append(admin);
    btn.addEventListener('click', async () => {
        if (typeof usuario === 'undefined' || usuario?.role !== 'admin') return;
        document.querySelectorAll('.aba-painel').forEach(p => p.hidden = p !== admin);
        try { await refresh(); renderAdmin(); } catch (e) { message(e.message,true); }
    });

    const rowsFor = (id, table) => table.filter(x => x.module_id === id).sort((a,b) => a.position-b.position);
    const getLessons = id => rowsFor(id, lessons);
    const getAttachments = id => attachments.filter(x => x.lesson_id === id).sort((a,b)=>a.position-b.position);

    // Recebe apenas registros que o banco permite ler (assinaturas ativas ou admin).
    async function refresh() {
        const current = ++loadCounter;
        const auth = await db.auth.getUser();
        if (!auth.data.user) { modules=[];lessons=[];attachments=[];renderCatalog();return; }
        const [m,l,a] = await Promise.all([
            query(db.from('course_modules').select('*').order('position')),
            query(db.from('module_lessons').select('*').order('position')),
            query(db.from('lesson_attachments').select('*').order('position'))
        ]);
        if (current !== loadCounter) return;
        modules=m;lessons=l;attachments=a;
        renderCatalog(); if (selectedModule) renderModule();
        if (!admin.hidden) renderAdmin();
    }
    function renderCatalog() {
        const input = E('modulos-pesquisa').value.toLocaleLowerCase('pt-BR');
        const found = modules.filter(m => [m.title,m.subtitle,m.description,...getLessons(m.id).map(a=>a.title)].join(' ').toLocaleLowerCase('pt-BR').includes(input));
        E('modulos-contador').textContent = found.length + ' módulo(s)';
        const target = E('modulos-grid');target.replaceChildren();
        found.forEach((m,i) => {
            const card=node('button','modulo-card');card.type='button';
            card.append(node('span','modulo-selo','MÓDULO '+(modules.indexOf(m)+1)),node('strong','',m.title),node('p','',m.subtitle));
            const foot=node('div','modulo-rodape');foot.append(node('span','',getLessons(m.id).length+' aula(s)'),node('span','','Explorar →'));
            card.append(foot); card.onclick=()=>{selectedModule=m.id;selectedLesson=getLessons(m.id)[0]?.id||null;renderModule();};target.append(card);
        });
        if (!found.length) target.append(node('p','',modules.length?'Nenhum módulo encontrado.':'Nenhum módulo disponível para sua conta.'));
    }
    function renderModule() {
        const m=modules.find(x=>x.id===selectedModule);
        if (!m) { selectedModule=null; E('modulos-detalhe').hidden=true;E('modulos-grid').hidden=false;E('modulos-barra').hidden=false;return; }
        E('modulos-detalhe').hidden=false;E('modulos-grid').hidden=true;E('modulos-barra').hidden=true;
        E('modulos-titulo').textContent=m.title;E('modulos-descricao').textContent=m.description||m.subtitle;
        E('modulos-numero').textContent=m.subtitle;E('modulos-total').textContent=getLessons(m.id).length+' aula(s)';
        const list=E('modulos-lista-aulas');list.replaceChildren();
        const entries=getLessons(m.id);
        if (!entries.some(x=>x.id===selectedLesson)) selectedLesson=entries[0]?.id||null;
        entries.forEach((lesson,i)=>{
            const b=node('button','modulos-aula-botao'+(lesson.id===selectedLesson?' ativo':''));b.type='button';
            b.append(node('span','modulo-selo',String(i+1).padStart(2,'0')));
            const label=node('span');label.append(node('strong','',lesson.title),node('small','',lesson.video_url?'▶ Vídeo disponível':'◷ Vídeo em preparação'));b.append(label);
            b.onclick=()=>{selectedLesson=lesson.id;renderModule();};list.append(b);
        });
        renderLesson();
    }
    async function renderLesson() {
        const m=getLessons(selectedModule),a=m.find(x=>x.id===selectedLesson),video=E('modulos-video');video.replaceChildren();
        E('modulos-aula-numero').textContent=a?'AULA '+(m.indexOf(a)+1):'MÓDULO VAZIO';
        E('modulos-aula-titulo').textContent=a?.title||'Nenhuma aula cadastrada';
        E('modulos-aula-descricao').textContent=a?.description||'O conteúdo será adicionado em breve.';
        const chips=E('modulos-topicos');chips.replaceChildren();(a?.topics||[]).forEach(t=>chips.append(node('span','modulo-chip',t)));
        const url=embed(a?.video_url);
        if(url){const f=document.createElement('iframe');f.src=url;f.title='Vídeo: '+a.title;f.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';video.append(f);}
        else {const no=node('div','modulos-video-vazio');no.append(node('span','','▶'),node('p','',a?.video_url?'Este vídeo deve ser aberto em outra página.':'Vídeo em preparação'));const link=allowed(a?.video_url);if(link){const b=node('a','btn-secondary','Abrir vídeo ↗');b.href=link;b.target='_blank';b.rel='noopener noreferrer';no.append(b);}video.append(no);}
        const dest=E('modulos-anexos');dest.replaceChildren();
        const attached=getAttachments(a?.id);if(!attached.length)dest.append(node('p','', 'Nenhum anexo nesta aula.'));
        for(const file of attached){const row=node('div','modulos-anexo');row.append(node('span','',file.title));
            let href=allowed(file.external_url);
            if(file.file_path) {const result=await db.storage.from('logissa-aulas').createSignedUrl(file.file_path,60);href=result.error?'':result.data.signedUrl;}
            if(href){const link=node('a','','Abrir ↗');link.href=href;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}
            else row.append(node('small','', 'Anexo indisponível'));
            dest.append(row);
        }
    }
    E('modulos-pesquisa').addEventListener('input',renderCatalog);
    E('modulos-voltar').onclick=()=>{selectedModule=null;renderModule();renderCatalog();};

    function chooseModule(id){adminModule=id;editingLesson=null;renderAdmin();}
    function renderAdmin(){
        const list=E('modulos-admin-lista');list.replaceChildren();
        modules.forEach(m=>{const b=node('button',m.id===adminModule?'ativo':'',m.title);b.type='button';b.onclick=()=>chooseModule(m.id);list.append(b);});
        const m=modules.find(x=>x.id===adminModule);
        E('modulos-form-modulo').hidden=!m; E('modulos-listagem-editor').hidden=!m;
        E('modulos-form-aula').hidden=!editingLesson;
        if(!m) return;
        E('modulos-form-titulo').value=m.title;E('modulos-form-subtitulo').value=m.subtitle;E('modulos-form-descricao').value=m.description;E('modulos-form-posicao').value=m.position;
        const items=E('modulos-admin-aulas');items.replaceChildren();
        getLessons(m.id).forEach((lesson,i)=>{const row=node('div','modulos-linha-admin');row.append(node('span','',`${i+1}. ${lesson.title}`));
            const actions=node('div','modulos-acoes'),edit=node('button','btn-secondary','Editar'),del=node('button','btn-secondary modulos-btn-perigo','Excluir');
            edit.type=del.type='button';edit.onclick=()=>editLesson(lesson.id);del.onclick=()=>removeLesson(lesson);actions.append(edit,del);row.append(actions);items.append(row);});
    }
    async function saveTable(table,body,id){return query(id?db.from(table).update(body).eq('id',id).select().single():db.from(table).insert(body).select().single());}
    E('modulos-novo').onclick=async()=>{try{const m=await saveTable('course_modules',{title:'Novo módulo',subtitle:'Novo conteúdo',description:'',position:modules.length+1});await refresh();chooseModule(m.id);message('Módulo criado. Edite os dados e salve.');}catch(e){message(e.message,true);}};
    E('modulos-form-modulo').onsubmit=async ev=>{ev.preventDefault();try{await saveTable('course_modules',{title:E('modulos-form-titulo').value.trim(),subtitle:E('modulos-form-subtitulo').value.trim(),description:E('modulos-form-descricao').value.trim(),position:Number(E('modulos-form-posicao').value)},adminModule);await refresh();message('Módulo salvo no banco.');}catch(e){message(e.message,true);}};
    E('modulos-excluir').onclick=async()=>{if(!confirm('Excluir o módulo, todas as aulas e seus anexos? Esta ação não pode ser desfeita.'))return;try{
        // Apaga primeiro os arquivos privados do Storage para não deixar arquivos órfãos.
        const paths=getLessons(adminModule).flatMap(l=>getAttachments(l.id)).map(a=>a.file_path).filter(Boolean);
        if(paths.length){const out=await db.storage.from('logissa-aulas').remove(paths);if(out.error)throw out.error;}
        await query(db.from('course_modules').delete().eq('id',adminModule));adminModule=null;selectedModule=null;await refresh();renderAdmin();message('Módulo excluído.');
    }catch(e){message(e.message,true);}};
    E('modulos-nova-aula').onclick=()=>editLesson(null);
    function editLesson(id){editingLesson=id||'new';const l=lessons.find(x=>x.id===id);E('modulos-form-aula').hidden=false;
        E('modulos-editor-titulo').textContent=l?'Editar aula':'Nova aula';E('modulos-aula-nome').value=l?.title||'';E('modulos-aula-texto').value=l?.description||'';
        E('modulos-aula-topicos').value=(l?.topics||[]).join('\n');E('modulos-aula-video').value=l?.video_url||'';
        E('modulos-aula-posicao').value=l?.position??(getLessons(adminModule).length+1);E('modulos-anexo-upload').value='';
        const area=E('modulos-editor-anexos');area.replaceChildren();(l?getAttachments(l.id):[]).forEach(a=>attachmentField(a));
        E('modulos-form-aula').scrollIntoView({behavior:'smooth',block:'start'});
    }
    function attachmentField(file=null){const area=E('modulos-editor-anexos'),row=node('div','modulos-anexo-editor');row.dataset.id=file?.id||'';
        const title=node('input');title.placeholder='Nome do anexo';title.value=file?.title||'';title.className='modulos-attachment-name';
        const link=node('input');link.placeholder='https://...';link.value=file?.external_url||'';link.className='modulos-attachment-url';link.disabled=!!file?.file_path;
        const del=node('button','btn-secondary modulos-btn-perigo','Remover');del.type='button';del.onclick=()=>row.remove();row.append(title,link,del);area.append(row);
    }
    E('modulos-add-anexo').onclick=()=>attachmentField();
    E('modulos-cancelar-aula').onclick=()=>{editingLesson=null;E('modulos-form-aula').hidden=true;};
    E('modulos-form-aula').onsubmit=async ev=>{
        ev.preventDefault(); const button=E('modulos-form-aula').querySelector('[type=submit]');button.disabled=true;
        try{
            const video=E('modulos-aula-video').value.trim();if(video&&!allowed(video))throw new Error('O vídeo precisa ter um link HTTPS válido.');
            const body={module_id:adminModule,title:E('modulos-aula-nome').value.trim(),description:E('modulos-aula-texto').value.trim(),topics:E('modulos-aula-topicos').value.split('\n').map(x=>x.trim()).filter(Boolean),video_url:video,position:Number(E('modulos-aula-posicao').value)};
            const lesson=await saveTable('module_lessons',body,editingLesson==='new'?null:editingLesson);
            const requested=[...E('modulos-editor-anexos').querySelectorAll('.modulos-anexo-editor')].map((r,i)=>({id:r.dataset.id,title:r.querySelector('.modulos-attachment-name').value.trim(),url:r.querySelector('.modulos-attachment-url').value.trim(),position:i}));
            for(const a of requested){if(!a.title)throw new Error('Informe o nome de todos os anexos.');if(!a.id&&!allowed(a.url))throw new Error('Insira um link HTTPS válido para cada novo anexo.');}
            const existing=getAttachments(lesson.id),remain=new Set(requested.filter(a=>a.id).map(a=>a.id));
            for(const a of existing.filter(a=>!remain.has(a.id))){
                if(a.file_path){const removed=await db.storage.from('logissa-aulas').remove([a.file_path]);if(removed.error)throw removed.error;}
                await query(db.from('lesson_attachments').delete().eq('id',a.id));
            }
            for(const a of requested){const existingFile=existing.find(x=>x.id===a.id);if(existingFile){await query(db.from('lesson_attachments').update({title:a.title,position:a.position}).eq('id',a.id));}else await query(db.from('lesson_attachments').insert({lesson_id:lesson.id,title:a.title,external_url:allowed(a.url),position:a.position}));}
            const file=E('modulos-anexo-upload').files[0];
            if(file){
                const ext=(file.name.split('.').pop()||'').toLowerCase();
                if(!['pdf','png','jpg','jpeg','webp','docx','txt'].includes(ext))throw new Error('Tipo de arquivo não permitido.');
                if(file.size>10*1024*1024)throw new Error('O arquivo deve ter no máximo 10 MB.');
                const filePath=lesson.id+'/'+uid()+'.'+ext;
                const uploaded=await db.storage.from('logissa-aulas').upload(filePath,file,{upsert:false});if(uploaded.error)throw uploaded.error;
                try{await query(db.from('lesson_attachments').insert({lesson_id:lesson.id,title:file.name,file_path:filePath,position:requested.length}));}
                catch(e){await db.storage.from('logissa-aulas').remove([filePath]);throw e;}
            }
            editingLesson=null;await refresh();renderAdmin();message('Aula e anexos salvos no Supabase.');
        }catch(e){message('Falha ao salvar: '+e.message,true);}finally{button.disabled=false;}
    };
    async function removeLesson(l){if(!confirm('Excluir a aula '+l.title+' e todos os seus anexos?'))return;
        try{const paths=getAttachments(l.id).map(a=>a.file_path).filter(Boolean);if(paths.length){const result=await db.storage.from('logissa-aulas').remove(paths);if(result.error)throw result.error;}
            await query(db.from('module_lessons').delete().eq('id',l.id));editingLesson=null;await refresh();renderAdmin();message('Aula excluída.');
        }catch(e){message(e.message,true);}
    }
    // Recarrega o catálogo ao recuperar a sessão, entrar ou sair. Nenhuma permissão é determinada só pelo navegador.
    db.auth.onAuthStateChange(() => {setTimeout(()=>refresh().catch(e=>{E('modulos-erro').textContent=e.message;}),50);});
    refresh().catch(e=>{E('modulos-erro').textContent='Não foi possível carregar os módulos: '+e.message;});
})();