
function updateLECTORShortcuts(){
  const sync=document.getElementById('lectorSyncCaption');
  const info=cloudState(),state=info.label;
  if(sync)sync.textContent=state;
  const nav=document.getElementById('lectorSyncNav');
  if(nav){nav.dataset.syncState=info.kind;nav.setAttribute('aria-label','Abrir Sincronização — '+state)}
  const status=document.querySelector('#lectorSyncNav .lector-sync-indicator');
  if(status)status.classList.toggle('connected',info.kind==='synced');
  const badge=document.getElementById('lectorTrashBadge');
  if(badge&&user)trashEntries().then(items=>{if(user&&badge.isConnected){badge.textContent=items.length?String(items.length):'';badge.hidden=!items.length}}).catch(()=>{});
  else if(badge){badge.textContent='';badge.hidden=true}
}
function openSyncPanel(){
  if(!user)return toast('Escolha um perfil para acessar a sincronização.');
  dialog('Sincronização',panel=>{
    const connected=!!cloudSession?.user?.id;
    const header=document.createElement('div');header.className='lector-cloud-hero';
    const ic=document.createElement('span');ic.className='lector-cloud-hero-icon';ic.append(navIcon('sync'));
    const copy=document.createElement('div');copy.className='lector-cloud-hero-copy';
    const title=document.createElement('strong');title.textContent=connected?(lsGet(cloudLinkKey())===cloudSession.user.id?'Conta online vinculada':'Conta online conectada'):'Sua biblioteca, no seu controle';
    const description=document.createElement('p');description.textContent='Sincronize progresso, favoritos e preferências. Os arquivos dos livros continuam neste dispositivo.';
    const label=document.createElement('span');label.className='lector-cloud-state';
    const liveState=cloudState();label.textContent=liveState.label;label.dataset.state=liveState.kind;label.dataset.cloudLive='true';
    copy.append(title,description);header.append(ic,copy,label);panel.append(header);
    const content=document.createElement('section');content.className='lector-cloud-dialog';panel.append(content);
    cloudSettings(content,()=>{
      if(dlg.open)dlg.close();
      updateLECTORShortcuts();
      openSyncPanel();
    });
  });
}
function lectorShortDate(ts){return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function lectorRemainingTime(rec){
  if(!rec.expiresAt)return 'Sem exclusão automática';
  const ms=rec.expiresAt-Date.now();if(ms<=0)return 'Prazo encerrado';
  const h=Math.ceil(ms/3600000);return h<24?`${h} h restantes`:`${Math.ceil(h/24)} dias restantes`;
}
function openTrashPanel(){
  if(!user)return toast('Escolha um perfil para abrir a Lixeira.');
  dialog('Lixeira',panel=>{
    const content=document.createElement('section');content.className='lector-trash-dialog';panel.append(content);
    const render=async()=>{
      try{
        const items=(await trashEntries()).sort((a,b)=>b.deletedAt-a.deletedAt);
        content.replaceChildren();
        const intro=document.createElement('p');intro.className='lector-dialog-hint';
        intro.textContent='Livros removidos podem ser recuperados com seus arquivos, progresso, marcadores e anotações até o prazo de exclusão.';
        content.append(intro);
        const policy=document.createElement('div');policy.className='lector-trash-policy';
        const label=document.createElement('label');label.htmlFor='lectorTrashDays';label.textContent='Exclusão automática';
        const select=document.createElement('select');select.className='sel';select.id='lectorTrashDays';
        [[1,'Após 1 dia (padrão)'],[3,'Após 3 dias'],[7,'Após 7 dias'],[30,'Após 30 dias'],[0,'Nunca automaticamente']].forEach(([value,text])=>{
          const opt=document.createElement('option');opt.value=String(value);opt.textContent=text;select.append(opt)
        });
        select.value=String(trashDays());select.onchange=()=>{
          lsSet(trashPolicyKey(),Number(select.value));
          toast('Novo prazo aplicado às próximas remoções.');
        };
        const note=document.createElement('small');note.textContent='A limpeza acontece ao abrir o LECTOR, consultar a lixeira ou durante o uso. O navegador fechado não executa tarefas.';
        policy.append(label,select,note);content.append(policy);
        const head=document.createElement('div');head.className='lector-trash-head';
        const count=document.createElement('strong');count.textContent=`${items.length} ${items.length===1?'livro':'livros'} na lixeira`;
        const clear=document.createElement('button');clear.type='button';clear.className='lector-outline-danger';clear.textContent='Esvaziar lixeira';clear.disabled=!items.length;
        clear.onclick=async()=>{
          if(!confirm(`Excluir definitivamente ${items.length} livro(s) e seus arquivos locais? Esta ação não pode ser desfeita.`))return;
          try{await permanentlyDeleteTrash(items.map(x=>x.id));toast('Lixeira esvaziada');await render();updateLECTORShortcuts()}
          catch(e){toast('Erro: '+e.message)}
        };
        head.append(count,clear);content.append(head);
        const list=document.createElement('div');list.className='lector-trash-list';content.append(list);
        if(!items.length){
          const empty=document.createElement('div');empty.className='lector-trash-empty';
          const ico=navIcon('trash');const text=document.createElement('span');text.textContent='A lixeira está vazia.';
          empty.append(ico,text);list.append(empty);return;
        }
        for(const entry of items){
          const row=document.createElement('article');row.className='lector-trash-item';
          const cover=document.createElement('div');cover.className='lector-trash-cover';
          if(entry.meta.cover){const image=document.createElement('img');image.src=entry.meta.cover;image.alt='';image.loading='lazy';cover.append(image)}
          else cover.append(navIcon('book-open'));
          const details=document.createElement('div');details.className='lector-trash-details';
          const title=document.createElement('strong');title.textContent=entry.meta.title||entry.meta.name||'Livro';
          const info=document.createElement('small');info.textContent=`Removido em ${lectorShortDate(entry.deletedAt)} · ${lectorRemainingTime(entry)}`;
          const format=document.createElement('small');format.textContent=String(entry.meta.type||'').toUpperCase()+' · '+(entry.hasFile?'Arquivo local preservado':'Apenas metadados disponíveis');
          details.append(title,info,format);
          const actions=document.createElement('div');actions.className='lector-trash-actions';
          const restore=document.createElement('button');restore.type='button';restore.className='primary';restore.textContent='Restaurar';
          restore.onclick=async()=>{restore.disabled=true;
            try{await restoreTrashEntry(entry.id);books=await userBooks();toast('Livro restaurado');draw();await render();updateLECTORShortcuts()}
            catch(e){toast('Não foi possível restaurar: '+e.message);restore.disabled=false}
          };
          const remove=document.createElement('button');remove.type='button';remove.className='lector-outline-danger';remove.textContent='Excluir';
          remove.setAttribute('aria-label','Excluir definitivamente '+title.textContent);
          remove.onclick=async()=>{
            if(!confirm('Excluir definitivamente "'+title.textContent+'" e o arquivo deste dispositivo?'))return;
            try{await permanentlyDeleteTrash([entry.id]);await render();updateLECTORShortcuts()}
            catch(e){toast('Erro ao excluir: '+e.message)}
          };
          actions.append(restore,remove);row.append(cover,details,actions);list.append(row);
        }
      }catch(e){content.textContent='Não foi possível acessar a lixeira: '+e.message}
    };
    render();
  });
}

setInterval(()=>{if(!user)return;purgeExpiredTrash().then(n=>{if(n){updateLECTORShortcuts();toast(n+' livro(s) expirado(s) removido(s) da lixeira.')}}).catch(console.warn)},60*60*1000);
