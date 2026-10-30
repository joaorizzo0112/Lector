




const READ_IDLE_MS=120000,READ_PULSE_MS=5000,READ_SAVE_MS=15000;
const analyticsKey=()=>`leitor:reading-analytics:${user}`;
const emptyAnalytics=()=>({v:1,days:{},sessions:[]});
function readAnalytics(){
 const data=lsGet(analyticsKey());
 return data&&data.v===1&&data.days&&typeof data.days==='object'&&!Array.isArray(data.days)&&Array.isArray(data.sessions)?data:emptyAnalytics();
}
let readingClock=null,readingTimer=null,statsRange=30;

function statsWeekGoal(){
  const chosen=Number(S.weekGoal);
  return Number.isFinite(chosen)&&chosen>=5&&chosen<=4200?chosen:Math.min(4200,Math.max(5,(Number(S.goal)||30)*7));
}
function statsCsvCell(value){
  let s=String(value==null?'':value);

  if (/^[\s\x00-\x1f]*[=+@-]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function statsDownloadCsv(filename,rows){
  const csv='\ufeff'+rows.map(row=>row.map(statsCsvCell).join(';')).join('\r\n')+'\r\n';
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function statsExportDaily(){
  if(!user)return;
  const x=hist(),analytics=readAnalytics(),goal=Math.max(1,Number(S.goal)||30)*60;
  const rows=[['Data','Tempo total (segundos)','Minutos','Meta diaria (minutos)','Meta atingida','Tempo detalhado (segundos)','Livros registrados']];
  const keys=Object.keys(x).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  for(const day of keys){
    const seconds=Math.max(0,Number(x[day])||0),detail=analytics.days[day];
    rows.push([day,Math.round(seconds),Math.round(seconds/60*10)/10,Number(S.goal)||30,seconds>=goal?'Sim':'Nao',detail?Math.round(Math.max(0,Number(detail.seconds)||0)):'',detail?Object.keys(detail.books||{}).length:'']);
  }
  if(rows.length===1)return toast('Ainda não há histórico diário para exportar.');
  statsDownloadCsv('lector-estatisticas-diarias-'+dk()+'.csv',rows);
  toast('Histórico diário exportado em CSV.');
}
function statsExportSessions(){
  if(!user)return;
  const analytics=readAnalytics();if(!analytics.sessions.length)return toast('Ainda não há sessões detalhadas para exportar.');
  const names=new Map(books.map(b=>[b.id,b.title||'Sem título']));
  const rows=[['Inicio (local)','Fim (local)','Livro','ID do livro','Duracao (segundos)','Minutos']];
  for(const entry of [...analytics.sessions].sort((a,b)=>a.started.localeCompare(b.started))){
    const local=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):''};
    rows.push([local(entry.started),local(entry.ended),names.get(entry.book)||'Livro indisponível',entry.book,Math.round(entry.seconds),Math.round(entry.seconds/60*10)/10]);
  }
  statsDownloadCsv('lector-sessoes-'+dk()+'.csv',rows);
  toast('Sessões detalhadas exportadas em CSV.');
}
const clockEligible=()=>!!(readingClock&&cur&&readingClock.book===cur.meta.id&&!$('#reader').hidden&&!document.hidden&&document.hasFocus()&&$('#sheet').hidden&&$('#menu').hidden&&!$('#dlg').open);
function tickReadingClock(now=Date.now()){
 const c=readingClock;if(!c)return;
 if(clockEligible()){

   const end=Math.min(now,c.lastActivity+READ_IDLE_MS);
   const s=Math.min((READ_PULSE_MS+1000)/1000,Math.max(0,(end-c.lastTick)/1000));
   if(s>0){
     const day=dk(new Date(now));c.pending[day]=(c.pending[day]||0)+s;c.seconds+=s;
     if(cur?.meta?.id===c.book)cur.meta.t=(cur.meta.t||0)+s;
   }
 }
 c.lastTick=now;
 if(now-c.lastSave>=READ_SAVE_MS)flushReadingClock(false,now);
}
function noteReadingActivity(){
 if(!readingClock||$('#reader').hidden||!$('#sheet').hidden||!$('#menu').hidden||$('#dlg').open)return;
 const now=Date.now();tickReadingClock(now);readingClock.lastActivity=now;
}
function startReadingClock(book){
 stopReadingClock();const now=Date.now();
 readingClock={id:uid(),book,user,started:now,lastActivity:now,lastTick:now,lastSave:now,seconds:0,pending:{}};
 readingTimer=setInterval(()=>tickReadingClock(),READ_PULSE_MS);
}
function flushReadingClock(final=false,now=Date.now()){
 const c=readingClock;if(!c||!user||c.user!==user)return;
 const pending=Object.entries(c.pending).filter(([,seconds])=>seconds>0);
 if(!pending.length&&!final){c.lastSave=now;return}
 if(!c.seconds){c.lastSave=now;return}
 try{
   const h=hist(),details=readAnalytics();
   for(const [day,seconds] of pending){
     h[day]=(Number(h[day])||0)+seconds;
     const d=details.days[day]||{seconds:0,books:{}};
     d.seconds=(Number(d.seconds)||0)+seconds;
     d.books=d.books&&typeof d.books==='object'&&!Array.isArray(d.books)?d.books:{};
     d.books[c.book]=(Number(d.books[c.book])||0)+seconds;
     details.days[day]=d;
   }
   const session={id:c.id,book:c.book,started:new Date(c.started).toISOString(),ended:new Date(now).toISOString(),seconds:Math.round(c.seconds*10)/10};
   const idx=details.sessions.findIndex(s=>s.id===c.id);
   if(idx>=0)details.sessions[idx]=session;else details.sessions.push(session);
   if(details.sessions.length>400)details.sessions=details.sessions.slice(-400);

   const days=Object.keys(details.days).sort();
   if(days.length>3650)for(const day of days.slice(0,-3650))delete details.days[day];
   localStorage.setItem('leitor:hist:'+user,JSON.stringify(h));
   localStorage.setItem(analyticsKey(),JSON.stringify(details));
   if(typeof cloudMarkDirty==='function')cloudMarkDirty('tempo de leitura');
   c.pending={};c.lastSave=now;
 }catch(e){
   console.warn('Não foi possível salvar o tempo de leitura:',e);
   if(!c.warned){toast('Atenção: falha ao registrar estatísticas no dispositivo.');c.warned=true}
 }
}
function stopReadingClock(){
 if(!readingClock)return;
 tickReadingClock();flushReadingClock(true);
 if(readingTimer!==null)clearInterval(readingTimer);
 readingTimer=null;readingClock=null;
}
['pointerdown','keydown','wheel','touchstart','scroll'].forEach(name=>{
 document.addEventListener(name,e=>{
   if(e.target?.closest?.('#reader'))noteReadingActivity();
 },{capture:true,passive:true});
});
document.addEventListener('visibilitychange',()=>{
 if(readingClock){tickReadingClock();flushReadingClock()}
});
window.addEventListener('blur',()=>{if(readingClock){tickReadingClock();flushReadingClock()}});
window.addEventListener('pagehide',()=>{if(readingClock){tickReadingClock();flushReadingClock(true)}});
function mergeAnalytics(existing,incoming,idMap=new Map()){
 const result=structuredClone(existing||emptyAnalytics());
 if(!incoming||incoming.v!==1)return result;
 for(const [day,row] of Object.entries(incoming.days||{})){
   const previous=result.days[day]||{seconds:0,books:{}};
   previous.seconds=Math.max(previous.seconds||0,row.seconds||0);
   previous.books=previous.books||{};
   for(const [id,s] of Object.entries(row.books||{})){
     const mapped=idMap.get(id)||id;
     previous.books[mapped]=Math.max(previous.books[mapped]||0,s);
   }
   result.days[day]=previous;
 }
 const sessions=new Map(result.sessions.map(s=>[s.id,s]));
 for(const session of incoming.sessions||[]){
   const s={...session,book:idMap.get(session.book)||session.book};
   if(!sessions.has(s.id)||sessions.get(s.id).seconds<s.seconds)sessions.set(s.id,s);
 }
 result.sessions=[...sessions.values()].sort((a,b)=>a.started.localeCompare(b.started)).slice(-400);
 return result;
}
function validateAnalytics(value){
 if(value===undefined)return;
 if(!backupPlain(value)||value.v!==1||!backupPlain(value.days)||Object.keys(value.days).length>3650||!Array.isArray(value.sessions)||value.sessions.length>400)throw Error('Estatísticas detalhadas inválidas.');
 for(const [date,d] of Object.entries(value.days)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!backupPlain(d)||!Number.isFinite(d.seconds)||d.seconds<0||d.seconds>86400*365||!backupPlain(d.books)||Object.keys(d.books).length>1000)throw Error('Dia inválido no histórico detalhado.');
   for(const [id,seconds] of Object.entries(d.books))if(!backupStr(id,120)||!Number.isFinite(seconds)||seconds<0||seconds>86400*365)throw Error('Tempo por livro inválido.');
 }
 const ids=new Set();for(const s of value.sessions){
   if(!backupPlain(s)||!backupStr(s.id,120)||ids.has(s.id)||!backupStr(s.book,120)||!backupStr(s.started,40)||!backupStr(s.ended,40)||!Number.isFinite(s.seconds)||s.seconds<0||s.seconds>86400*365||!Number.isFinite(Date.parse(s.started))||!Number.isFinite(Date.parse(s.ended)))throw Error('Sessão de leitura inválida.');
   ids.add(s.id);
 }
}

const isDone=m=>m.f>=.98;
const shelves=()=>lsGet('leitor:shelves:'+user)||[];
const setShelves=a=>lsSet('leitor:shelves:'+user,a);
const addShelf=n=>{n=(n||'').trim();if(!n)return null;const s=shelves();if(!s.includes(n)){s.push(n);setShelves(s)}return n};
const userBooks=()=>tx('books','readonly',s=>s.index('user').getAll(user));
const saveBook=m=>tx('books','readwrite',s=>s.put(m));

const TRASH_DEFAULT_DAYS=1;
const trashPolicyKey=()=>`leitor:trash-days:${user}`;
const trashTombstoneKey=()=>`leitor:trash-tombstones:${user}`;
function trashDays(){const v=lsGet(trashPolicyKey());return v!==null&&[0,1,3,7,30].includes(Number(v))?Number(v):TRASH_DEFAULT_DAYS}
function trashTombstones(){return lsGet(trashTombstoneKey())||{}}
function setTrashTombstones(v){

  try{localStorage.setItem(trashTombstoneKey(),JSON.stringify(v))}
  catch(e){throw Error('Livro preservado no armazenamento, mas o registro de exclusão local não pôde ser atualizado. Não sincronize antes de corrigir o armazenamento: '+(e.message||e))}
}
function assertTrashWriteReady(){
  try{const k='leitor:trash-health:'+user;localStorage.setItem(k,'ok');localStorage.removeItem(k)}
  catch(e){throw Error('As preferências locais estão bloqueadas. Não foi possível mover para a Lixeira com segurança: '+(e.message||e))}
}
const trashEntries=async()=>!user?[]:tx('trash','readonly',s=>s.index('user').getAll(user));
async function reconcileTrashTombstones(){


  if(!user)return 0;
  const entries=await trashEntries(),current=trashTombstones();
  let repaired=0;
  for(const item of entries){
    const key=item.meta?.cloudId||item.id;
    if(!Number.isFinite(current[key])||current[key]<item.deletedAt){
      current[key]=item.deletedAt;repaired++;
    }
  }
  if(repaired)setTrashTombstones(current);
  return repaired;
}

async function rmBooks(ids){
  assertTrashWriteReady();
  const allowed=new Map((await userBooks()).map(b=>[b.id,b]));
  const selected=[...new Set(ids)].filter(id=>allowed.has(id));
  if(!selected.length)return;
  const db=await DB.catch(()=>null);
  if(!db){showStorageFailure();throw Error('O armazenamento está indisponível: nada foi removido.');}
  const deletedAt=Date.now(),days=trashDays(),expiresAt=days?deletedAt+days*86400000:0;
  await new Promise((resolve,reject)=>{
    const tr=db.transaction(['books','files','trash','trashFiles'],'readwrite');
    tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error||new Error('Falha ao mover para lixeira'));
    tr.onabort=()=>reject(tr.error||new Error('Não foi possível preservar os arquivos.'));
    const booksStore=tr.objectStore('books'),files=tr.objectStore('files'),trash=tr.objectStore('trash'),trashFiles=tr.objectStore('trashFiles');
    for(const id of selected){
      const meta=allowed.get(id);
      const req=files.get(id);
      req.onsuccess=()=>{try{
        trash.put({id,user,meta:{...meta},hasFile:!!req.result?.blob,deletedAt,expiresAt});
        if(req.result?.blob)trashFiles.put({id,blob:req.result.blob});
        booksStore.delete(id);files.delete(id);
      }catch(e){try{tr.abort()}catch{}}};
      req.onerror=()=>{try{tr.abort()}catch{}};
    }
  });
  const tomb=trashTombstones();
  selected.forEach(id=>{const meta=allowed.get(id);tomb[meta.cloudId||id]=deletedAt});
  setTrashTombstones(tomb);
  toast(selected.length===1?'Livro movido para a Lixeira.':'Livros movidos para a Lixeira.');
}
async function restoreTrashEntry(id){
  const rec=await tx('trash','readonly',s=>s.get(id));
  if(!rec||rec.user!==user)throw Error('Este livro não está na lixeira deste perfil.');
  const db=await DB;await new Promise((resolve,reject)=>{
    const tr=db.transaction(['books','files','trash','trashFiles'],'readwrite');
    tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error||new Error('Falha na restauração'));
    tr.onabort=()=>reject(tr.error||new Error('Livro já presente ou restauração cancelada'));
    const b=tr.objectStore('books'),f=tr.objectStore('files'),t=tr.objectStore('trash'),tf=tr.objectStore('trashFiles');
    const req=b.get(id);req.onsuccess=()=>{
      if(req.result){try{tr.abort()}catch{};return}
      const fr=tf.get(id);
      fr.onsuccess=()=>{try{
        if(rec.hasFile&&!fr.result?.blob){tr.abort();return}
        b.put(rec.meta);
        if(fr.result?.blob)f.put({id,blob:fr.result.blob});
        t.delete(id);tf.delete(id);
      }catch(e){try{tr.abort()}catch{}}};
      fr.onerror=()=>{try{tr.abort()}catch{}};
    };req.onerror=()=>{try{tr.abort()}catch{}};
  });
  const tomb=trashTombstones();delete tomb[rec.meta.cloudId||id];setTrashTombstones(tomb);
}
async function permanentlyDeleteTrash(ids){
  const all=await trashEntries(),allowed=new Set(all.map(x=>x.id));
  const selected=[...new Set(ids)].filter(x=>allowed.has(x));if(!selected.length)return 0;
  const db=await DB;await new Promise((resolve,reject)=>{
    const tr=db.transaction(['trash','trashFiles'],'readwrite');tr.oncomplete=resolve;
    tr.onerror=()=>reject(tr.error||new Error('Erro ao limpar a lixeira'));
    tr.onabort=()=>reject(tr.error||new Error('Limpeza cancelada'));
    for(const id of selected){tr.objectStore('trash').delete(id);tr.objectStore('trashFiles').delete(id)}
  });
  await Promise.all(selected.map(id=>purgeBookSearchCache(user,id).catch(console.warn)));
  return selected.length;
}
async function purgeExpiredTrash(){
  if(!user)return 0;
  const now=Date.now(),items=await trashEntries();
  return permanentlyDeleteTrash(items.filter(x=>x.expiresAt>0&&x.expiresAt<=now).map(x=>x.id));
}
async function purgeProfileTrash(name){
  const db=await DB;const rec=await tx('trash','readonly',s=>s.index('user').getAll(name));
  if(rec.length)await new Promise((resolve,reject)=>{
    const tr=db.transaction(['trash','trashFiles'],'readwrite');tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error);
    for(const x of rec){tr.objectStore('trash').delete(x.id);tr.objectStore('trashFiles').delete(x.id)}
  });
  localStorage.removeItem(`leitor:trash-days:${name}`);
  localStorage.removeItem(`leitor:trash-tombstones:${name}`);
}
async function deleteEntireLocalProfile(name){
  const existing=await userBooks();
  const discarded=await tx('trash','readonly',s=>s.index('user').getAll(name));
  const db=await DB;
  await new Promise((resolve,reject)=>{
    const tr=db.transaction(['users','books','files','trash','trashFiles'],'readwrite');
    tr.oncomplete=resolve;tr.onerror=()=>reject(tr.error||new Error('Falha ao excluir perfil'));
    tr.onabort=()=>reject(tr.error||new Error('Exclusão do perfil cancelada'));
    for(const entry of existing){tr.objectStore('books').delete(entry.id);tr.objectStore('files').delete(entry.id)}
    for(const entry of discarded){tr.objectStore('trash').delete(entry.id);tr.objectStore('trashFiles').delete(entry.id)}
    tr.objectStore('users').delete(name);
  });
  localStorage.removeItem(`leitor:trash-days:${name}`);
  localStorage.removeItem(`leitor:trash-tombstones:${name}`);
  await Promise.all([...existing,...discarded].map(x=>purgeBookSearchCache(name,x.id).catch(console.warn)));
}
const SER=/[\s_\-.\[\(]*(?:vol(?:ume)?s?\.?|v|tomo|cap(?:[íi]tulo)?\.?|ch(?:apter)?\.?|#|n[ºo°]?\.?)?\s*0*\d+[\s\)\]]*(?:[-–].*)?$/i;

const seriesName=m=>typeof m==='string'?serName(m):String(m.series||'').trim()||serName(m.title);
const seriesKey=m=>seriesName(m).normalize('NFKC').toLocaleLowerCase('pt-BR');
const seriesVolume=m=>Number.isInteger(Number(m.volume))&&Number(m.volume)>0?Number(m.volume):null;
const natVolume=(a,b)=>{const av=seriesVolume(a),bv=seriesVolume(b);return av!==null&&bv!==null?av-bv||natT(a,b):av!==null?-1:bv!==null?1:natT(a,b)};
const serName=t=>t.replace(SER,'').trim()||t;
const serKey=t=>seriesKey(t);
const fmtSize=b=>b>=1e9?(b/1e9).toFixed(1)+' GB':b>=1e6?Math.round(b/1e6)+' MB':Math.max(1,Math.round(b/1e3))+' KB';
const mbtn=(t,fn,cls)=>{const b=document.createElement('button');b.textContent=t;if(cls)b.className=cls;b.onclick=fn;return b};
function avEl(el,u){
  if(!el||!u)return;
  const a=u.av||{};
  el.replaceChildren();
  el.style.background=a.c||'';
  el.classList.toggle('has-photo',!!a.photo);
  if(a.photo){
    const img=document.createElement('img');img.src=a.photo;img.alt='';img.decoding='async';
    img.onerror=()=>{el.classList.remove('has-photo');el.textContent=a.e||u.name[0].toUpperCase()};
    el.append(img);
  }else{el.textContent=a.e||u.name[0].toUpperCase();}

  const n=/^#[0-9a-fA-F]{6}$/.test(a.c||'')?parseInt(a.c.slice(1),16):null;
  const light=n!==null&&((n>>16)*.2126+((n>>8)&255)*.7152+(n&255)*.0722)>160;
  el.style.color=light?'#25201e':'#fff';
}
function fillCov(el,m){
  if(m.cover){const im=new Image();im.alt='';im.loading='lazy';im.decoding='async';im.fetchPriority='low';im.onload=()=>{if(im.naturalWidth/im.naturalHeight>.85)im.style.objectFit='contain'};im.src=m.cover;el.append(im)}
  else{const s=document.createElement('span');s.textContent=(m.title[0]||'?').toUpperCase();
    s.style.background=`hsl(${[...m.title].reduce((a,c)=>a+c.charCodeAt(0),0)%360} 40% 45%)`;el.append(s)}
}
const fmtLabel=m=>({epub:'EPUB',comic:'EPUB',cbz:'CBZ',pdf:'PDF',txt:'TXT'}[m.type]||'');
function covBtn(m,ring=true){
  const b=document.createElement('button');b.className='cov';b.setAttribute('aria-label','Abrir '+m.title);b.title=m.title;fillCov(b,m);
  const t=document.createElement('i');t.className='fmt';t.textContent=fmtLabel(m)+(isDone(m)?' ✓':'');b.append(t);
  if(ring&&m.f>0){const pb=document.createElement('i');pb.className='pb';pb.innerHTML='<i></i>';pb.firstChild.style.width=Math.round(m.f*100)+'%';b.append(pb)}
  b.onclick=()=>{if(Date.now()-lpAt<800)return;openBook(m)};return b}
const ago=ts=>{const s=(Date.now()-ts)/1000;if(s<90)return'Lido agora';const m=s/60;if(m<60)return'Lido há '+Math.round(m)+' min';const h=m/60;if(h<24)return'Lido há '+Math.round(h)+' h';const d=Math.round(h/24);return'Lido há '+d+(d>1?' dias':' dia')};
async function showLib(){
  show('lib');avEl($('#av'),uRec);$('#avn').textContent=user;$('#avm').hidden=true;srt=S.sort||'recent';selMode=false;sel.clear();
  books=(await tx('books','readonly',s=>s.index('user').getAll(user))).sort((a,b)=>b.last-a.last);buildTabs();setLT(S.lt||'home');
}
function bookCard(m,i){
  const c=document.createElement('div');c.className='card glass';c.style.animationDelay=Math.min(i,8)*.04+'s';const pct=Math.round(m.f*100);
  c.innerHTML='<h3></h3><small></small>';c.prepend(covBtn(m));
  c.querySelector('h3').textContent=(m.fav?'★ ':'')+m.title;c.querySelector('h3').title=m.title;
  c.querySelector('small').textContent=m.cloudGhost?'Arquivo pendente neste dispositivo':fmtLabel(m)+(m.volume?' · Vol. '+m.volume:'')+' · '+(!m.f?'Novo':isDone(m)?'Concluído':pct+'% lido');
  if(m.author||m.series){const a=document.createElement('small');a.className='au';a.textContent=m.author||(m.series||'');c.querySelector('h3').after(a)}
  if(m.f>0&&S.lt==='home'){const p=document.createElement('div');p.className='book-progress mini';p.setAttribute('aria-label',pct+'% concluído');p.innerHTML='<i></i>';p.firstChild.style.width=pct+'%';c.append(p)}
  if(selMode){const k=document.createElement('div');k.className='ck'+(sel.has(m.id)?' on':'');k.textContent=sel.has(m.id)?'✓':'';c.append(k);
    c.querySelector('.cov').onclick=()=>{sel.has(m.id)?sel.delete(m.id):sel.add(m.id);draw()}}
  else{const d=mbtn('⋯',()=>bookDlg(m),'del');d.setAttribute('aria-label','Editar informações e capa');c.append(d)}
  c.addEventListener('contextmenu',e=>{if(selMode)return;e.preventDefault();qmenu(m,e.clientX,e.clientY)});
  c.draggable=!selMode;c.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-book',m.id);e.dataTransfer.effectAllowed='copy'});
  let sx=0,sy=0,lt=null;
  c.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||selMode)return;sx=e.clientX;sy=e.clientY;clearTimeout(lt);lt=setTimeout(()=>{lpAt=Date.now();qmenu(m,sx,sy)},520)});
  c.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>10)clearTimeout(lt)});
  ['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev,()=>clearTimeout(lt)));
  return c}
function serCard(it,i){
  const a=it.a,m=a[0],c=document.createElement('div');c.className='card glass stack';c.style.animationDelay=Math.min(i,8)*.04+'s';
  c.innerHTML='<h3></h3><div class="mini"><i></i></div><small></small>';
  const cv=document.createElement('button');cv.className='cov';fillCov(cv,m);cv.setAttribute('aria-label','Abrir série');cv.onclick=()=>{ser=it.s;draw()};c.prepend(cv);
  const avg=Math.round(a.reduce((s,b)=>s+b.f,0)/a.length*100);
  c.querySelector('h3').textContent=seriesName(m);c.querySelector('.mini i').style.width=avg+'%';c.querySelector('small').textContent=a.length+' volumes · '+avg+'%';return c}
const natT=(a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true});
function seriesNext(){
  const g={};books.forEach(b=>(g[seriesKey(b)]=g[seriesKey(b)]||[]).push(b));const out=[];
  for(const a of Object.values(g)){if(a.length<2)continue;a.sort(natVolume);let last=-1;a.forEach((b,i)=>{if(b.f>0)last=i});
    if(last>=0&&isDone(a[last])&&a[last+1]&&!(a[last+1].f>0))out.push([Math.max(...a.map(b=>b.last)),a[last+1]])}
  return out.sort((x,y)=>y[0]-x[0]).map(x=>x[1])}
function rowSec(t,list,fn){
  const d=document.createElement('div');d.className='rowsec';const h=document.createElement('div');h.className='rh2';
  const h3=document.createElement('h3');h3.className='sh';h3.textContent=t;h.append(h3);
  if(fn){const b=mbtn('Ver tudo',fn);b.className='chip glass';h.append(b)}
  const r=document.createElement('div');r.className='hrow';list.forEach((m,i)=>r.append(bookCard(m,i)));d.append(h,r);return d}
const goColl=()=>setLT('lib');
function buildHero(cr){
  const car=$('#car'),dots=$('#dots');car.replaceChildren();dots.replaceChildren();
  cr.forEach((m,i)=>{
    const pct=Math.round(m.f*100);
    const s=document.createElement('article');s.className='slide';
    const b=document.createElement('div');b.className='sb';
    b.innerHTML='<span class="hero-label">SUA LEITURA ATUAL</span><small class="kick"></small><h2></h2><small class="au"></small><div class="hero-progress"><div class="hero-progress-line"><span>Progresso da leitura</span><strong></strong></div><div class="mini"><i></i></div><small class="meta"></small></div><div class="acts"></div>';
    b.querySelector('.kick').textContent=ago(m.last);
    b.querySelector('h2').textContent=m.title;
    b.querySelector('h2').title=m.title;
    const au=b.querySelector('.au');
    au.textContent=m.author||(m.pages?m.pages+' páginas · '+fmtLabel(m):fmtLabel(m));
    b.querySelector('.hero-progress-line strong').textContent=pct+'%';
    b.querySelector('.mini i').style.width=pct+'%';
    b.querySelector('.meta').textContent=(m.pages?'Página aprox. '+Math.max(1,Math.round(m.f*m.pages))+' de '+m.pages:'')+
      (m.n>=2?(m.pages?' · ':'')+'≈ '+fmt((1-m.f)*m.spf)+' restantes':'');
    b.querySelector('.meta').hidden=!b.querySelector('.meta').textContent;
    const act=b.querySelector('.acts');
    act.append(mbtn('▶  Retomar leitura',()=>openBook(m),'primary'),mbtn('Detalhes',()=>bookDlg(m),'hero-secondary'));
    const cover=covBtn(m,false);cover.classList.add('hero-cover');
    if(m.cover){const ambient=document.createElement('div');ambient.className='lector-hero-ambient';ambient.style.backgroundImage='url('+JSON.stringify(m.cover)+')';s.append(ambient)}
    s.append(cover,b);car.append(s);
    const d=document.createElement('button');d.className='dot2';d.setAttribute('aria-label','Ir para livro '+(i+1));
    d.onclick=()=>car.scrollTo({left:car.clientWidth*i,behavior:'smooth'});dots.append(d);
  });
  const sync=()=>{const i=Math.round(car.scrollLeft/Math.max(1,car.clientWidth));
    [...dots.children].forEach((d,j)=>d.classList.toggle('on',j===i))};
  car.onscroll=sync;sync();dots.hidden=$('#cprev').hidden=$('#cnext').hidden=cr.length<2;
}

function buildResume(reading){
  const root=$('#resume');root.hidden=!(S.sCont&&reading.length>0);
  root.replaceChildren();if(root.hidden)return;
  const head=document.createElement('div');head.className='rh2 resume-head';
  const left=document.createElement('div');left.className='resume-title';
  const heading=document.createElement('h3');heading.className='sh';heading.textContent='Continue de onde parou';
  const count=document.createElement('span');count.className='resume-count';count.textContent=reading.length+' em andamento';
  left.append(heading,count);head.append(left);
  const all=mbtn('Ver tudo  ›',()=>{flt='read';ser=null;setLT('lib')});all.className='view-all';head.append(all);
  const row=document.createElement('div');row.className='hrow resume-row';row.setAttribute('aria-label','Livros em andamento');
  reading.slice(0,10).forEach((m,i)=>row.append(bookCard(m,i)));
  root.append(head,row);
}
$('#cprev').onclick=()=>$('#car').scrollBy({left:-$('#car').clientWidth,behavior:'smooth'});
$('#cnext').onclick=()=>$('#car').scrollBy({left:$('#car').clientWidth,behavior:'smooth'});
function fillGoal(){
  const x=hist(),min=Math.round((x[dk()]||0)/60),goal=S.goal||30,st=streak(x);
  $('#gm').textContent=min;$('#rf').style.strokeDashoffset=326.7*(1-Math.min(1,min/goal));
  $('#gt2').textContent='Meta: '+goal+' min/dia'+(st?' · '+st+(st>1?' dias seguidos':' dia seguido'):'')}

const normalizeSearchText=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

const bookSearchCache=new WeakMap();
function searchableBookText(book){
  const signature=[book.title,book.author,book.series,book.genre,book.volume].join('\u001f');
  const last=bookSearchCache.get(book);
  if(last?.signature===signature)return last.value;
  const value=normalizeSearchText(signature);
  bookSearchCache.set(book,{signature,value});
  return value;
}

let libraryCardObserver=null,libraryCardGeneration=0;
function releaseLibraryBatch(){
  ++libraryCardGeneration;
  libraryCardObserver?.disconnect();libraryCardObserver=null;
}
function renderLibraryBatch(grid,items){
  releaseLibraryBatch();
  const generation=libraryCardGeneration;
  let cursor=0,pending=false;
  const batchSize=matchMedia('(max-width:700px)').matches?24:36;
  function append(count){
    if(generation!==libraryCardGeneration)return;
    const end=Math.min(items.length,cursor+count);
    const frag=document.createDocumentFragment();
    for(;cursor<end;cursor++){
      const item=items[cursor];
      frag.append(item.b?bookCard(item.b,cursor):serCard(item,cursor));
    }
    grid.insertBefore(frag,sentinel);
    countEl.textContent=cursor+' de '+items.length+' itens exibidos';
    if(cursor>=items.length){libraryCardObserver?.disconnect();sentinel.remove()}
  }

  const sentinel=document.createElement('div');sentinel.className='library-load-more';
  const countEl=document.createElement('span');countEl.setAttribute('role','status');
  const more=document.createElement('button');more.className='chip';more.type='button';
  more.textContent='Carregar mais livros';
  more.onclick=()=>append(batchSize);
  sentinel.append(countEl,more);
  grid.replaceChildren(sentinel);
  append(batchSize);
  if(cursor>=items.length)return;
  if('IntersectionObserver' in window){
    libraryCardObserver=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting)||pending||generation!==libraryCardGeneration)return;
      pending=true;
      requestAnimationFrame(()=>{pending=false;append(batchSize)});
    },{root:document.querySelector('#lib'),rootMargin:'550px 0px'});
    libraryCardObserver.observe(sentinel);
  }
}


function draw(){
  if(lt==='home'){drawHome();return}
  const q=normalizeSearchText($('#q').value),terms=q?q.split(/\s+/):[],has=books.length>0;
  const ok=b=>(flt==='all'||(flt==='read'&&b.f>0&&!isDone(b))||(flt==='new'&&!b.f)||(flt==='done'&&isDone(b))||(flt==='fav'&&b.fav)||(flt.startsWith('sh:')&&(b.sh||[]).includes(flt.slice(3))))&&
    (fmtF==='all'||(fmtF==='epub'&&(b.type==='epub'||b.type==='comic'))||b.type===fmtF);
  let list=books.filter(b=>{const hay=searchableBookText(b);return terms.every(t=>hay.includes(t))&&ok(b)});
  if(ser)list=list.filter(b=>seriesKey(b)===ser).sort(natVolume);
  else if(srt==='title')list.sort(natT);else if(srt==='prog')list.sort((a,b)=>b.f-a.f);
  else if(srt==='author')list.sort((a,b)=>(a.author||'~').localeCompare(b.author||'~'));else if(srt==='added')list.sort((a,b)=>b.added-a.added);
  let items=list.map(b=>({b}));
  if(!ser&&!q){const g={};list.forEach(b=>(g[seriesKey(b)]=g[seriesKey(b)]||[]).push(b));const seen=new Set();items=[];
    list.forEach(b=>{const k=seriesKey(b),a=g[k];if(a.length>1){if(!seen.has(k)){seen.add(k);items.push({s:k,a:a.sort(natVolume)})}}else items.push({b})})}
  const cb=(l,on,fn,drop)=>{const b=document.createElement('button');b.textContent=l;b.className='chip glass'+(on?' on':'');b.onclick=fn;
    if(drop){b.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('text/x-book')){e.preventDefault();b.classList.add('over')}});
      b.addEventListener('dragleave',()=>b.classList.remove('over'));
      b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('over');const m=books.find(x=>x.id===e.dataTransfer.getData('text/x-book'));if(m)drop(m)})}return b};
  const dropTo=k=>k==='fav'?async m=>{m.fav=true;await saveBook(m);toast('Adicionado aos favoritos');draw()}:k.startsWith('sh:')?async m=>{const n=k.slice(3);m.sh=m.sh||[];if(!m.sh.includes(n))m.sh.push(n);await saveBook(m);toast('Adicionado à estante "'+n+'"');draw()}:null;
  const shAct=flt.startsWith('sh:')?[cb('✎ Renomear',false,()=>renameShelfDialog(flt.slice(3))),cb('Excluir estante',false,()=>deleteShelfDialog(flt.slice(3)))]:[];
  $('#chips').replaceChildren(...(ser?[cb('‹ Todas as séries',false,()=>{ser=null;draw()})]:
    [...[['all','Todos'],['read','Lendo'],['new','Novos'],['done','Concluídos'],['fav','Favoritos'],...shelves().map(n=>['sh:'+n,n+' · '+books.filter(b=>(b.sh||[]).includes(n)).length])].map(([k,l])=>cb(l,flt===k,()=>{flt=k;draw()},dropTo(k))),
     cb('+ Estante',false,()=>newShelfDialog(n=>{flt='sh:'+n;draw()})),...shAct]));
  $('#srt').value=srt;$('#fmt').value=fmtF;$('#cnt').textContent=(ser&&list[0]?seriesName(list[0])+' · ':'')+list.length+(list.length===1?' livro':' livros');
  $('#vg').classList.toggle('on',S.view!=='list');$('#vl').classList.toggle('on',S.view==='list');$('#cs').value=S.cover;$('#cs').closest('.exr').hidden=S.view==='list';
  $('#selm').classList.toggle('on',selMode);$('#exb').classList.toggle('act',fmtF!=='all'||srt!=='recent');$('#lib').style.setProperty('--cs',S.cover+'px');
  const g=$('#grid');g.className=S.view==='list'?'list':'';$('#lib').classList.toggle('perf-many-books',books.length>=80);
  if(!books.length){releaseLibraryBatch();const z=document.createElement('div');z.className='dz';z.innerHTML='<b>Sua biblioteca está vazia</b><p>Arraste arquivos EPUB, PDF, CBZ ou TXT para qualquer lugar desta tela, ou use o botão abaixo.</p>';
    z.append(mbtn('Adicionar livros',()=>$('#file').click(),'primary'));g.replaceChildren(z)}
  else if(!items.length){releaseLibraryBatch();g.innerHTML='<div class="emptyl">Nenhum livro encontrado.</div>';}
  else renderLibraryBatch(g,items);
  lbar();
}
function drawHome(){
  const has=books.length>0;

  const reading=books.filter(b=>b.f>0&&!isDone(b)).sort((a,b)=>b.last-a.last);
  $('#cont').hidden=!(S.sCont&&reading.length);$('#goalc').hidden=!(S.sGoal&&has);
  if(!$('#cont').hidden)buildHero(reading.slice(0,6));buildResume(reading);if(!$('#goalc').hidden)fillGoal();
  const secs=[],used=new Set(reading.slice(0,6).map(b=>b.id)),take=l=>l.filter(b=>!used.has(b.id)),mark=l=>l.forEach(b=>used.add(b.id));
  if(has&&books.length>6){
    if(S.sSeries){const sn=take(seriesNext());mark(sn);if(sn.length)secs.push(['Continue a série',sn,null])}
    if(S.sAlmost){const al=take(books.filter(b=>b.f>=.8&&!isDone(b)));mark(al);if(al.length)secs.push(['Quase terminando',al,null])}
    if(S.sRecent){const rc=take([...books].sort((a,b)=>b.added-a.added)).slice(0,12);if(rc.length>=2)secs.push(['Adicionados recentemente',rc,()=>{srt='added';setLT('lib')}])}
    if(S.sShelves){const fv=books.filter(b=>b.fav);if(fv.length)secs.push(['Favoritos',fv,()=>{flt='fav';setLT('lib')}]);
      shelves().forEach(n=>{const l=books.filter(b=>(b.sh||[]).includes(n));if(l.length)secs.push([n,l,()=>{flt='sh:'+n;setLT('lib')}])})}}
  $('#secs').replaceChildren(...secs.map(([t,l,fn])=>rowSec(t,l,fn)));
  buildStats(reading);buildNotes();buildVcard();buildOnb();

}
function lbar(){
  const b=$('#lbar');b.hidden=!selMode;if(!selMode)return;
  const by=books.filter(x=>sel.has(x.id)),done=()=>{selMode=false;sel.clear();draw()};
  const c=document.createElement('span');c.textContent=by.length+' selecionado(s)';c.style.padding='0 8px';
  b.replaceChildren(c,
    mbtn('Favoritar',async()=>{by.forEach(x=>x.fav=true);await Promise.all(by.map(saveBook));done()}),
    mbtn('Marcar lido',async()=>{by.forEach(x=>x.f=1);await Promise.all(by.map(saveBook));done()}),
    mbtn('Estante…',()=>by.length&&shelfDialog(by)),
    mbtn('Remover',async()=>{if(by.length&&confirm('Remover '+by.length+' livro(s) da biblioteca?')){await rmBooks(by.map(x=>x.id));done();showLib()}},'dg2'),
    mbtn('Cancelar',done));
}
const dlg=$('#dlg');

let dialogPreviousFocus=null;
function dialog(title,fill){
  dialogPreviousFocus=document.activeElement;
  dlg.setAttribute('aria-label',title);
  dlg.innerHTML='';const w=document.createElement('div');w.className='dbody';const h2=document.createElement('h2');h2.textContent=title;h2.style.cssText='font-size:20px;margin-bottom:16px';w.append(h2);dlg.append(w);fill(w);dlg.showModal?dlg.showModal():dlg.setAttribute('open','')}
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
dlg.addEventListener('close',()=>{
  if(dialogPreviousFocus?.isConnected){try{dialogPreviousFocus.focus({preventScroll:true})}catch{}}
  dialogPreviousFocus=null;
});
