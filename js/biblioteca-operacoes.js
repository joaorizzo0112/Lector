
let pendingCover=null;
const MAX_COVER_BYTES=8*1024*1024;
async function coverFromFile(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha JPG, PNG ou WebP.');
  if(file.size>MAX_COVER_BYTES)throw Error('A imagem deve ter até 8 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>50000000)throw Error('Resolução da imagem não suportada.');
    const scale=Math.min(360/bitmap.width,540/bitmap.height,1);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Não foi possível processar a capa.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.83);
  }finally{bitmap.close?.()}
}
$('#cov').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';
  const editor=pendingCover;if(!file||!editor||!dlg.open)return;
  try{
    const data=await coverFromFile(file);
    if(editor!==pendingCover||!dlg.open)return;
    editor.draft.cover=data;editor.coverChanged=true;editor.showCover();
    editor.setStatus('Nova capa preparada. Clique em Salvar para confirmar.');
  }catch(e){console.warn(e);editor.setStatus(e.message||'Imagem inválida.',true)}
};
dlg.addEventListener('close',()=>{pendingCover=null});
function bookDlg(m){

  const draft={title:m.title||'',author:m.author||'',series:m.series||'',volume:m.volume??'',genre:m.genre||'',description:m.description||'',cover:m.cover||'',fav:!!m.fav,sh:[...(m.sh||[])],f:Number(m.f)||0,p:m.p};
  const editor={draft,coverChanged:false,showCover:()=>{},setStatus:()=>{}};
  dialog('Editar livro',w=>{
    w.classList.add('book-editor');
    const top=document.createElement('div');top.className='book-edit-head';
    const cv=document.createElement('div');cv.className='cov book-edit-cover';
    editor.showCover=()=>{cv.replaceChildren();fillCov(cv,{title:draft.title||'?',cover:draft.cover||''})};editor.showCover();
    const intro=document.createElement('div');intro.className='book-edit-intro';
    const heading=document.createElement('strong');heading.textContent='Capa e informações';
    const subtitle=document.createElement('p');subtitle.textContent='O arquivo permanece intacto. O progresso só muda se você marcar o livro como lido.';
    const controls=document.createElement('div');controls.className='book-edit-cover-actions';
    controls.append(mbtn('Trocar capa',()=>{pendingCover=editor;$('#cov').click()}),mbtn('Remover capa',()=>{draft.cover='';editor.coverChanged=true;editor.showCover();editor.setStatus('A capa será removida ao salvar.')}));
    intro.append(heading,subtitle,controls);top.append(cv,intro);w.append(top);
    const status=document.createElement('p');status.className='book-edit-status';status.setAttribute('role','status');
    editor.setStatus=(txt,error=false)=>{status.textContent=txt;status.classList.toggle('error',error)};w.append(status);
    const fields=document.createElement('div');fields.className='book-edit-fields';
    const field=(name,value,max=180,tag='input')=>{
      const wrap=document.createElement('label');wrap.className='book-edit-field';
      const label=document.createElement('span');label.textContent=name;
      const input=document.createElement(tag);if(tag==='input')input.type='text';input.value=value;input.maxLength=max;input.autocomplete='off';
      wrap.append(label,input);fields.append(wrap);return input;
    };
    const ti=field('Título',draft.title,180),au=field('Autor',draft.author,140);ti.autofocus=true;
    const se=field('Série / coleção',draft.series,130),vol=field('Volume',String(draft.volume),5);
    vol.type='number';vol.min='1';vol.max='9999';vol.step='1';vol.placeholder='Ex.: 12';
    const suggest=mbtn('Sugerir série e volume pelo arquivo',()=>{
      const base=String(m.name||'').replace(/\.(pdf|epub|cbz|zip|txt)$/i,'').replace(/_+/g,' ').trim();
      const match=base.match(/^(.*?)\s*(?:[-–—. ]*(?:vol(?:ume)?\.?|tomo|v\.?|#)\s*0*(\d{1,4})|[-–—. ]+0*(\d{1,4}))\s*$/i);
      const series=match?.[1]?.replace(/[-–—. ]+$/,'').trim();
      const number=Number(match?.[2]||match?.[3]);
      const explicit=!!match?.[2];
      if(!series||series.length<2||!Number.isInteger(number)||number<1||number>9999||(!explicit&&number>=1900&&number<=2100)){
        editor.setStatus('Não foi possível identificar uma série e um volume com segurança. Preencha manualmente.');return;
      }
      se.value=series;vol.value=String(number);
      editor.setStatus('Sugestão encontrada. Confira os campos antes de salvar.');
    },'book-edit-clean');
    suggest.classList.add('book-edit-suggest');fields.append(suggest);
    const ge=field('Gênero',draft.genre,100),description=field('Descrição / observações',draft.description,1200,'textarea');
    description.rows=3;description.placeholder='Opcional';
    const clean=mbtn('Limpar nome',()=>{ti.value=cleanTitle(ti.value)},'book-edit-clean');clean.title='Remove sufixos desnecessários do título';
    const titleField=ti.closest('label');titleField.append(clean);
    w.append(fields);
    const info=document.createElement('div');info.className='book-edit-info';
    const labels=[['Formato',fmtLabel(m)],['Arquivo',m.name||'—'],['Tamanho',fmtSize(m.size)],['Progresso',Math.round((m.f||0)*100)+'%'],['Marcadores',(m.bm||[]).length]];
    labels.forEach(([key,val])=>{const item=document.createElement('div');item.append(Object.assign(document.createElement('span'),{textContent:key}),Object.assign(document.createElement('b'),{textContent:String(val)}));info.append(item)});w.append(info);
    const sh=shelves();
    if(sh.length){const label=document.createElement('div');label.className='book-edit-label';label.textContent='Estantes';w.append(label);
      const shelfRow=document.createElement('div');shelfRow.className='book-edit-shelves';
      sh.forEach(name=>{const button=mbtn(name,()=>{const i=draft.sh.indexOf(name);i<0?draft.sh.push(name):draft.sh.splice(i,1);button.classList.toggle('on',draft.sh.includes(name))},'chip');button.classList.toggle('on',draft.sh.includes(name));shelfRow.append(button)});w.append(shelfRow)}
    const toggles=document.createElement('div');toggles.className='book-edit-toggles';
    const fav=mbtn(draft.fav?'★ Favorito':'☆ Favoritar',()=>{draft.fav=!draft.fav;fav.textContent=draft.fav?'★ Favorito':'☆ Favoritar'});
    const read=mbtn(isDone(draft)?'Marcar como não lido':'Marcar como lido',()=>{if(isDone(draft)){draft.f=0;draft.p=null}else draft.f=1;read.textContent=isDone(draft)?'Marcar como não lido':'Marcar como lido'});
    toggles.append(fav,read);w.append(toggles);
    const actions=document.createElement('div');actions.className='book-edit-footer';
    const cancel=mbtn('Cancelar',()=>dlg.close());
    const remove=mbtn('Mover para a Lixeira',async()=>{if(!confirm('Remover "'+m.title+'" da biblioteca?'))return;
      try{await rmBooks([m.id]);books=books.filter(b=>b.id!==m.id);dlg.close();draw();toast('Livro movido para a Lixeira')}catch(e){editor.setStatus('Falha ao remover: '+e.message,true)}},'dg2');
    const save=mbtn('Salvar alterações',async()=>{
      const title=ti.value.trim(),author=au.value.trim(),series=se.value.trim(),genre=ge.value.trim(),desc=description.value.trim(),v=vol.value.trim();
      if(!title){editor.setStatus('Informe o título do livro.',true);ti.focus();return}
      if(v&&!/^[1-9]\d{0,3}$/.test(v)){editor.setStatus('O volume deve ser um número inteiro entre 1 e 9999.',true);vol.focus();return}
      save.disabled=true;editor.setStatus('Salvando alterações…');
      try{
        const current=await tx('books','readonly',store=>store.get(m.id));
        if(!current||current.user!==user)throw Error('O livro não está mais disponível neste perfil.');
        const updated={...current,title,author,series,volume:v?Number(v):null,genre,description:desc,sh:[...draft.sh],fav:draft.fav};
        if(editor.coverChanged)updated.cover=draft.cover;
        if(draft.f!==Number(m.f||0)){updated.f=draft.f;updated.p=draft.p}
        await saveBook(updated);
        const idx=books.findIndex(b=>b.id===m.id);if(idx>=0)books[idx]=updated;
        if(cur&&cur.meta.id===m.id){cur.meta=updated;$('#title').textContent=updated.title}
        dlg.close();draw();toast('Metadados salvos');
      }catch(e){console.error(e);editor.setStatus('Não foi possível salvar: '+e.message,true)}
      finally{save.disabled=false}
    },'primary');
    actions.append(remove,cancel,save);w.append(actions);
  });
}
$('#selm').onclick=()=>{selMode=!selMode;sel.clear();draw()};
$('#srt').onchange=e=>{srt=e.target.value;S.sort=srt;light();draw()};
$('#vg').onclick=()=>{S.view='grid';light();draw()};$('#vl').onclick=()=>{S.view='list';light();draw()};
$('#cs').oninput=e=>{S.cover=+e.target.value;light();$('#lib').style.setProperty('--cs',S.cover+'px')};
$('#av').onclick=()=>{const m=$('#avm');m.hidden=!m.hidden;$('#av').setAttribute('aria-expanded',String(!m.hidden));if(!m.hidden)syncAv()};
$('#goal').onclick=()=>{const v=parseInt(prompt('Meta diária de leitura, em minutos:',S.goal||30),10);if(v>0&&v<1000){S.goal=v;S.goalSet=true;light();draw()}};
function openConfigTab(k){$('#avm').hidden=true;$('#av').setAttribute('aria-expanded','false');curTab=k;$('#cfq').value='';show('cfg');tab(k)}
$('#cfgBtn').onclick=()=>openConfigTab('Aparência');
$('#avaccount').onclick=()=>openConfigTab('Conta');
$('#avdata').onclick=()=>openConfigTab('Dados');
$('#cfgBack').onclick=()=>{++cfgSearchId;$('#cfq').value='';showLib()};
let librarySearchTimer=null;
$('#q').oninput=()=>{
  clearTimeout(librarySearchTimer);
  if(lt!=='lib')return;
  librarySearchTimer=setTimeout(()=>{
    if(lt==='lib')draw();
  },115);
};
$('#add').onclick=()=>$('#file').click();
async function addFiles(fs){
  let ok=0;
  for(const [i,f] of fs.entries()){
    if(books.some(b=>!b.cloudGhost&&(b.name||b.title)===f.name&&b.size===f.size)&&!confirm('"'+f.name+'" já está na biblioteca. Adicionar mesmo assim?'))continue;
    toast(`Adicionando ${i+1} de ${fs.length}: ${f.name}`);
    try{await addBook(f);ok++}catch(err){console.error(err);toast('Não consegui adicionar "'+f.name+'"');await new Promise(r=>setTimeout(r,1500))}}
  if(ok){toast(ok+(ok>1?' livros adicionados':' livro adicionado'));persist()}showLib();
}
$('#file').onchange=e=>{const fs=[...e.target.files];e.target.value='';addFiles(fs)};
