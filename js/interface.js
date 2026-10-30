
function shelfDialog(by){dialog(by.length>1?'Estantes ('+by.length+' livros)':'Estantes',w=>{
  const list=document.createElement('div');w.append(list);
  const state=n=>{const c=by.filter(x=>(x.sh||[]).includes(n)).length;return c===0?0:c===by.length?2:1};
  const toggle=async n=>{const on=state(n)!==2;by.forEach(x=>{x.sh=x.sh||[];const i=x.sh.indexOf(n);if(on&&i<0)x.sh.push(n);if(!on&&i>=0)x.sh.splice(i,1)});await Promise.all(by.map(saveBook));render();draw()};
  const render=()=>{list.replaceChildren(...shelves().map(n=>{const s=state(n),b=document.createElement('button');b.className='shrow'+(s?' on':'');
      b.innerHTML='<span class="ck2"></span><span class="nm"></span><small></small>';b.querySelector('.ck2').textContent=s===2?'✓':s===1?'–':'';b.querySelector('.nm').textContent=n;
      b.querySelector('small').textContent=books.filter(x=>(x.sh||[]).includes(n)).length+' livros';b.onclick=()=>toggle(n);return b}));
    if(!shelves().length)list.innerHTML='<p class="note">Você ainda não tem estantes. Crie a primeira abaixo.</p>'};
  render();
  const row=document.createElement('div');row.className='row';row.style.marginTop='12px';
  const i=document.createElement('input');i.type='text';i.placeholder='Nova estante';i.maxLength=30;i.setAttribute('aria-label','Nova estante');
  const add=mbtn('Criar',async()=>{const n=addShelf(i.value);if(!n)return;i.value='';await toggle(n)},'primary');add.style.flex='none';
  i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add.click()}};row.append(i,add);w.append(row);
  const done=mbtn('Concluir',()=>dlg.close());done.style.cssText='width:100%;margin-top:8px';w.append(done)})}
function newShelfDialog(after){dialog('Nova estante',w=>{
  const i=document.createElement('input');i.type='text';i.placeholder='Nome da estante';i.maxLength=30;i.setAttribute('aria-label','Nome da estante');w.append(i);
  const ok=mbtn('Criar estante',()=>{const n=addShelf(i.value);if(!n)return toast('Digite um nome');dlg.close();after&&after(n)},'primary');ok.style.cssText='width:100%;margin-top:12px';w.append(ok);
  i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ok.click()}};setTimeout(()=>i.focus(),60)})}
function renameShelfDialog(o){dialog('Renomear estante',w=>{
  const i=document.createElement('input');i.type='text';i.value=o;i.maxLength=30;i.setAttribute('aria-label','Nome da estante');w.append(i);
  const ok=mbtn('Salvar',async()=>{await renShelf(o,i.value);dlg.close()},'primary');ok.style.cssText='width:100%;margin-top:12px';i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ok.click()}};w.append(ok);setTimeout(()=>{i.focus();i.select()},60)})}
function deleteShelfDialog(o){dialog('Excluir estante',w=>{
  const p=document.createElement('p');p.style.lineHeight='1.5';p.textContent='Excluir a estante "'+o+'"? Os livros continuam na biblioteca.';w.append(p);
  const r=document.createElement('div');r.className='row';r.style.marginTop='12px';r.append(mbtn('Cancelar',()=>dlg.close()),mbtn('Excluir',async()=>{await delShelf(o);dlg.close()},'dg2'));w.append(r)})}
function bmDialog(){dialog('Marcadores',w=>{
  const bs=books.filter(b=>(b.bm||[]).length);
  if(!bs.length){w.insertAdjacentHTML('beforeend','<p class="note">Nenhum marcador ainda. Durante a leitura, use ☰ → Marcadores → "Marcar este ponto".</p>');return}
  bs.forEach(b=>{const t=document.createElement('div');t.className='lab';t.style.marginTop='12px';t.textContent=b.title;w.append(t);
    b.bm.forEach(m=>{const r=document.createElement('button');r.className='shrow';r.innerHTML='<span class="nm"></span><small></small>';r.querySelector('.nm').textContent=m.l;r.querySelector('small').textContent=new Date(m.t).toLocaleDateString();
      r.onclick=async()=>{dlg.close();await openBook(b);if(cur&&cur.jump)cur.jump(m.p)};w.append(r)})})})}
function qmenu(m,x,y){
  const q=$('#qm'),qi=(t,fn,c)=>mbtn(t,()=>{q.hidden=true;fn()},c);
  q.replaceChildren(qi(m.fav?'★ Remover dos favoritos':'☆ Favoritar',async()=>{m.fav=!m.fav;await saveBook(m);draw()}),
    qi('Estante…',()=>shelfDialog([m])),
    qi(isDone(m)?'Marcar como não lido':'Marcar como lido',async()=>{if(isDone(m)){m.f=0;m.p=null}else m.f=1;await saveBook(m);draw()}),
    qi('Editar informações e capa',()=>bookDlg(m)),
    qi('Mover para Lixeira',async()=>{if(confirm('Mover "'+m.title+'" para a Lixeira?')){await rmBooks([m.id]);showLib()}},'dg2'));
  const z=(S.ui||100)/100;q.hidden=false;q.style.left=Math.max(8,Math.min(x,innerWidth-220))/z+'px';q.style.top=Math.max(8,Math.min(y,innerHeight-300))/z+'px'}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#qm'))$('#qm').hidden=true},true);
$('#fmt').onchange=e=>{fmtF=e.target.value;draw()};
(()=>{const lib=$('#lib'),dz=$('#drop');let n=0;const has=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  lib.addEventListener('dragenter',e=>{if(!has(e))return;e.preventDefault();n++;dz.hidden=false});
  lib.addEventListener('dragover',e=>{if(has(e))e.preventDefault()});
  lib.addEventListener('dragleave',e=>{if(!has(e))return;n=Math.max(0,n-1);if(!n)dz.hidden=true});
  lib.addEventListener('drop',e=>{if(!has(e))return;e.preventDefault();n=0;dz.hidden=true;addFiles([...e.dataTransfer.files])})})();


function setBack(p){
  if(!cur||p==null)return;const b=$('#backbar');
  cur.back={p,l:cur.pages?'página '+(p+1):Math.round((cur.meta.f||0)*100)+'%'};
  b.replaceChildren(mbtn('↩ Voltar para '+cur.back.l,()=>{const k=cur.back;b.hidden=true;cur.back=null;cur.pages?cur.goto(k.p):cur.jump(k.p)},'primary'),mbtn('✕',()=>b.hidden=true));
  b.hidden=false;clearTimeout(cur.bt);cur.bt=setTimeout(()=>b.hidden=true,15000)}
function menuVis(){
  $('#mSelTxt').hidden=!(cur&&cur.type==='pdf'&&S.mode==='page');$('#mTh').hidden=!(cur&&cur.pages);
  $('#mSelTxt').textContent=cur&&cur.selmode?'Sair da seleção de texto':'Selecionar texto'}
$('#mSelTxt').onclick=()=>{cur.selmode=!cur.selmode;$('#pg').classList.toggle('selmode',cur.selmode);$('#menu').hidden=true;menuVis();
  toast(cur.selmode?'Modo seleção: pressione e arraste sobre o texto.':'Modo seleção desligado')};
$('#mTh').onclick=()=>sheet('Miniaturas',s=>{
  const reader=cur,g=document.createElement('div');g.className='thg';
  reader.thObserver?.disconnect();
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    if(cur!==reader||!g.isConnected){io.disconnect();return}
    if(!e.isIntersecting)return;
    io.unobserve(e.target);
    const target=e.target,i=+target.dataset.i;
    reader.thumb(i).then(u=>{
      if(!u||cur!==reader||!target.isConnected)return;
      const im=new Image();im.src=u;im.alt='';target.prepend(im)
    }).catch(()=>{});
  }),{root:s,rootMargin:'180px'});
  reader.thObserver=io;
  for(let i=0;i<cur.n;i++){const b=document.createElement('button');b.className='th'+(i===cur.i?' on':'');b.dataset.i=i;b.style.setProperty('--r',cur.ratio);
    b.setAttribute('aria-label','Página '+(i+1));b.innerHTML='<span></span>';b.firstChild.textContent=i+1;b.onclick=()=>{cur.goto(i);$('#sheet').hidden=true};g.append(b);io.observe(b)}
  s.append(g);setTimeout(()=>g.children[cur.i]&&g.children[cur.i].scrollIntoView({block:'center'}),60)});
function paintHl(d){
  if(!cur||cur.type!=='pdf')return;d.querySelectorAll('.hlL').forEach(x=>x.remove());
  const i=+d.dataset.i,hs=(cur.meta.hl||[]).filter(h=>h.k==='p'&&h.pg===i);if(!hs.length)return;
  const L=document.createElement('div');L.className='hlL';
  hs.forEach(h=>h.rc.forEach(r=>{const e=document.createElement('i');e.style.cssText=`left:${r[0]*100}%;top:${r[1]*100}%;width:${r[2]*100}%;height:${r[3]*100}%;background:${h.c}`;if(h.n)e.title=h.n;L.append(e)}));d.append(L)}
function pdfSel(){
  if(!cur||cur.type!=='pdf')return;const s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;const r=s.getRangeAt(0);
  const n=r.startContainer.nodeType===3?r.startContainer.parentElement:r.startContainer,el=n&&n.closest&&n.closest('.pgw');if(!el||!$('#pg').contains(el))return;
  const b=el.getBoundingClientRect(),rc=[...r.getClientRects()].filter(q=>q.width>2&&q.height>2).map(q=>[(q.left-b.left)/b.width,(q.top-b.top)/b.height,q.width/b.width,q.height/b.height]);
  const out=rc.filter((a,i)=>!rc.some((o,j)=>j!==i&&o[0]<=a[0]+.001&&o[1]<=a[1]+.001&&o[0]+o[2]>=a[0]+a[2]-.001&&o[1]+o[3]>=a[1]+a[3]-.001&&(o[2]*o[3]>a[2]*a[3]||(o[2]*o[3]===a[2]*a[3]&&j<i))));
  const x=r.toString().trim();if(x&&out.length)showSel({k:'p',pg:+el.dataset.i,rc:out,x,clear:()=>s.removeAllRanges()})}
$('#pg').addEventListener('mouseup',()=>setTimeout(pdfSel,40));$('#pg').addEventListener('touchend',()=>setTimeout(pdfSel,300));
let st2;document.addEventListener('selectionchange',()=>{clearTimeout(st2);st2=setTimeout(()=>{if(cur&&cur.type==='pdf'&&'ontouchstart' in window)pdfSel()},600)});


const LANGS={en:'Inglês','pt-BR':'Português',es:'Espanhol',fr:'Francês',de:'Alemão',it:'Italiano'};
const vocab=()=>lsGet('leitor:vocab:'+user)||[],setVocab=a=>lsSet('leitor:vocab:'+user,a);
const fetchJ=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(r.status);return r.json()};
async function define(w,lang){const d=await fetchJ('https://api.dictionaryapi.dev/v2/entries/'+lang+'/'+encodeURIComponent(w)),out=[];
  for(const m of ((d[0]&&d[0].meanings)||[]).slice(0,3)){const df=(m.definitions||[])[0];if(df)out.push({pos:m.partOfSpeech,def:df.definition,ex:df.example})}return out}
async function translate(t,from,to){const d=await fetchJ('https://api.mymemory.translated.net/get?q='+encodeURIComponent(t)+'&langpair='+(from==='pt-BR'?'pt':from)+'|'+to);return(d.responseData&&d.responseData.translatedText)||''}
const selEl=(key,opts,after)=>{const s=document.createElement('select');s.className='sel glass';s.dataset.k=key;s.setAttribute('aria-label',key);
  Object.entries(opts).forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;s.append(o)});s.value=S[key];s.onchange=()=>{S[key]=s.value;light();after&&after()};return s};
function lookupDlg(text){
  const w=text.trim().replace(/\s+/g,' '),word=w.split(' ').length===1?w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').toLowerCase():'';let res={def:[],tr:''};
  dialog(w.length>28?w.slice(0,28)+'…':w,box=>{
    const r1=document.createElement('div');r1.className='row';r1.style.alignItems='center';const ar=document.createElement('span');ar.textContent='→';ar.style.flex='none';
    r1.append(selEl('dictLang',LANGS,run),ar,selEl('trLang',LANGS,run));box.append(r1);
    const out=document.createElement('div');box.append(out);
    const save=mbtn('Salvar no vocabulário',()=>{const v=vocab();if(v.some(x=>x.w===(word||w)&&x.src===S.dictLang))return toast('Já está no vocabulário');
      v.push({id:uid(),w:word||w,d:(res.def[0]&&res.def[0].def)||'',tr:res.tr||'',src:S.dictLang,to:S.trLang,book:cur?cur.meta.title:'',t:Date.now(),n:0,nx:Date.now()});setVocab(v);toast('Salvo no vocabulário')},'primary');
    save.style.cssText='width:100%;margin-top:12px';box.append(save);
    async function run(){out.innerHTML='<p class="note">Buscando…</p>';res={def:[],tr:''};let bad=0;
      if(word)try{res.def=await define(word,S.dictLang)}catch{}
      if(S.dictLang!==S.trLang)try{res.tr=await translate(w.slice(0,400),S.dictLang,S.trLang)}catch{bad++}
      out.replaceChildren();
      if(bad&&!res.def.length&&!res.tr){out.innerHTML='<p class="note">Sem conexão: o dicionário e a tradução precisam de internet.</p>';return}
      if(res.tr){const l=document.createElement('div');l.className='lab';l.textContent='Tradução';const t=document.createElement('p');t.style.cssText='font-size:18px;font-weight:600;margin:6px 0 12px';t.textContent=res.tr;out.append(l,t)}
      if(res.def.length){const l=document.createElement('div');l.className='lab';l.textContent='Definição';out.append(l);
        res.def.forEach(d=>{const p=document.createElement('p');p.style.cssText='margin:6px 0;line-height:1.45';p.textContent=(d.pos?d.pos+': ':'')+d.def;out.append(p);
          if(d.ex){const e=document.createElement('p');e.className='note';e.textContent='“'+d.ex+'”';out.append(e)}})}
      else if(word&&!bad)out.insertAdjacentHTML('beforeend','<p class="note">Definição não encontrada para esta palavra.</p>')}
    run()})}
function review(){
  const q=vocab().filter(x=>x.nx<=Date.now()).sort((a,b)=>a.nx-b.nx);if(!q.length)return toast('Nada para revisar agora');
  dialog('Revisão',w=>{const body=document.createElement('div');w.append(body);let i=0;
    const grade=(x,ok)=>{const v=vocab(),y=v.find(z=>z.id===x.id);if(y){y.n=ok?(y.n||0)+1:0;y.nx=Date.now()+(ok?[1,2,4,8,16,32][Math.min(y.n-1,5)]*864e5:10*60e3);setVocab(v)}i++;step()};
    const step=()=>{body.innerHTML='';
      if(i>=q.length){const p=document.createElement('p');p.textContent='Revisão concluída!';p.style.cssText='font-size:18px;margin-bottom:16px';const c=mbtn('Fechar',()=>{dlg.close();tab()},'primary');c.style.width='100%';body.append(p,c);return}
      const x=q[i],h=document.createElement('div');h.style.cssText='text-align:center;padding:16px 0';
      h.innerHTML='<div class="lab"></div><div style="font-size:30px;font-weight:700;margin:12px 0"></div><div class="ans"></div>';h.children[0].textContent=(i+1)+' / '+q.length;h.children[1].textContent=x.w;
      const ans=h.querySelector('.ans'),act=document.createElement('div');act.className='row';act.style.marginTop='16px';
      const rev=mbtn('Mostrar resposta',()=>{ans.innerHTML='<p style="font-size:18px;font-weight:600"></p><p class="note"></p>';ans.children[0].textContent=x.tr||'—';ans.children[1].textContent=x.d||'';
        act.replaceChildren(mbtn('Esqueci',()=>grade(x,false),'dg2'),mbtn('Lembrei',()=>grade(x,true),'primary'))},'primary');
      rev.style.width='100%';act.append(rev);body.append(h,act)};
    step()})}
function exportVocab(){
  const v=vocab();if(!v.length)return toast('Nada para exportar');
  const t=v.map(x=>[x.w,x.tr,x.d,x.book].map(s=>String(s||'').replace(/[\t\n\r]+/g,' ')).join('\t')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/tab-separated-values'}));a.download='vocabulario-'+user+'.tsv';a.click()}
function paneVocab(p){
  const v=vocab(),due=v.filter(x=>x.nx<=Date.now());let g=grpP(p,'Vocabulário');
  const st=document.createElement('div');st.className='sts';
  [[v.length,'Palavras salvas'],[due.length,'Para revisar agora']].forEach(([a,l])=>{const c=document.createElement('div');c.className='stc';c.innerHTML='<b></b><span></span>';c.children[0].textContent=a;c.children[1].textContent=l;st.append(c)});g.append(st);
  ctl(g,'Revisão com repetição espaçada',mbtn('Revisar agora',review,'primary'));ctl(g,'Exportar para Anki ou planilha',mbtn('Exportar TSV',exportVocab));
  g=grpP(p,'Palavras');
  if(!v.length){const n=document.createElement('p');n.className='note';n.textContent='Selecione uma palavra durante a leitura e toque em Dicionário para salvar aqui.';g.append(n)}
  [...v].sort((a,b)=>b.t-a.t).forEach(x=>{const r=document.createElement('div');r.className='ctl';const sp=document.createElement('span');sp.innerHTML='<b></b><br><small></small>';
    sp.querySelector('b').textContent=x.w;sp.querySelector('small').textContent=[x.tr,x.book].filter(Boolean).join(' · ');
    r.append(sp,mbtn('✕',()=>{setVocab(vocab().filter(y=>y.id!==x.id));tab()}));g.append(r)})}



(()=>{const lib=$('#lib'),bar=$('#libbar');let last=0;
  lib.addEventListener('scroll',()=>{const y=lib.scrollTop;bar.classList.toggle('scrolled',y>8);
    bar.classList.toggle('hide',innerWidth<=600&&y>last&&y>90&&$('#avm').hidden&&document.activeElement!==$('#q'));last=y},{passive:true});
  document.addEventListener('click',e=>{if(!e.target.closest('.avw')){$('#avm').hidden=true;$('#av').setAttribute('aria-expanded','false')}});
  $('#avm').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#avm').hidden=true;$('#av').setAttribute('aria-expanded','false');$('#av').focus()}});
  $('#q').addEventListener('focus',()=>bar.classList.remove('hide'));
  $('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#q').blur();goColl()}});
  document.addEventListener('keydown',e=>{if($('#lib').hidden)return;
    const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('#dlg').open;
    if(e.key==='/'&&!typing){e.preventDefault();$('#q').focus()}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#q').focus();$('#q').select()}
    if(e.key==='Escape'&&e.target===$('#q')){$('#q').value='';clearTimeout(librarySearchTimer);draw();$('#q').blur()}})})();


const LT=[['home','Início','home'],['lib','Biblioteca','library'],['shelves','Estantes','layers'],['vocab','Vocabulário','type'],['stats','Estatísticas','chart']];
const NAV_ICONS={
 home:'<path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
 library:'<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><path d="m18 7 3 13M18 7l2-.5M21 20l-2 .5"/>',
 layers:'<rect x="3" y="5" width="18" height="5" rx="1.5"/><rect x="3" y="14" width="18" height="5" rx="1.5"/><path d="M7 10v4M17 10v4"/>',
 type:'<path d="M4 7V5h16v2M12 5v14M9 19h6"/><path d="M5 13h4M7 11v7"/>',
 chart:'<path d="M4 20V12h4v8M10 20V4h4v16M16 20v-9h4v9M2 20h20"/>',
 'settings':'<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>',
 'user':'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 'palette':'<path d="M12 3a9 9 0 0 0 0 18h1.2a2.1 2.1 0 0 0 1.7-3.3 1.8 1.8 0 0 1 1.4-2.9H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3z"/><circle cx="7.5" cy="12" r="1"/><circle cx="9" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
 'book-open':'<path d="M12 6v15M12 6C9 4 6 4 3 5v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1"/>',
 'database':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
 'search':'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
 'download':'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
 'upload':'<path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/>',
 'heart':'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
 'file-pen':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 18l2-.5 6.5-6.5-1.5-1.5L8.5 16z"/>',
 'bookmark':'<path d="M5 4h14v18l-7-5-7 5z"/>',
 'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 'check':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 'activity':'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
 'target':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 'trash':'<path d="M3 6h18M9 6V4h6v2m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
 'sync':'<path d="M20 11a8.1 8.1 0 0 0-15.5-2"/><path d="M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2"/><path d="M20 20v-5h-5"/>',
 'cloud':'<path d="M7 18H6a4 4 0 0 1-.4-8 6.5 6.5 0 0 1 12.4 1.6A3.5 3.5 0 0 1 18 18h-1"/><path d="m8 20 4-4 4 4m-4-4v6"/>',
 'log-out':'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'
};
function navIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','22');svg.setAttribute('height','22');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.75');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('aria-hidden','true');svg.innerHTML=NAV_ICONS[name]||NAV_ICONS.library;return svg}
function initStaticIcons(){
 document.querySelectorAll('#libbar .search > span,#cfgbar .search > span').forEach(el=>{el.replaceChildren(navIcon('search'))});

 const brand=document.querySelector('#libbar .brand-mark');
 if(brand){
   const img=document.createElement('img');img.src='./icons/icon-192.png';img.alt='';
   img.width=36;img.height=36;img.decoding='async';
   img.addEventListener('load',()=>brand.classList.add('has-favicon'),{once:true});
   img.addEventListener('error',()=>{brand.classList.remove('has-favicon');brand.replaceChildren(navIcon('book-open'))},{once:true});
   brand.replaceChildren(img);
 }
 const names={avaccount:'user',cfgBtn:'settings',avdata:'database',avinst:'download'};
 for(const [id,key] of Object.entries(names)){const node=document.querySelector('#'+id+' .pm-icon');if(node)node.replaceChildren(navIcon(key))}
 const showButton=document.getElementById('exb');if(showButton){showButton.replaceChildren(navIcon('settings'),document.createTextNode(' Exibir'))}
}
function initVisualRail(){
 const rail=document.getElementById('lectorRail');if(!rail)return;
 const map={home:'home',lib:'library',shelves:'layers',vocab:'type',stats:'chart'};
 rail.querySelectorAll('[data-lector-nav]').forEach(button=>{
   const key=button.dataset.lectorNav;
   const holder=button.querySelector('.lector-rail-icon');
   if(holder&&!holder.firstElementChild)holder.append(navIcon(map[key]));
   button.onclick=()=>setLT(key);
 });
 const settingsIcon=document.querySelector('#lectorRailSettings .lector-rail-icon');
 if(settingsIcon&&!settingsIcon.querySelector('svg'))settingsIcon.append(navIcon('settings'));
 document.getElementById('lectorRailSettings').onclick=()=>openConfigTab('Aparência');
 for(const [id,icon,handler] of [
  ['lectorFavNav','heart',()=>{flt='fav';setLT('lib')}],
  ['lectorNotesNav','file-pen',openLibraryNotes],
  ['lectorTrashNav','trash',openTrashPanel],
  ['lectorSyncNav','sync',openSyncPanel]
 ]){
   const btn=document.getElementById(id);btn.querySelector('.lector-rail-icon').replaceChildren(navIcon(icon));btn.onclick=handler;
 }
 for(const [id,icon,handler] of [['lectorCloudTop','sync',openSyncPanel],['lectorTrashTop','trash',openTrashPanel],['lectorSettingsTop','settings',()=>openConfigTab('Conta')]]){
   const btn=document.getElementById(id);btn.replaceChildren(navIcon(icon));btn.onclick=handler;
 }
 updateLECTORShortcuts();
 syncVisualRail();
}
function syncVisualRail(){
 updateLECTORShortcuts();
 document.querySelectorAll('#lectorRail [data-lector-nav]').forEach(button=>{
   const active=button.dataset.lectorNav===lt;
   button.classList.toggle('on',active);
   button.setAttribute('aria-current',active?'page':'false');
 });

}
function buildTabs(){
  const mk=mobile=>LT.map(([key,label,icon])=>{const b=document.createElement('button');b.type='button';b.dataset.t=key;
    b.setAttribute('role','tab');b.setAttribute('aria-label',label);
    if(mobile){const i=document.createElement('span');i.className='nav-icon';i.append(navIcon(icon));
      const cap=document.createElement('small');cap.textContent=label;b.append(i,cap)}else b.textContent=label;
    b.onclick=()=>setLT(key);return b});
  $('#ltabs').replaceChildren(...mk(false));$('#lbn').replaceChildren(...mk(true));
}
function syncTabs(){document.querySelectorAll('#ltabs button,#lbn button').forEach(b=>{const on=b.dataset.t===lt;b.classList.toggle('on',on);b.setAttribute('aria-selected',on);on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});syncVisualRail();const sr=$('#viewStatus');if(sr)sr.textContent=({home:'Início',lib:'Biblioteca',shelves:'Estantes',vocab:'Vocabulário',stats:'Estatísticas'})[lt]||''}
function setLT(k){if(k!=='lib')releaseLibraryBatch();lt=k;S.lt=k;light();['home','lib','shelves','vocab','stats'].forEach(v=>$('#v-'+v).hidden=v!==k);syncTabs();renderLT();$('#lib').scrollTo({top:0})}
function renderLT(){
  if(lt==='home'||lt==='lib')draw();else if(lt==='shelves')drawShelves();
  else if(lt==='vocab'){const c=$('#v-vocab');c.innerHTML='';curTab='Vocabulário';paneVocab(c)}
  else{const c=$('#v-stats');c.innerHTML='';curTab='Estatísticas';paneEst(c)}}
$('#q').addEventListener('input',()=>{if($('#q').value&&lt!=='lib')setLT('lib')});
$('#exb').onclick=e=>{e.stopPropagation();const m=$('#exm');m.hidden=!m.hidden;$('#exb').setAttribute('aria-expanded',!m.hidden)};
document.addEventListener('click',e=>{if(!e.target.closest('.exw')){$('#exm').hidden=true;$('#exb').setAttribute('aria-expanded','false')}});


function drawShelves(){
  const c=$('#v-shelves');c.innerHTML='';
  const hd=document.createElement('div');hd.className='shr';hd.innerHTML='<h3 class="sh">Estantes</h3>';
  hd.append(mbtn('+ Nova estante',()=>newShelfDialog(n=>{flt='sh:'+n;setLT('lib')}),'primary'));c.append(hd);
  const g=document.createElement('div');g.className='shg';
  const items=[{n:'Favoritos',l:books.filter(b=>b.fav),go:()=>{flt='fav';setLT('lib')}},
    ...shelves().map(n=>({n,l:books.filter(b=>(b.sh||[]).includes(n)),user:true,go:()=>{flt='sh:'+n;setLT('lib')}}))];
  items.forEach(it=>{
    const d=document.createElement('div');d.className='shc glass';d.tabIndex=0;d.setAttribute('role','button');d.setAttribute('aria-label',it.n);
    const mos=document.createElement('div');mos.className='mos';
    it.l.slice(0,3).forEach((m,i)=>{const e=document.createElement('div');e.className='mc';e.style.cssText=`left:${i*34}px;z-index:${3-i}`;fillCov(e,m);mos.append(e)});
    if(!it.l.length){const e=document.createElement('div');e.className='mc empty';e.textContent='＋';mos.append(e)}
    const nm=document.createElement('b'),ct=document.createElement('small');nm.textContent=it.n;ct.textContent=it.l.length+(it.l.length===1?' livro':' livros');d.append(mos,nm,ct);
    if(it.user){const a=document.createElement('div');a.style.cssText='display:flex;gap:6px;margin-top:6px';
      a.append(mbtn('Renomear',e=>{e.stopPropagation();renameShelfDialog(it.n)},'chip'),mbtn('Excluir',e=>{e.stopPropagation();deleteShelfDialog(it.n)},'chip dg2'));d.append(a)}
    d.onclick=it.go;d.onkeydown=e=>{if(e.key==='Enter')it.go()};g.append(d)});
  c.append(g);
  if(!shelves().length){const n=document.createElement('p');n.className='note';n.style.marginTop='14px';n.textContent='Estantes organizam sua biblioteca do seu jeito. Crie a primeira com o botão acima.';c.append(n)}}


function buildStats(reading){
  const tot=Object.values(hist()).reduce((a,b)=>a+b,0);
  const bmN=books.reduce((n,b)=>n+(b.bm||[]).length,0);
  const size=books.reduce((n,b)=>n+(b.size||0),0);
  const icons={
    read:'<path d="M12 7v14m0-14C9.5 5.7 6.5 5.5 3 6v14c3.5-.5 6.5-.3 9 1m0-14c2.5-1.3 5.5-1.5 9-1v14c-3.5-.5-6.5-.3-9 1"/>',
    done:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    bookmark:'<path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-5-7 5z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    storage:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>'
  };
  const sc=(v,l,key,fn,sub)=>{
    const d=document.createElement('button');d.className='stc glass stat-'+key;
    const svg='<svg class="stat-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[key]+'</svg>';
    d.innerHTML='<div class="stat-top">'+svg+'<span class="stat-arrow" aria-hidden="true">›</span></div><div class="stat-info"><b></b><span></span></div>';
    d.querySelector('b').textContent=v;
    d.querySelector('.stat-info span').textContent=l;
    if(sub){const hint=document.createElement('small');hint.className='stat-hint';hint.textContent=sub;d.append(hint)}
    d.onclick=fn;d.setAttribute('aria-label',l+': '+v);return d;
  };
  $('#stats').hidden=!(S.sStats&&books.length);
  $('#stats').replaceChildren(
    sc(reading.length,'Lendo agora','read',()=>{flt='read';setLT('lib')}),
    sc(books.filter(isDone).length,'Concluídos','done',()=>{flt='done';setLT('lib')}),
    sc(bmN,'Marcadores','bookmark',bmDialog),
    sc(tot?fmt(tot):'—','Tempo lido','clock',()=>setLT('stats')),
    sc(fmtSize(size),'Armazenamento','storage',()=>{curTab='Dados';show('cfg');tab()},books.length+' arquivos na biblioteca')
  );
}
function openLibraryNotes(){
  const all=[];
  books.forEach(b=>(b.hl||[]).forEach(h=>all.push([b,h])));
  all.sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  dialog('Anotações da biblioteca',w=>{
    if(!all.length){
      const empty=document.createElement('p');empty.className='note';
      empty.textContent='Nenhuma anotação ainda. Durante a leitura, selecione um trecho e adicione uma nota.';
      w.append(empty);return;
    }
    const list=document.createElement('div');list.className='library-notes-list';
    all.forEach(([book,highlight])=>{
      const item=document.createElement('button');item.type='button';item.className='library-notes-item';
      const title=document.createElement('strong');title.textContent=book.title;
      const quote=document.createElement('span');quote.textContent=String(highlight.n||highlight.x||'Anotação sem texto');
      item.append(title,quote);
      item.onclick=async()=>{
        dlg.close();await openBook(book);
        if(cur?.jump)cur.jump(highlight.k==='e'?highlight.a:highlight.k==='p'?highlight.pg:(cur.txt?highlight.a/cur.txt.length:0));
      };
      list.append(item);
    });
    w.append(list);
  });
}
function buildNotes(){
  const c=$('#notes'),all=[];books.forEach(b=>(b.hl||[]).forEach(h=>all.push([b,h])));all.sort((a,b)=>b[1].t-a[1].t);
  c.hidden=!(S.sNotes&&all.length);if(c.hidden)return;c.replaceChildren();
  const heading=document.createElement('div');heading.className='note-section-head';
  const t=document.createElement('h4');t.textContent='Últimas anotações';heading.append(t);
  const allButton=document.createElement('button');allButton.type='button';allButton.className='note-see-all';allButton.textContent='Ver tudo';
  allButton.onclick=openLibraryNotes;
  heading.append(allButton);c.append(heading);
  all.slice(0,2).forEach(([b,h])=>{const r=document.createElement('button');r.type='button';r.className='shrow note-entry';
    r.style.setProperty('--note-color',/^#[0-9a-f]{3,8}$/i.test(h.c||'')?h.c:'var(--accent)');
    const nm=document.createElement('span');nm.className='nm';
    const snippet=String(h.n||h.x||'Anotação sem texto').replace(/\s+/g,' ').trim();
    nm.textContent='“'+snippet+'”';nm.title=snippet;
    const small=document.createElement('small');small.textContent=b.title;r.append(nm,small);
    r.setAttribute('aria-label','Abrir anotação de '+b.title+': '+snippet);
    r.onclick=async()=>{await openBook(b);if(cur&&cur.jump)cur.jump(h.k==='e'?h.a:h.k==='p'?h.pg:(cur.txt?h.a/cur.txt.length:0))};c.append(r)})}
function buildVcard(){
  const c=$('#vcard'),v=vocab(),due=v.filter(x=>x.nx<=Date.now());c.hidden=!(S.sVocab&&v.length);if(c.hidden)return;c.replaceChildren();
  const t=document.createElement('h4'),s=document.createElement('small');t.textContent='Vocabulário';s.textContent=v.length+' palavras · '+due.length+' para revisar';s.style.opacity='.7';
  c.append(t,s,due.length?mbtn('Revisar agora',review,'primary'):mbtn('Ver vocabulário',()=>setLT('vocab')))}
function buildOnb(){
  const c=$('#onb'),st=[['Adicione seus primeiros livros',books.length>=3,()=>$('#file').click(),'Adicionar'],
    ['Crie uma estante',shelves().length>0,()=>newShelfDialog(n=>{flt='sh:'+n;setLT('lib')}),'Criar'],
    ['Defina sua meta diária',!!S.goalSet,()=>$('#goal').click(),'Definir'],
    ['Instale o app',isApp(),()=>deferredInstall?$('#avinst').click():toast('Use o menu do navegador → "Instalar LECTOR".'),'Instalar'],
    ['Comece a ler um livro',books.some(b=>b.f>0),()=>setLT('lib'),'Abrir']];
  const dn=st.filter(s=>s[1]).length;c.hidden=!(S.sOnb&&dn<st.length);if(c.hidden)return;c.replaceChildren();
  const hd=document.createElement('div');hd.className='rh2';const t=document.createElement('h3');t.className='sh';t.textContent='Comece por aqui';t.style.margin='0';
  const x=mbtn('✕',()=>{S.sOnb=false;light();draw()});x.className='chip glass';x.setAttribute('aria-label','Dispensar');hd.append(t,x);c.append(hd);
  const pr=document.createElement('div');pr.className='mini';pr.innerHTML='<i></i>';pr.firstChild.style.width=(dn/st.length*100)+'%';c.append(pr);
  st.forEach(([l,okk,fn,bt])=>{const r=document.createElement('div');r.className='obr'+(okk?' ok':'');const ck=document.createElement('span');ck.className='ck2';ck.textContent=okk?'✓':'';
    const tx=document.createElement('span');tx.className='nm';tx.textContent=l;r.append(ck,tx);if(!okk){const a=mbtn(bt,fn);a.className='chip glass';r.append(a)}c.append(r)})}


function syncAv(){
  avEl($('#avpreview'),uRec);
  $('#avn').textContent=user;
  document.querySelectorAll('#avth button').forEach(b=>{
    const active=b.dataset.a===S.app;
    b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));
  });
  $('#av').setAttribute('aria-expanded',String(!$('#avm').hidden));
  $('#avinst').hidden=!deferredInstall||isApp();
}
document.querySelectorAll('#avth button').forEach(b=>b.onclick=e=>{e.stopPropagation();S.app=b.dataset.a;apply();syncAv()});
$('#avinst').onclick=async()=>{$('#avm').hidden=true;if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null}};


function cleanTitle(t){
  let s=t.replace(/\.(pdf|epub|cbz|txt|zip)$/i,'').replace(/_+/g,' ').replace(/\s+/g,' ').trim(),prev;
  do{prev=s;s=s.replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/,'').replace(/\s*[\(\[][^\)\]]*$/,'').trim()}while(s!==prev&&s.length>2);
  s=s.replace(/[\s\-–—:,.]+$/,'').replace(/^[\s\-–—:,.]+/,'').trim();return s||t}


function paint(i){const mn=+i.min||0,mx=+i.max||100;i.style.setProperty('--pct',((i.value-mn)/(mx-mn)*100)+'%')}
document.addEventListener('input',e=>{if(e.target.type==='range')paint(e.target)},true);
const INFO={'Modo':{d:'Uma página por vez ou rolagem contínua.'},
 'Ajustar à':{d:'Encaixa a página na tela inteira ou na largura.',f:'PDF · Imagens'},
 'Mangá (direita → esquerda)':{d:'As páginas viram da direita para a esquerda.',f:'Imagens'},
 'Duas páginas lado a lado':{d:'Mostra duas páginas juntas em telas largas.',f:'PDF · Imagens'},
 'Capa em página separada':{d:'A primeira página fica sozinha, como num livro impresso.',f:'PDF · Imagens'},
 'Zoom':{d:'Aumenta ou diminui o texto e a página.'},'Brilho':{d:'Escurece a tela inteira durante a leitura.'},'Luz quente':{d:'Reduz a luz azul para ler à noite.'},
 'Aplicar o tema à página (PDF e imagens)':{d:'Inverte ou tinge as cores da própria página.',f:'PDF · Imagens'},
 'Brilho da página':{d:'Escurece só a página, sem mexer no fundo.',f:'PDF · Imagens'},
 'Fundo da leitura':{d:'Cor atrás da página e do texto, independente do tema.'},
 'Fonte':{d:'Tipo de letra do texto.',f:'EPUB · TXT'},'Espaçamento':{d:'Distância entre as linhas.',f:'EPUB · TXT'},
 'Justificar texto':{d:'Alinha o texto nas duas margens.',f:'EPUB · TXT'},'Hifenização':{d:'Quebra palavras no fim da linha.',f:'EPUB · TXT'},'Margens':{d:'Espaço nas laterais do texto.',f:'EPUB · TXT'},
 'Manter a tela ligada':{d:'Evita que a tela apague enquanto você lê.'},'Toque nas bordas':{d:'Botões nas laterais para virar a página.'},'Relógio e bateria':{d:'Mostra hora e bateria no topo da leitura.'},
 'Idioma do texto':{d:'Idioma usado no dicionário.'},'Traduzir para':{d:'Idioma das traduções.'},
 'Tema do app':{d:'Claro, escuro ou segue o sistema.'},'Visual de vidro':{d:'Efeito translúcido nos cartões.'},'Densidade':{d:'Espaço entre os elementos.'},'Tamanho do texto da interface':{d:'Aumenta toda a interface.'}};
function effT(){const t=THEMES[S.theme],c=S.rbg==='black'?'#000000':S.rbg==='gray'?'#2b2b2e':S.rbg==='custom'?(S.rbgc||'#000000'):null;if(!c)return t;
  const dk=lum(c)<.5,tdk=lum(t.bg)<.5;return{...t,bg:c,fg:dk===tdk?t.fg:(dk?'#d4d4d4':'#222222')}}
function bgCtl(){const w=document.createElement('div');w.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';w.dataset.k='rbg';
  const ci=document.createElement('input');ci.type='color';ci.value=S.rbgc||'#000000';ci.setAttribute('aria-label','Cor do fundo');ci.hidden=S.rbg!=='custom';ci.oninput=()=>{S.rbgc=ci.value;apply()};
  w.append(seg('rbg',[['theme','Tema'],['black','Preto'],['gray','Cinza'],['custom','Outra']],()=>{ci.hidden=S.rbg!=='custom'}),ci);return w}
function paintPreview(){const el=document.getElementById('prev');if(!el)return;const t=effT(),i=el.firstChild,s=i.style;
  el.style.background=t.bg;el.style.color=t.fg;s.fontFamily=FONTS[S.font];s.fontSize=(16*S.size/100)+'px';s.lineHeight=S.lh;s.textAlign=S.just?'justify':'left';s.hyphens=S.hy?'auto':'manual';s.fontWeight=t.w;s.padding='0 '+Math.min(S.mg,64)+'px'}
function refreshChg(){
  if($('#cfg').hidden&&$('#sheet').hidden)return;
  document.querySelectorAll('.ctl[data-k]').forEach(r=>r.classList.toggle('chg',S[r.dataset.k]!==DEF[r.dataset.k]));
  document.querySelectorAll('.card2').forEach(c=>{if(c._rb)c._rb.hidden=![...c._keys].some(k=>S[k]!==DEF[k])})}
const matchQ=(hay,nq)=>nq.split(/\s+/).filter(Boolean).every(t=>hay.includes(t)||(t.length>=5&&hay.includes(t.slice(0,-1))));
const normS=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
async function searchCfg(q){
  const request=++cfgSearchId,p=$('#pane'),keep=curTab,nq=normS(q);
  p.replaceChildren();
  const intro=document.createElement('div');intro.className='cfg-intro';
  intro.innerHTML='<h2>Resultados da busca</h2><p>Pesquisando em todas as categorias…</p>';
  p.append(intro);
  const found=document.createDocumentFragment();let any=false;
  for(const [n,fn] of TABS){
    curTab=n;
    const box=document.createElement('div');
    try{await fn(box)}catch(e){console.error('Erro na busca de configurações:',n,e)}
    if(request!==cfgSearchId||$('#cfg').hidden||$('#cfq').value.trim()!==q)return;
    box.querySelectorAll('.prev').forEach(e=>e.remove());
    box.querySelectorAll('.ctl,.account-searchable').forEach(r=>{r.hidden=!matchQ(normS(r.textContent),nq)});
    box.querySelectorAll('.themes').forEach(t=>{t.hidden=!matchQ('tema temas cor cores fundo',nq)});
    box.querySelectorAll('.grp').forEach(g=>{
      const has=[...g.querySelectorAll('.ctl,.themes,.account-searchable')].some(r=>!r.hidden);
      g.hidden=!has;
      if(has){any=true;const title=g.querySelector('.lab');if(title)title.dataset.searchGroup=n}
    });
    if([...box.querySelectorAll('.grp')].some(g=>!g.hidden)){
      const hd=document.createElement('h3');hd.className='cfg-search-heading';hd.textContent=n;
      const group=document.createElement('div');group.className='cfg-search-results';group.append(hd,box);found.append(group);
    }
  }
  curTab=keep;
  if(request!==cfgSearchId)return;
  intro.querySelector('p').textContent=any?'Ajustes encontrados para “'+q+'”.':'Nenhum ajuste encontrado para “'+q+'”.';
  p.append(found);refreshChg();
}
let cfgSearchTimer;
$('#cfq').addEventListener('input',()=>{clearTimeout(cfgSearchTimer);const q=$('#cfq').value.trim();if(!q){++cfgSearchId;tab();return}cfgSearchTimer=setTimeout(()=>searchCfg(q),170)});
$('#cfq').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#cfq').value='';tab()}});
$('#cfg').addEventListener('scroll',()=>$('#cfgbar').classList.toggle('scrolled',$('#cfg').scrollTop>8),{passive:true});


const EN={'Escolha seu perfil. Cada perfil tem a própria biblioteca, guardada neste aparelho.':'Choose your profile. Each profile has its own library, stored on this device.','Criar novo perfil':'Create new profile','Criar perfil':'Create profile','Nome':'Name','PIN (opcional, 4+ dígitos)':'PIN (optional, 4+ digits)','Entrar':'Sign in','PIN incorreto':'Wrong PIN','O PIN precisa ter 4 ou mais dígitos':'The PIN must have 4 or more digits','Já existe um perfil com esse nome':'A profile with that name already exists',
'Buscar na biblioteca':'Search library','Buscar':'Search','Minha biblioteca':'My library','+ Adicionar livros':'+ Add books','Perfil':'Profile','Sair do perfil':'Sign out','Configurações':'Settings','Continuar lendo':'Continue reading','Coleção':'Collection','Todos':'All','Lendo':'Reading','Novos':'New','Concluídos':'Finished','Favoritos':'Favorites','+ Estante':'+ Shelf','Recentes':'Recent','Título':'Title','Progresso':'Progress','Autor':'Author','Data de adição':'Date added','Retomar':'Resume','Novo':'New','Concluído':'Finished','Meta de leitura':'Reading goal','min hoje':'min today','Alterar meta':'Change goal','Seus números':'Your numbers','Lendo agora':'Reading now','Marcadores':'Bookmarks','Armazenamento':'Storage','Adicionados recentemente':'Recently added','Selecionar':'Select','Cancelar':'Cancel','Favoritar':'Favorite','Marcar lido':'Mark as read','Estante…':'Shelf…','Remover':'Remove','Detalhes':'Details','Alternar grade e lista':'Toggle grid/list','Tamanho das capas':'Cover size','Ordenar':'Sort','‹ Todas as séries':'‹ All series','Abrir série':'Open series',
'Nenhum livro encontrado.':'No books found.','Sua biblioteca está vazia.':'Your library is empty.','Toque em':'Tap','Adicionar livros':'Add books','e escolha arquivos EPUB, PDF, CBZ ou TXT.':'and choose EPUB, PDF, CBZ or TXT files.','Nome da estante:':'Shelf name:','Adicionar à estante':'Add to shelf','+ Nova estante':'+ New shelf',
'‹ Biblioteca':'‹ Library','Voltar à biblioteca':'Back to library','Tela cheia':'Fullscreen','Anterior':'Previous','Próxima':'Next','Sumário':'Contents','Buscar no livro':'Search in book','Destaques e notas':'Highlights & notes','Ajustes de leitura':'Reading settings','Fechar':'Close',
'Leitura':'Reading','Modo':'Mode','Página':'Page','Rolagem':'Scroll','Ajustar à':'Fit to','Tela':'Screen','Largura':'Width','Mangá (direita → esquerda)':'Manga (right → left)','Ir para a página':'Go to page','Exibição':'Display','Brilho':'Brightness','Luz quente':'Warm light','Tema':'Theme','Texto':'Text','Fonte':'Font','Serifa':'Serif','Sem serifa':'Sans serif','Espaçamento':'Spacing','Compacto':'Compact','Amplo':'Wide','Justificar texto':'Justify text','Hifenização':'Hyphenation','Margens':'Margins','Geral':'General','Manter a tela ligada':'Keep screen on','Toque nas bordas':'Edge tap zones','Relógio e bateria':'Clock & battery','Voltar às configurações originais':'Back to default settings','Restaurar padrões':'Restore defaults','Quieto':'Quiet','Papel':'Paper','Negrito':'Bold','Calmo':'Calm','Foco':'Focus',
'Marcar este ponto':'Bookmark this spot','Nenhum marcador neste livro ainda.':'No bookmarks in this book yet.','Remover marcador':'Remove bookmark','Leia um pouco antes de marcar':'Read a bit before bookmarking','Selecione um trecho do texto para destacar ou anotar.':'Select some text to highlight or add a note.','Exportar em Markdown':'Export as Markdown','Destaque salvo':'Highlight saved','Nota salva':'Note saved','Nota':'Note','Sua nota:':'Your note:','Buscando…':'Searching…','Nada encontrado.':'Nothing found.','Este arquivo não tem sumário. Use "Ir para a página" nos ajustes.':'This file has no contents. Use "Go to page" in settings.','A busca não está disponível para este formato (livros de imagens).':'Search is not available for this format (image books).','Destaques e notas estão disponíveis em EPUB de texto, PDF e TXT.':'Highlights and notes are available for text EPUB, PDF and TXT.',
'Conta':'Account','Aparência':'Appearance','Biblioteca':'Library','Estatísticas':'Statistics','Dados':'Data','Cor do avatar':'Avatar color','Ícone':'Icon','Salvar nome':'Save name','Segurança':'Security','Definir PIN':'Set PIN','Trocar PIN':'Change PIN','Remover PIN':'Remove PIN','Excluir perfil':'Delete profile','Zona de risco':'Danger zone','Excluir este perfil e todos os livros':'Delete this profile and all its books','Aparência do app':'App appearance','Tema do app':'App theme','Automático':'Automatic','Claro':'Light','Escuro':'Dark','Cor de destaque':'Accent color','Visual de vidro':'Glass look','Densidade':'Density','Confortável':'Comfortable','Compacta':'Compact','Tamanho do texto da interface':'Interface text size','Idioma':'Language','Padrões de leitura':'Reading defaults','Visualização':'View','Grade':'Grid','Lista':'List','Ordenação padrão':'Default sort','Estantes':'Shelves','Nova estante':'New shelf','Renomear':'Rename','Criar':'Create','Nenhuma estante ainda.':'No shelves yet.','Tempo total lido':'Total time read','Livros concluídos':'Books finished','Dias de leitura':'Reading days','Sequência':'Streak','Média por dia ativo':'Average per active day','Esta semana':'This week','Backup':'Backup','Exportar backup':'Export backup','Importar backup':'Import backup','Limpar histórico de leitura':'Clear reading history','Remover todos os livros':'Remove all books','Uso de armazenamento':'Storage used','Seções':'Sections',
'Editar livro':'Edit book','Série / coleção':'Series / collection','Volume':'Volume','Gênero':'Genre','Descrição / observações':'Description / notes','Salvar alterações':'Save changes','Remover capa':'Remove cover','Sugerir série e volume pelo arquivo':'Suggest series and volume from filename','Trocar capa':'Change cover','Detalhes do livro':'Book details','Trocar capa':'Change cover','Formato':'Format','Tamanho':'Size','Páginas':'Pages','Adicionado em':'Added on','Tempo lido':'Time read','Destaques':'Highlights','★ Favorito':'★ Favorite','☆ Favoritar':'☆ Favorite','Marcar como lido':'Mark as read','Marcar como não lido':'Mark as unread','Salvar':'Save',
'Abrindo…':'Opening…','Arquivo não encontrado':'File not found','Capa atualizada':'Cover updated','Imagem inválida':'Invalid image','Backup gerado':'Backup created','Arquivo de backup inválido':'Invalid backup file','Não há livros para exportar':'No books to export','Nome alterado':'Name changed','PIN salvo':'PIN saved','PIN removido':'PIN removed','Tela cheia não disponível':'Fullscreen not available','Histórico limpo':'History cleared','Biblioteca esvaziada':'Library emptied','Backup gerado':'Backup created','Meta diária de leitura, em minutos:':'Daily reading goal, in minutes:','Digite seu PIN atual:':'Enter your current PIN:','Novo PIN (4+ dígitos):':'New PIN (4+ digits):','Salvar livros, estantes e histórico em um arquivo':'Save books, shelves and history to a file','Restaurar a partir de um arquivo de backup':'Restore from a backup file'};
Object.assign(EN,{
'Perfil de leitura':'Reading profile','Identidade e informações deste perfil no dispositivo.':'Profile identity and details on this device.',
'Seu espaço pessoal de leitura':'Your personal reading space','Perfil neste dispositivo':'Profile on this device',
'Personalização do avatar':'Avatar customization','Escolha como seu perfil aparece no LECTOR.':'Choose how your profile appears in LECTOR.',
'Iniciais, um emoji ou uma fotografia.':'Initials, an emoji or a photograph.','Escolher emoji':'Choose emoji','Aplicar emoji':'Apply emoji',
'Exibido na biblioteca e na escolha de perfis.':'Shown in the library and profile chooser.',
'Utilizada nas iniciais e no fundo dos emojis.':'Used for initials and emoji backgrounds.',
'As fotografias são recortadas e compactadas para 256 × 256 pixels. Elas permanecem armazenadas neste navegador.':'Photos are cropped and compressed to 256 × 256 pixels. They remain stored in this browser.',
'Proteção opcional de acesso a este perfil local.':'Optional protection for access to this local profile.',
'PIN ativo':'PIN enabled','PIN não configurado':'PIN not set','PIN de acesso':'Access PIN',
'Ajuda a proteger este perfil no dispositivo. Não substitui a senha da conta online.':'Helps protect this profile on this device. It does not replace your online account password.',
'Alterar PIN':'Change PIN','Ações irreversíveis que afetam os dados locais.':'Irreversible actions affecting local data.',
'Excluir perfil e livros locais':'Delete profile and local books',
'Remove este perfil e seus livros deste dispositivo. Faça um backup antes de continuar.':'Removes this profile and its books from this device. Back up before continuing.'
});
const RX=[[/^(\d+)% lido$/,'$1% read'],[/^faltam (\d+)% · ≈ (.+) restantes$/,(m,a,b)=>a+'% left · ≈ '+b.replace('menos de 1 min','less than 1 min')+' remaining'],[/^faltam (\d+)% · calculando tempo…$/,'$1% left · estimating time…'],
[/^pág\. ([\d–]+) de (\d+)$/,'page $1 of $2'],[/^Você terminou este volume\. Próximo: (.*)$/,'You finished this volume. Next: $1'],[/^pág\. (\d+): (.*)$/,'page $1: $2'],[/^faltam (\d+) págs no capítulo$/,'$1 pages left in chapter'],[/^(\d+) livros?$/,'$1 book(s)'],[/^(.*) · (\d+) livros?$/,'$1 · $2 book(s)'],[/^(\d+) volumes · (\d+)%$/,'$1 volumes · $2%'],
[/^Meta: (\d+) min\/dia(?: · (\d+) dias? seguidos?)?$/,(m,a,b)=>'Goal: '+a+' min/day'+(b?' · '+b+(b>1?' days in a row':' day in a row'):'')],[/^(\d+) selecionado\(s\)$/,'$1 selected'],
[/^Adicionando (\d+) de (\d+): (.*)$/,'Adding $1 of $2: $3'],[/^Preparando (\d+) de (\d+)…$/,'Preparing $1 of $2…'],[/^Importando (\d+)…$/,'Importing $1…'],[/^(\d+) livros? adicionados?$/,'$1 added'],[/^(\d+) livro\(s\) importado\(s\)$/,'$1 book(s) imported'],
[/^Página (\d+)$/,'Page $1'],[/^(\d+)% do livro$/,'$1% of book'],[/^Abrir (.*)$/,'Open $1'],[/^Cor (.*)$/,'Color $1'],[/^Destacar (.*)$/,'Highlight $1'],[/^Remover "(.*)" da biblioteca\?$/,'Remove "$1" from the library?'],[/^"(.*)" já está na biblioteca\. Adicionar mesmo assim\?$/,'"$1" is already in the library. Add anyway?'],[/^Remover (\d+) livro\(s\) da biblioteca\?$/,'Remove $1 book(s) from the library?'],[/^Não consegui adicionar "(.*)"$/,'Could not add "$1"']];
function trs(s){const k=s.trim();if(!k)return s;if(EN[k]!==undefined)return s.replace(k,EN[k]);for(const [r,v] of RX)if(r.test(k))return s.replace(k,k.replace(r,v));return s}
const ATTR=['placeholder','aria-label','title'];let obs=null;
function trNode(n){
  if(n.nodeType===3){const t=trs(n.data);if(t!==n.data){if(n.__pt===undefined)n.__pt=n.data;n.__en=t;n.data=t}}
  else if(n.nodeType===1&&!['SCRIPT','STYLE'].includes(n.tagName)){ATTR.forEach(a=>trAttr(n,a));n.childNodes.forEach(trNode)}}
function trAttr(n,a){const v=n.getAttribute(a);if(!v)return;const t=trs(v);if(t!==v){if(n['__pt_'+a]===undefined)n['__pt_'+a]=v;n.setAttribute(a,t)}}
function setLang(){
  const en=S.lang==='en';if(en===!!obs)return;document.documentElement.lang=en?'en':'pt-BR';
  if(en){obs=new MutationObserver(ms=>{for(const m of ms){
      if(m.type==='characterData'){const n=m.target;if(n.__en!==n.data){n.__pt=undefined;trNode(n)}}
      else if(m.type==='attributes')trAttr(m.target,m.attributeName);else m.addedNodes.forEach(trNode)}});
    trNode(document.body);obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTR})}
  else{obs.disconnect();obs=null;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_ALL);let n;
    while(n=w.nextNode()){if(n.nodeType===3&&n.__pt!==undefined){n.data=n.__pt;n.__pt=undefined;n.__en=undefined}
      else if(n.nodeType===1)ATTR.forEach(a=>{if(n['__pt_'+a]!==undefined){n.setAttribute(a,n['__pt_'+a]);n['__pt_'+a]=undefined}})}}
}
for(const f of ['alert','confirm','prompt']){const o=window[f].bind(window);window[f]=(m,...r)=>o(S.lang==='en'?trs(String(m)):m,...r)}
const _toast=toast;


function offerNext(){
  if(!cur||cur.offered)return;const m=cur.meta,k=seriesKey(m);
  const sib=books.filter(b=>seriesKey(b)===k).sort(natVolume),i=sib.findIndex(b=>b.id===m.id),nx=sib.slice(i+1).find(b=>!isDone(b));
  if(sib.length<2||i<0||!nx)return;cur.offered=1;
  const bar=$('#nextbar'),t=document.createElement('span');t.textContent='Você terminou este volume. Próximo: '+nx.title;
  bar.replaceChildren(t,mbtn('Ler agora',()=>{bar.hidden=true;openBook(nx)},'primary'),mbtn('✕',()=>bar.hidden=true));bar.hidden=false}


let deferredInstall=null,swReg=null;
const isApp=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(!$('#cfg').hidden&&curTab==='Dados')tab()});
addEventListener('appinstalled',()=>{deferredInstall=null;toast('App instalado')});
function showUpd(reg){
  if(!reg?.waiting)return;
  const b=$('#upd'),t=document.createElement('span');
  t.textContent='Nova versão disponível (instalada: v'+APP_VERSION+').';
  b.setAttribute('role','status');b.setAttribute('aria-live','polite');
  b.replaceChildren(t,mbtn('Atualizar',()=>{
    if(!confirm('Atualizar o LECTOR agora? Salve primeiro o progresso da leitura e quaisquer alterações pendentes.'))return;
    reg.waiting?.postMessage('SKIP_WAITING');
  },'primary'),mbtn('Depois',()=>b.hidden=true));b.hidden=false;
}
async function offlineShellStatus(){
  if(!('caches' in window)||!('serviceWorker' in navigator))return 'Não disponível neste navegador';
  try{
    const keys=await caches.keys();
    const shell=keys.find(name=>name===`lector-shell-v${APP_VERSION}`);
    if(!shell)return 'Ainda não preparado para uso offline';
    const cache=await caches.open(shell);
    const required=['index.html','offline.html','manifest.json'].map(path=>new URL(path,location.href).href);
    const available=await Promise.all(required.map(url=>cache.match(url)));
    return available.every(Boolean)?'Interface preparada para uso offline':'Arquivos essenciais incompletos';
  }catch{return 'Não foi possível verificar o cache offline'}
}
if('serviceWorker' in navigator&&/^https?:/.test(location.protocol)){
  const had=!!navigator.serviceWorker.controller;let rl=false;
  navigator.serviceWorker.register('sw.js').then(reg=>{swReg=reg;
    if(reg.waiting&&navigator.serviceWorker.controller)showUpd(reg);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpd(reg)})})}).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||rl)return;rl=true;location.reload()})}
async function persist(){try{if(navigator.storage&&navigator.storage.persist)return await navigator.storage.persist()}catch{}return false}
const tag=(t,c)=>{const s=document.createElement(c||'b');s.textContent=t;return s};
async function appGroup(p){
  const g=grpP(p,'Aplicativo');
  ctl(g,'Instalar app',isApp()?tag('Instalado'):deferredInstall?mbtn('Instalar app',async()=>{deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;tab()},'primary'):tag('Use o menu do navegador → "Instalar LECTOR".','span'));
  let per=false;try{per=await navigator.storage.persisted()}catch{}if(curTab!=='Dados')return;
  ctl(g,'Armazenamento persistente',per?tag('Ativo'):mbtn('Ativar',async()=>{toast((await persist())?'Armazenamento protegido':'O navegador não concedeu agora');tab()}));
  const current=document.createElement('div');current.className='version-value';
  const version=document.createElement('strong');version.textContent='v'+APP_VERSION;version.title='Versão da interface carregada';
  current.append(version);
  ctl(g,'Versão instalada',current);
  const author=document.createElement('a');author.href='https://github.com/joaorizzo0112';
  author.target='_blank';author.rel='noopener noreferrer';author.className='lector-author-link';
  author.textContent='@joaorizzo0112';author.setAttribute('aria-label','Visitar o GitHub de @joaorizzo0112');
  ctl(g,'Desenvolvido por',author);
  const offlineState=document.createElement('span');offlineState.className='app-offline-status';
  offlineState.setAttribute('role','status');offlineState.textContent='Verificando…';
  ctl(g,'Interface offline',offlineState);
  offlineShellStatus().then(state=>{if(offlineState.isConnected)offlineState.textContent=state});
  const check=mbtn('Verificar atualização',async()=>{
    if(!swReg)return toast('Atualizações automáticas exigem HTTPS ou localhost');
    check.disabled=true;check.textContent='Verificando…';
    try{
      await swReg.update();lsSet('leitor:lastUpdateCheck',new Date().toISOString());last.textContent='Última verificação: '+new Date().toLocaleString('pt-BR');
      if(swReg.waiting)showUpd(swReg);
      else if(swReg.installing)toast('LECTOR v'+APP_VERSION+' · atualização em preparação');
      else toast('LECTOR v'+APP_VERSION+' · verificação concluída');
    }catch(e){toast('LECTOR v'+APP_VERSION+' · não foi possível verificar a atualização')}
    finally{check.disabled=false;check.textContent='Verificar atualização'}
  });
  const up=document.createElement('div');up.style.cssText='display:flex;flex-direction:column;align-items:flex-end;gap:3px';
  up.append(check);const last=document.createElement('small');last.className='app-update-status';
  const checked=lsGet('leitor:lastUpdateCheck');last.textContent=checked?('Última verificação: '+new Date(checked).toLocaleString('pt-BR')):'Ainda não verificado nesta instalação';
  up.append(last);ctl(g,'Atualizações',up);
}
Object.assign(EN,{
 'Identidade':'Identity','Tipo de avatar':'Avatar type','Iniciais':'Initials','Emoji':'Emoji','Foto':'Photo',
 'Escolher foto':'Choose photo','Remover foto':'Remove photo','Emojis e símbolos':'Emoji and symbols',
 'Outro emoji':'Custom emoji','Usar emoji':'Use emoji','Qualquer cor':'Any color','Nome do perfil':'Profile name',
 'Seu perfil de leitura · dados guardados neste dispositivo':'Your reading profile · data stored on this device',
 'A foto é recortada ao centro e compactada para 256 × 256 pixels. Fica guardada somente no seu navegador. Sua cor personalizada continua disponível ao trocar o emoji ou remover a foto.':'The photo is centered and resized to 256 × 256 pixels. It stays in your browser. Your selected avatar color remains available when switching emoji or removing the photo.',
 'Temas da interface':'Interface themes','Personalização':'Customization','Sépia':'Sepia','Oceano':'Ocean','Floresta':'Forest','Ameixa':'Plum','Grafite':'Graphite',
 'Ligado: cartões semitransparentes com desfoque do fundo. Desligado: superfícies opacas com maior contraste.':'On: translucent cards with background blur. Off: opaque surfaces with increased contrast.',
 'Versão instalada':'Installed version','Verificando…':'Checking…',
});
Object.assign(EN,{'Aplicativo':'App','Instalar app':'Install app','Instalado':'Installed','Use o menu do navegador → "Instalar LECTOR".':'Use the browser menu → "Install LECTOR".','Armazenamento persistente':'Persistent storage','Ativo':'Active','Ativar':'Enable','Atualizações':'Updates','Verificar atualização':'Check for updates','Nova versão disponível.':'New version available.','Atualizar':'Update','Depois':'Later','Armazenamento protegido':'Storage protected','O navegador não concedeu agora':'The browser did not grant it right now','Você está na versão mais recente':'You are on the latest version','App instalado':'App installed','Duas páginas lado a lado':'Two pages side by side','Capa em página separada':'Cover on its own page','Ler agora':'Read now','Este livro não tem sumário. Use "Ir para a página" nos ajustes.':'This book has no contents. Use "Go to page" in settings.'});
Object.assign(EN,{'Continue a série':'Continue the series','Quase terminando':'Almost finished','Ver tudo':'See all','Retomar':'Resume','Formato':'Format','Todos os formatos':'All formats','Lido agora':'Read just now','Sua biblioteca está vazia':'Your library is empty','Arraste arquivos EPUB, PDF, CBZ ou TXT para qualquer lugar desta tela, ou use o botão abaixo.':'Drag EPUB, PDF, CBZ or TXT files anywhere on this screen, or use the button below.','Solte os arquivos para adicionar':'Drop files to add them','★ Remover dos favoritos':'★ Remove from favorites','Tela inicial':'Home screen','Meta do dia':'Daily goal','Estantes e favoritos':'Shelves and favorites','Números da biblioteca':'Library numbers','Miniaturas':'Thumbnails','Selecionar texto':'Select text','Sair da seleção de texto':'Exit text selection','Dicionário':'Dictionary','Tradução':'Translation','Definição':'Definition','Salvar no vocabulário':'Save to vocabulary','Já está no vocabulário':'Already in vocabulary','Salvo no vocabulário':'Saved to vocabulary','Sem conexão: o dicionário e a tradução precisam de internet.':'No connection: dictionary and translation need internet.','Definição não encontrada para esta palavra.':'No definition found for this word.','Revisão':'Review','Revisão concluída!':'Review complete!','Mostrar resposta':'Show answer','Esqueci':'Forgot','Lembrei':'Remembered','Nada para revisar agora':'Nothing to review now','Vocabulário':'Vocabulary','Palavras salvas':'Saved words','Para revisar agora':'To review now','Palavras':'Words','Revisão com repetição espaçada':'Spaced repetition review','Revisar agora':'Review now','Exportar para Anki ou planilha':'Export to Anki or spreadsheet','Exportar TSV':'Export TSV','Nada para exportar':'Nothing to export','Selecione uma palavra durante a leitura e toque em Dicionário para salvar aqui.':'Select a word while reading and tap Dictionary to save it here.','Dicionário e tradução':'Dictionary and translation','Idioma do texto':'Text language','Traduzir para':'Translate to','Modo seleção: pressione e arraste sobre o texto.':'Selection mode: press and drag over the text.','Modo seleção desligado':'Selection mode off','Inglês':'English','Português':'Portuguese','Espanhol':'Spanish','Francês':'French','Alemão':'German','Italiano':'Italian','Sobre':'About'});
RX.push([/^Lido há (\d+) min$/,'Read $1 min ago'],[/^Lido há (\d+) h$/,'Read $1 h ago'],[/^Lido há (\d+) dias?$/,'Read $1 day(s) ago'],[/^↩ Voltar para (.*)$/,'↩ Back to $1'],[/^Livro (\d+)$/,'Book $1']);
Object.assign(EN,{'Estantes':'Shelves','Concluir':'Done','Nova estante':'New shelf','Nome da estante':'Shelf name','Criar estante':'Create shelf','Digite um nome':'Enter a name','Renomear estante':'Rename shelf','Excluir estante':'Delete shelf','✎ Renomear':'✎ Rename','Você ainda não tem estantes. Crie a primeira abaixo.':'You have no shelves yet. Create the first one below.','Nenhum marcador ainda. Durante a leitura, use ☰ → Marcadores → "Marcar este ponto".':'No bookmarks yet. While reading, use ☰ → Bookmarks → "Bookmark this spot".','Adicionado aos favoritos':'Added to favorites','Cancelar':'Cancel','Excluir':'Delete','Tempo lido':'Time read'});
RX.push([/^Estantes \((\d+) livros\)$/,'Shelves ($1 books)'],[/^Adicionado à estante "(.*)"$/,'Added to shelf "$1"'],[/^Excluir a estante "(.*)"\? Os livros continuam na biblioteca\.$/,'Delete the shelf "$1"? The books stay in the library.'],[/^(.*) · (\d+)$/,'$1 · $2']);
Object.assign(EN,{'Noite':'Night','Aplicar o tema à página':'Apply theme to the page','Aplicar o tema à página (PDF e imagens)':'Apply theme to the page (PDF and images)','Brilho da página':'Page brightness','Início':'Home','Exibir':'View','⚙ Exibir':'⚙ View','Visualização':'View','Grade':'Grid','Lista':'List','Todos os formatos':'All formats','Tamanho das capas':'Cover size','Comece por aqui':'Get started','Adicione seus primeiros livros':'Add your first books','Crie uma estante':'Create a shelf','Defina sua meta diária':'Set your daily goal','Instale o app':'Install the app','Comece a ler um livro':'Start reading a book','Adicionar':'Add','Criar':'Create','Definir':'Set','Instalar':'Install','Abrir':'Open','Dispensar':'Dismiss','Últimas anotações':'Latest notes','Cartão de vocabulário':'Vocabulary card','Estantes organizam sua biblioteca do seu jeito. Crie a primeira com o botão acima.':'Shelves organize your library your way. Create the first with the button above.','Backup rápido':'Quick backup','Limpar nome':'Clean name','Limpar nomes':'Clean names','Limpar nomes (tira (PT), [...], sublinhados)':'Clean names (removes (PT), [...], underscores)','Organização':'Organization','Seções':'Sections','Navegação':'Navigation','Tema':'Theme','Claro':'Light','Escuro':'Dark','Auto':'Auto'});
RX.push([/^(\d+) palavras · (\d+) para revisar$/,'$1 words · $2 to review'],[/^(\d+) nome\(s\) limpo\(s\)$/,'$1 name(s) cleaned']);
Object.assign(EN,{'Buscar nas configurações':'Search settings','Nada encontrado nas configurações.':'Nothing found in settings.','Restaurar padrão':'Restore default','Prévia ao vivo':'Live preview','Capítulo 1':'Chapter 1','Fundo da leitura':'Reading background','Cor atrás da página e do texto, independente do tema.':'Color behind the page and text, independent of the theme.','Preto':'Black','Cinza':'Gray','Outra':'Other','Criar uma estante':'Create a shelf','Nome da estante':'Shelf name','Restaurar tudo':'Restore all','Restaurar todos os ajustes (tema, leitura, biblioteca)':'Restore all settings (theme, reading, library)','Ajustes restaurados':'Settings restored',
'Uma página por vez ou rolagem contínua.':'One page at a time or continuous scroll.','Encaixa a página na tela inteira ou na largura.':'Fits the page to the screen or to the width.','As páginas viram da direita para a esquerda.':'Pages turn from right to left.','Mostra duas páginas juntas em telas largas.':'Shows two pages together on wide screens.','A primeira página fica sozinha, como num livro impresso.':'The first page stands alone, like a printed book.','Aumenta ou diminui o texto e a página.':'Enlarges or shrinks the text and the page.','Escurece a tela inteira durante a leitura.':'Dims the whole screen while reading.','Reduz a luz azul para ler à noite.':'Reduces blue light for night reading.','Inverte ou tinge as cores da própria página.':'Inverts or tints the page colors.','Escurece só a página, sem mexer no fundo.':'Dims only the page, without touching the background.','Tipo de letra do texto.':'Text typeface.','Distância entre as linhas.':'Distance between lines.','Alinha o texto nas duas margens.':'Aligns the text on both margins.','Quebra palavras no fim da linha.':'Breaks words at the end of a line.','Espaço nas laterais do texto.':'Space at the sides of the text.','Evita que a tela apague enquanto você lê.':'Keeps the screen from turning off while you read.','Botões nas laterais para virar a página.':'Side buttons to turn the page.','Mostra hora e bateria no topo da leitura.':'Shows time and battery at the top while reading.','Idioma usado no dicionário.':'Language used by the dictionary.','Idioma das traduções.':'Language of translations.','Claro, escuro ou segue o sistema.':'Light, dark or follows the system.','Efeito translúcido nos cartões.':'Translucent effect on cards.','Espaço entre os elementos.':'Spacing between elements.','Aumenta toda a interface.':'Enlarges the whole interface.','EPUB · TXT':'EPUB · TXT','PDF · Imagens':'PDF · Images','Imagens':'Images'});
Object.assign(EN,{
  'Biblioteca pessoal':'Personal library','Aparência rápida':'Quick appearance',
  'Meu perfil':'My profile','Backup e dados':'Backup & data','Instalar aplicativo':'Install app',
  'PREFERÊNCIAS':'PREFERENCES','SUA CONTA':'YOUR ACCOUNT','Resultados da busca':'Search results',
  'Personalize seu perfil e gerencie sua segurança.':'Customize your profile and manage security.',
  'Escolha como o LECTOR aparece em suas telas.':'Choose how LECTOR looks on your screens.',
  'Configure a experiência de leitura para cada formato.':'Set the reading experience for each format.',
  'Organize a página inicial, seus livros e suas estantes.':'Organize your home screen, books and shelves.',
  'Gerencie suas palavras salvas e as revisões.':'Manage saved words and reviews.',
  'Instalação, armazenamento, atualizações e backup.':'Installation, storage, updates and backups.',
  'Aplicar visual de vidro':'Apply glass effect','Restaurar aparência padrão':'Restore default appearance','Cor de destaque':'Accent color','PRÉ-VISUALIZAÇÃO AO VIVO':'LIVE PREVIEW','Sua biblioteca, seu estilo.':'Your library, your style.','Uma amostra do tema e da transparência escolhidos.':'A preview of your theme and translucency.','SEUS PERFIS':'YOUR PROFILES','BIBLIOTECA PESSOAL':'PERSONAL LIBRARY','LECTOR':'LECTOR','SEUS LIVROS, DO SEU JEITO':'YOUR BOOKS, YOUR WAY','Sua biblioteca começa aqui.':'Your library starts here.','Escolha um perfil para continuar sua leitura.':'Choose a profile to keep reading.','Os livros e perfis permanecem neste dispositivo.':'Books and profiles remain on this device.','Cor coral':'Coral color','Cor turquesa':'Turquoise color','Graphite':'Graphite','Nord':'Nord','Tokyo Night':'Tokyo Night','Dracula':'Dracula','Ocean':'Ocean',
  'Modo foco':'Focus mode','Desativar modo foco':'Exit focus mode','Ajustes rápidos de leitura':'Quick reading controls',
  'Leitura sem distrações':'Distraction-free reading','Controles':'Controls','Ativar foco':'Enable focus','Desativar foco':'Disable focus'
});
Object.assign(EN,{
  'Pesquisar no livro':'Search in book',
  'Pesquisa no livro':'Search in book',
  'Usar OCR para reconhecer texto nas imagens (mangá, HQ e PDFs digitalizados)':'Use OCR to recognize text in images (manga, comics and scanned PDFs)'
});


document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||$('#lib').hidden||!$('#dlg').hidden&&$('#dlg').open)return;
  const profile=$('#avm'), options=$('#exm');
  if(profile&&!profile.hidden){profile.hidden=true;$('#av').setAttribute('aria-expanded','false');$('#av').focus();e.preventDefault();return}
  if(options&&!options.hidden){options.hidden=true;$('#exb').setAttribute('aria-expanded','false');$('#exb').focus();e.preventDefault()}
});


