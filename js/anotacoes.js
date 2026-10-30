
const HLC={amarelo:'#f6d55c',verde:'#7bd88f',azul:'#6cb4ee',rosa:'#f29ac0'};
let pend=null, highlightSearch='',highlightFilter='all';
function showSel(o){
  pend=o;const bar=$('#selbar');bar.replaceChildren();bar.classList.add('selection-toolbar');
  const quote=document.createElement('span');quote.className='selection-quote';
  quote.textContent='“'+o.x.slice(0,54)+(o.x.length>54?'…':'')+'”';bar.append(quote);
  const colors=document.createElement('span');colors.className='selection-colors';
  Object.entries(HLC).forEach(([name,color])=>{const b=document.createElement('button');b.type='button';b.className='dot';
    b.style.background=color;b.setAttribute('aria-label','Destacar '+name);b.title='Destacar '+name;
    b.onclick=()=>addHl(color);colors.append(b)});bar.append(colors);
  if(o.x.length<=400)bar.append(mbtn('Dicionário',()=>{const x=pend?.x;hideSel();if(x)lookupDlg(x)}));
  bar.append(mbtn('Anotar',()=>openHighlightEditor(null,o)));
  const close=mbtn('✕',hideSel);close.setAttribute('aria-label','Fechar seleção');bar.append(close);bar.hidden=false;
}
function hideSel(){const bar=$('#selbar');bar.hidden=true;bar.classList.remove('selection-toolbar');pend?.clear?.();pend=null}
function addHl(color,note='',source=pend){
  if(!source||!cur)return;
  const m=cur.meta;m.hl=m.hl||[];
  if(m.hl.length>=75){toast('Limite de 75 destaques ou notas por livro na sincronização.');return}
  const h={id:uid(),k:source.k,a:source.a,b:source.b,pg:source.pg,rc:source.rc,x:source.x,n:note,c:color,t:Date.now()};
  m.hl.push(h);saveBook(m).catch(console.error);hideSel();
  if(h.k==='e'||h.k==='t'||h.k==='p')cur.addHl?.(h);
  toast(note?'Destaque e anotação salvos':'Destaque salvo');
}
function locationLabel(h){
  if(h.k==='p')return 'Página '+((Number(h.pg)||0)+1);
  if(h.k==='t')return 'Texto';return 'EPUB';
}
function refreshHighlights(){if(cur)$('#mHl').click()}
function openHighlightEditor(existing=null,selection=null){
  if(!cur)return;
  $('#selbar').hidden=true;
  const original=selection||pend;
  sheet(existing?'Editar anotação':'Nova anotação',panel=>{
    panel.classList.add('highlight-editor-sheet');
    if(existing?.x||original?.x){const q=document.createElement('blockquote');q.className='highlight-editor-quote';
      q.textContent='“'+(existing?.x||original.x).slice(0,300)+'”';panel.append(q)}
    const label=document.createElement('label');label.className='hl-editor-label';label.textContent='Seu comentário';
    const field=document.createElement('textarea');field.rows=5;field.maxLength=1800;
    field.placeholder='Escreva uma observação sobre este trecho ou posição…';
    field.value=existing?.n||'';label.append(field);panel.append(label);
    const actions=document.createElement('div');actions.className='hl-editor-actions';
    const cancel=mbtn('Cancelar',()=>{panel.hidden=true;if(!existing)hideSel()});
    const save=mbtn('Salvar anotação',()=>{
      const note=field.value.trim();
      if(!note){toast('Escreva uma anotação antes de salvar.');field.focus();return}
      if(existing){existing.n=note;existing.t=Date.now();saveBook(cur.meta).catch(console.error);panel.hidden=true;toast('Anotação atualizada')}
      else if(original){addHl(HLC.amarelo,note,original);panel.hidden=true}
      else{toast('Não foi possível identificar a posição.');return}
      highlightFilter='all';refreshHighlights();
    },'primary');actions.append(cancel,save);panel.append(actions);
    setTimeout(()=>field.focus(),30);
  });
}
function addPositionNote(){
  if(!cur)return;const m=cur.meta;
  let location;
  if(cur.type==='pdf')location={k:'p',pg:Math.max(0,cur.i||0),rc:[],x:'Nota na página '+((cur.i||0)+1),noteOnly:true};
  else if(cur.type==='txt')location={k:'t',a:Math.floor((m.p||0)*(cur.txt?.length||0)),b:Math.floor((m.p||0)*(cur.txt?.length||0)),x:'Nota nesta posição do texto',noteOnly:true};
  else if(cur.type==='epub')location={k:'e',a:m.p,x:'Nota nesta posição do EPUB',noteOnly:true};
  if(!location||location.a==null&&location.k==='e')return toast('A posição ainda não está disponível.');
  const selection={...location};
  sheet('Anotar posição atual',panel=>{
    const p=document.createElement('p');p.className='note';p.textContent='Esta nota ficará vinculada à posição atual do livro.';panel.append(p);
    const field=document.createElement('textarea');field.className='hl-position-textarea';field.maxLength=1800;field.rows=5;field.placeholder='Sua anotação…';panel.append(field);
    const save=mbtn('Salvar anotação',()=>{
      const n=field.value.trim();if(!n){field.focus();return toast('Digite uma anotação.')}const arr=m.hl||(m.hl=[]);
      if(arr.length>=75)return toast('Limite de 75 destaques ou notas por livro na sincronização.');
      arr.push({id:uid(),...selection,n,c:HLC.amarelo,t:Date.now()});saveBook(m).catch(console.error);
      toast('Anotação salva');highlightFilter='notes';refreshHighlights();
    },'primary');save.classList.add('hl-save-position');panel.append(save);setTimeout(()=>field.focus(),30)
  });
}
function exportMd(m){
  const date=new Date().toLocaleDateString('pt-BR');
  const lines=['# '+m.title,'','Exportado do LECTOR em '+date,''];
  (m.hl||[]).forEach(h=>{lines.push('## '+locationLabel(h),'',h.noteOnly?'*Anotação na posição*':'> '+String(h.x||'').replace(/\n+/g,' '),'');if(h.n)lines.push(h.n,'');lines.push('---','')});
  const blob=new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download=(m.title||'LECTOR').replace(/[\\/:*?"<>|]/g,'-')+' - anotacoes.md';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function removeHighlight(h){
  if(!cur)return;const m=cur.meta;
  if(!confirm('Excluir este destaque ou anotação?'))return;
  if(h.k==='e'&&!h.noteOnly)try{cur.rmHl?.(h)}catch(e){console.warn(e)}
  m.hl=(m.hl||[]).filter(x=>x.id!==h.id);saveBook(m).catch(console.error);
  if(h.k==='p'||h.k==='t')cur.addHl?.();refreshHighlights();
}
function recolorHighlight(h,color){
  if(!cur)return;if(!Object.values(HLC).includes(color))return;
  if(h.k==='e'&&!h.noteOnly)try{cur.rmHl?.(h)}catch(e){console.warn(e)}
  h.c=color;h.t=Date.now();saveBook(cur.meta).catch(console.error);
  if(h.k==='e'&&!h.noteOnly)cur.addHl?.(h);
  else if(h.k==='t'||h.k==='p')cur.addHl?.();
  refreshHighlights();
}
$('#mHl').onclick=()=>sheet('Destaques e anotações',panel=>{
  panel.classList.add('highlight-panel');
  if(!['epub','txt','pdf'].includes(cur?.type)){
    const msg=document.createElement('p');msg.className='note';msg.textContent='Destaques e anotações de texto estão disponíveis para PDF, EPUB e TXT.';panel.append(msg);return}
  const m=cur.meta;m.hl=m.hl||[];
  const summary=document.createElement('div');summary.className='hl-summary';
  const nnotes=m.hl.filter(h=>h.n).length;
  summary.textContent=m.hl.length+' registros · '+nnotes+' com anotação';panel.append(summary);
  const controls=document.createElement('div');controls.className='hl-controls';
  const input=document.createElement('input');input.type='search';input.placeholder='Pesquisar nos trechos e notas';input.value=highlightSearch;
  input.setAttribute('aria-label','Buscar destaques e notas');controls.append(input);
  const types=document.createElement('div');types.className='hl-filter-tabs';
  [['all','Todos'],['highlights','Destaques'],['notes','Anotações']].forEach(([key,label])=>{
    const b=mbtn(label,()=>{highlightFilter=key;refreshHighlights()});b.classList.toggle('on',highlightFilter===key);types.append(b)});
  controls.append(types);panel.append(controls);
  const list=document.createElement('div');list.className='hl-list';panel.append(list);
  function drawList(){list.replaceChildren();const q=highlightSearch.trim().toLocaleLowerCase('pt-BR');
    const visible=[...m.hl].reverse().filter(h=>(highlightFilter==='all'||highlightFilter==='notes'&&!!h.n||highlightFilter==='highlights'&&!h.noteOnly)
      &&(!q||(String(h.x||'')+' '+String(h.n||'')).toLocaleLowerCase('pt-BR').includes(q)));
    if(!visible.length){const empty=document.createElement('p');empty.className='hl-empty';
      empty.textContent=m.hl.length?'Nenhum registro corresponde aos filtros.':'Selecione um trecho no livro ou crie uma anotação na posição atual.';list.append(empty);return}
    for(const h of visible){
      const card=document.createElement('article');card.className='hl-card';card.style.setProperty('--hl-color',Object.values(HLC).includes(h.c)?h.c:HLC.amarelo);
      const meta=document.createElement('div');meta.className='hl-meta';
      const place=document.createElement('span');place.textContent=locationLabel(h);
      const kind=document.createElement('span');kind.textContent=h.noteOnly?'Nota de posição':(h.n?'Destaque + nota':'Destaque');meta.append(place,kind);card.append(meta);
      const quote=document.createElement('p');quote.className='hl-quote';quote.textContent=h.noteOnly?'Anotação na posição atual':'“'+String(h.x||'').slice(0,400)+'”';card.append(quote);
      if(h.n){const note=document.createElement('p');note.className='hl-note';note.textContent=h.n;card.append(note)}
      const foot=document.createElement('div');foot.className='hl-actions';
      const jump=mbtn('Ir ao trecho',()=>{cur.jump(h.k==='e'?h.a:h.k==='p'?h.pg:(Number(h.a)||0)/Math.max(1,cur.txt?.length||1));$('#sheet').hidden=true});
      foot.append(jump);
      const colors=document.createElement('select');colors.className='hl-colors';colors.setAttribute('aria-label','Cor do destaque');
      Object.entries(HLC).forEach(([name,c])=>{const opt=document.createElement('option');opt.value=c;opt.textContent='● '+name;colors.append(opt)});
      colors.value=Object.values(HLC).includes(h.c)?h.c:HLC.amarelo;
      colors.onchange=()=>recolorHighlight(h,colors.value);if(!h.noteOnly)foot.append(colors);
      const edit=mbtn(h.n?'Editar nota':'Anotar',()=>openHighlightEditor(h));foot.append(edit);
      const del=mbtn('Excluir',()=>removeHighlight(h));del.classList.add('hl-delete');foot.append(del);
      card.append(foot);list.append(card)
    }
  }
  input.oninput=()=>{highlightSearch=input.value;drawList()};drawList();
  const bottom=document.createElement('div');bottom.className='hl-panel-bottom';
  bottom.append(mbtn('Anotar posição atual',addPositionNote,'primary'));
  if(m.hl.length)bottom.append(mbtn('Exportar Markdown',()=>exportMd(m)));
  panel.append(bottom);
});
