
const mime=n=>/png$/i.test(n)?'image/png':/webp$/i.test(n)?'image/webp':/gif$/i.test(n)?'image/gif':'image/jpeg';
const imgBlob=async(zip,n)=>new Blob([await zip.file(n).async('arraybuffer')],{type:mime(n)});
const imgNames=zip=>Object.keys(zip.files).filter(n=>!zip.files[n].dir&&/\.(jpe?g|png|webp|gif)$/i.test(n)&&!/__MACOSX/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
function thumb(src,w,h){const c=document.createElement('canvas');const ratio=Math.min(360/Math.max(1,w),540/Math.max(1,h));c.width=Math.max(1,Math.round(w*ratio));c.height=Math.max(1,Math.round(h*ratio));try{c.getContext('2d').drawImage(src,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8)}finally{c.width=c.height=0}}


async function scanEpub(zip){
  const rd=async p=>{const f=zip.file(p);return f?f.async('string'):''};
  const opfPath=((await rd('META-INF/container.xml')).match(/full-path="([^"]+)"/)||[])[1];if(!opfPath)return null;
  const opf=await rd(opfPath),base=opfPath.replace(/[^/]*$/,''),man={},items=[];
  for(const m of opf.matchAll(/<item\b[^>]*>/g)){const t=m[0],id=(t.match(/\bid="([^"]+)"/)||[])[1],h=(t.match(/\bhref="([^"]+)"/)||[])[1];if(id&&h){man[id]=h;items.push({h,t})}}
  const spine=[...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map(m=>man[m[1]]).filter(Boolean);
  const names=[],anc={},res=(p,from)=>decodeURIComponent(new URL(p,'http://x/'+from).pathname.slice(1));let text=0;
  for(const h of spine){
    const doc=res(h,base),html=(await rd(doc)).replace(/<head[\s\S]*?<\/head>/i,'');
    text+=html.replace(/<[^>]+>/g,'').replace(/\s+/g,'').length;anc[doc]=names.length;
    for(const m of html.matchAll(/<(?:img|image)\b[^>]*>|\bid="([^"]+)"/g)){
      if(m[1]){anc[doc+'#'+m[1]]=names.length;continue}
      const t=m[0],src=(t.match(/\b(?:src|href)="([^"]+)"/)||[])[1],id=(t.match(/\bid="([^"]+)"/)||[])[1];
      if(id)anc[doc+'#'+id]=names.length;
      if(src){const p=res(src,doc);if(zip.file(p))names.push(p)}}
  }
  if(!(names.length>=5&&text/names.length<150))return null;
  names.toc=[];
  const ti=items.find(x=>/properties="[^"]*\bnav\b/.test(x.t))||items.find(x=>/\.ncx$/i.test(x.h)||/dtbncx/.test(x.t));
  if(ti){const tp=res(ti.h,base),src=await rd(tp),list=[];
    if(/<navMap/.test(src))for(const m of src.matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*src="([^"]+)"/g))list.push([m[1],m[2]]);
    else for(const m of src.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g))list.push([m[2],m[1]]);
    for(const [lb,href] of list){const [f,fr]=href.split('#'),doc=res(f,tp),i=fr!==undefined&&anc[doc+'#'+fr]!==undefined?anc[doc+'#'+fr]:anc[doc];
      const label=lb.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();if(i!==undefined&&label)names.toc.push({label,i})}}
  return names}

async function addBook(f){
  const ext=f.name.split('.').pop().toLowerCase(),type={zip:'cbz'}[ext]||ext;
  if(!['epub','pdf','cbz','txt'].includes(type))throw new Error('formato');
  const m={id:uid(),user,type,name:f.name,author:'',series:'',volume:null,genre:'',description:'',pages:0,fav:false,sh:[],hl:[],bm:[],t:0,size:f.size,added:Date.now(),last:Date.now(),f:0,p:null,spf:0,n:0,cover:'',
    title:f.name.replace(/\.[^.]+$/,'').replace(/_+/g,' ').trim()};
  try{
    if(type==='cbz'||type==='epub'){
      const zip=await JSZip.loadAsync(f),names=type==='cbz'?imgNames(zip):await scanEpub(zip);
      if(names){m.pages=names.length;if(type==='epub')m.type='comic';const b=await createImageBitmap(await imgBlob(zip,names[0]));try{m.cover=thumb(b,b.width,b.height)}finally{b.close?.()}}
      else if(type==='cbz')throw new Error('sem imagens');
      else{const b=ePub(await f.arrayBuffer());try{const md=await b.loaded.metadata;if(md.creator)m.author=md.creator;if(md.title&&md.title.length>1&&!/^[a-f0-9]{16,}$/i.test(md.title))m.title=md.title}catch{}const u=await b.coverUrl();if(u){const im=new Image();im.src=u;await im.decode();m.cover=thumb(im,im.naturalWidth,im.naturalHeight)}try{await b.ready}catch{}b.destroy()}
    }else if(type==='pdf'){
      const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;
      try{
        const pg=await pdf.getPage(1),v=pg.getViewport({scale:1});
        const scale=Math.min(1,420/v.width,630/v.height);
        const vp=pg.getViewport({scale});
        const c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));
        try{
          await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
          m.pages=pdf.numPages;m.cover=thumb(c,c.width,c.height);
        }finally{c.width=c.height=0}
        try{
          const i=(await pdf.getMetadata()).info||{};
          let t=(i.Title||'').replace(/^Microsoft Word - /i,'').replace(/\.(docx?|pdf|indd)$/i,'').trim();
          if(t.length>2&&t.length<140&&!/^(untitled|document|doc|capa|cover|sem t[ií]tulo)\s*\d*$/i.test(t))m.title=t;
          if(i.Author&&i.Author.trim().length>1&&i.Author.length<80&&!/^(anonymous|unknown|user|admin|author|owner|sem autor|desconhecido)$/i.test(i.Author.trim()))m.author=i.Author.trim();
        }catch{}
      }finally{await pdf.destroy()}
    }
  }catch(e){if(e.message==='sem imagens')throw e}

  const waiting=(await userBooks()).find(b=>b.cloudGhost&&b.name===f.name&&b.size===f.size);
  if(waiting){
    m.id=waiting.id;m.cloudId=waiting.cloudId||waiting.id;
    m.title=waiting.title||m.title;m.author=waiting.author||m.author;m.series=waiting.series||m.series;
    m.volume=waiting.volume||m.volume;m.genre=waiting.genre||m.genre;m.description=waiting.description||m.description;
    m.f=waiting.f||0;m.p=waiting.p??null;m.last=waiting.last||Date.now();m.fav=!!waiting.fav;
    m.sh=waiting.sh||[];m.bm=waiting.bm||[];m.hl=waiting.hl||[];m.readPrefs=waiting.readPrefs||null;
  }
  await saveBookAndFile(m,f);
}



let readerGeneration=0;
function bookEngineStatus(type){
  if(type==='pdf'&&!window.pdfjsLib)return 'Falta libs/pdf.min.js. Confira a pasta libs/ e recarregue.';
  if(type==='epub'&&typeof window.ePub!=='function')return 'Falta libs/epub.min.js. Confira a pasta libs/ e recarregue.';
  if((type==='comic'||type==='cbz')&&!window.JSZip)return 'Falta libs/jszip.min.js. Confira a pasta libs/ e recarregue.';
  return '';
}
function readingDependencies(){
  return [
    ['PDF.js',!!window.pdfjsLib,'libs/pdf.min.js'],
    ['EPUB.js',typeof window.ePub==='function','libs/epub.min.js'],
    ['JSZip',!!window.JSZip,'libs/jszip.min.js']
  ];
}
async function openBook(m){
  const engineError=bookEngineStatus(m.type);
  if(engineError){toast(engineError);return}


  const requested=++readerGeneration;toast('Abrindo…');
  let rec;
  try{rec=await tx('files','readonly',s=>s.get(m.id))}
  catch(error){
    if(requested===readerGeneration){
      console.error('Falha ao acessar arquivo local',error);
      toast('Não foi possível acessar o arquivo local. Confira o armazenamento e tente novamente.');
    }
    return;
  }
  if(requested!==readerGeneration)return;
  if(!rec?.blob){toast('Arquivo não está neste aparelho. Importe o mesmo arquivo para reassociá-lo.');return}
  setReaderFocus(false);closeCur();const generation=readerGeneration;
  readGlobal=readSnapshot();readScope=m.readPrefs?'book':'global';
  if(m.readPrefs)Object.assign(S,Object.fromEntries(READ_KEYS.filter(k=>Object.hasOwn(m.readPrefs,k)).map(k=>[k,m.readPrefs[k]])));
  cur={meta:m,type:m.type,toc:[],lf:null,f0:m.f};const reader=cur;
  $('#title').textContent=m.title;show('reader');setFooter(m.f,'');
  try{
    if(m.type==='epub')await openEpub(rec.blob);
    else if(m.type==='comic'||m.type==='cbz')await openImages(rec.blob);
    else if(m.type==='pdf')await openPdf(rec.blob);
    else await openTxt(rec.blob);
    if(cur!==reader||generation!==readerGeneration)return;
    $('#toast')?.remove();
  }catch(e){
    if(cur!==reader||generation!==readerGeneration)return;
    console.error(e);alert('Não foi possível abrir "'+m.title+'". '+(e?.message||'Verifique o arquivo e as bibliotecas de leitura.'));closeCur();showLib();return
  }
  if(cur===reader&&generation===readerGeneration){apply();startReadingClock(m.id)}
}
function closeCur(){
  cancelCombinedSearch();releaseSearchOcrPool();
  setReaderFocus(false);
  stopReadingClock();
  ++readerGeneration;
  if(!cur)return;
  clearTimeout(readMetaTimer);
  const restoreRead=readScope==='book'&&readGlobal?{...readGlobal}:null;
  unwake();$('#nextbar').hidden=true;$('#backbar').hidden=true;
  clearTimeout(cur.st);clearTimeout(cur.bt);clearTimeout(cur.idleTimer);
  if(cur.idleHandle!=null&&typeof cancelIdleCallback==='function')cancelIdleCallback(cur.idleHandle);
  cur.thObserver?.disconnect();cur.io?.disconnect();

  $('#pg').querySelectorAll('.pgw').forEach(d=>cur.unload?.(+d.dataset.i,d));
  const mm=cur.meta;tx('books','readwrite',s=>s.put(mm)).catch(console.error);
  try{cur.book?.destroy()}catch{}try{cur.pdf?.destroy()}catch{}
  cur.dropAll?.();
  $('#epub').replaceChildren();$('#pg').replaceChildren();$('#txt').replaceChildren();cur=null;
  readScope='global';readGlobal=null;
  if(restoreRead){Object.assign(S,restoreRead);apply()}
}
$('#back').onclick=()=>{closeCur();$('#sheet').hidden=$('#menu').hidden=true;showLib()};


function clampReadingProgress(value){
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,Math.min(1,number)):0;
}
function setFooter(f,center){
  f=clampReadingProgress(f);
  const m=cur?cur.meta:null,pct=Math.round(f*100);
  $('#bar').style.width=pct+'%';$('#fL').textContent=pct+'% lido';$('#fC').textContent=center||'';
  $('#fR').textContent='faltam '+(100-pct)+'%'+(m&&m.n>=2&&Number.isFinite(m.spf)?' · ≈ '+fmt((1-f)*m.spf)+' restantes':' · calculando tempo…');
}
function report(f,units,center){
  if(!cur)return;
  f=clampReadingProgress(f);
  units=Number.isFinite(Number(units))&&Number(units)>0?Number(units):1;
  const m=cur.meta,now=Date.now();
  if(cur.lf!=null){
    const df=f-cur.lf,dt=(now-cur.lt)/1000;
    if(df>0&&df<=Math.max(.02,3/units)&&dt>=1.5&&dt<=180){const s=dt/df;m.spf=m.n?.7*m.spf+.3*s:s;m.n++}
  }
  if(cur.lf!==null&&Math.abs(f-cur.lf)>0.00001)noteReadingActivity();
  cur.lf=f;cur.lt=now;m.f=f;m.last=now;
  clearTimeout(cur.st);cur.st=setTimeout(()=>tx('books','readwrite',s=>s.put(m)),500);
  setFooter(f,center);
  if(f>=.98&&cur.f0<.98)offerNext();
}


const G={s:1,x:0,y:0};
function applyG(){const l=$('#pg .zl');if(l)l.style.transform=`translate(${G.x}px,${G.y}px) scale(${G.s})`}
function resetG(){G.s=1;G.x=0;G.y=0;$('#pg').style.overflow='';applyG()}
const two=()=>S.mode==='page'&&S.two&&cur&&cur.n>1&&$('#pg').clientWidth/$('#pg').clientHeight>1.15;
const lead=i=>{if(!two())return i;return S.cov1?(i<=0?0:(i%2===1?i:i-1)):i-i%2};
const spreadOf=i=>{const a=lead(i);if(!two()||(S.cov1&&a===0))return[a];return a+1<cur.n?[a,a+1]:[a]};
function pagesInit(n,ratio,load,unload,pos){
  Object.assign(cur,{pages:true,n,ratio,load,unload,i:Math.min(pos||0,n-1)});view('pg');
  cur.refresh=pagesView;cur.jump=i=>cur.goto(i);
  cur.goto=i=>{i=Math.max(0,Math.min(n-1,i));if(Math.abs(i-cur.i)>3)setBack(cur.i);
    if(S.mode==='scroll'){cur.i=i;$('#pg').scrollTop=cur.els[i].offsetTop}else{cur.i=lead(i);resetG();renderSpread()}
    pageReport()};
  cur.next=()=>{if(S.mode==='scroll')return $('#pg').scrollBy({top:$('#pg').clientHeight*.9,behavior:'smooth'});const e=spreadOf(cur.i);cur.goto(e[e.length-1]+1)};
  cur.prev=()=>{if(S.mode==='scroll')return $('#pg').scrollBy({top:-$('#pg').clientHeight*.9,behavior:'smooth'});cur.goto(cur.i-1)};
}
function pageReport(){if(!cur)return;const sp=S.mode==='scroll'?[cur.i]:spreadOf(cur.i),last=sp[sp.length-1];cur.meta.p=cur.i;
  report((last+1)/cur.n,cur.n,'pág. '+(sp.length>1?(sp[0]+1)+'–'+(last+1):sp[0]+1)+' de '+cur.n)}

function loadVisiblePage(reader,i,d){
  Promise.resolve().then(()=>{
    if(cur===reader&&d.isConnected)return reader.load(i,d)
  }).catch(e=>{
    if(cur!==reader||!d.isConnected||e?.name==='RenderingCancelledException')return;
    console.warn('Falha ao carregar página',i+1,e);
    d.textContent='Não foi possível carregar esta página.';
  });
}
function releaseRenderedPages(reader){
  $('#pg').querySelectorAll('.pgw').forEach(d=>reader.unload?.(+d.dataset.i,d));
}
function renderSpread(){
  const reader=cur,zl=$('#pg .zl');
  zl.querySelectorAll('.pgw').forEach(d=>reader.unload?.(+d.dataset.i,d));
  zl.replaceChildren();reader.els=spreadOf(reader.i).map(i=>{
    const d=reader.mk(i);zl.append(d);loadVisiblePage(reader,i,d);return d
  });
}
function pagesView(){
  const box=$('#pg'),sc=S.mode==='scroll';resetG();
  cur.io&&cur.io.disconnect();releaseRenderedPages(cur);box.replaceChildren();box.className=(sc?'sc':'sg')+(cur.selmode?' selmode':'');
  const tw=two(),bw=box.clientWidth,bh=box.clientHeight;
  const base=sc?Math.min(bw,900):S.fit==='width'?Math.min(bw/(tw?2:1),1100):Math.min(bw/(tw?2:1),bh*cur.ratio),w=Math.round(base*S.size/100);
  cur.mk=i=>{const d=document.createElement('div');d.className='pgw';d.style.cssText=`width:${w}px;aspect-ratio:${cur.ratio}`;d.dataset.i=i;return d};
  if(!sc){const zl=document.createElement('div');zl.className='zl';zl.style.flexDirection=S.rtl?'row-reverse':'row';box.append(zl);cur.i=lead(cur.i);renderSpread()}
  else{
    const fragment=document.createDocumentFragment();
    cur.els=Array.from({length:cur.n},(_,i)=>{
      const element=cur.mk(i);fragment.append(element);return element;
    });
    box.append(fragment);
    const reader=cur;

    cur.io=new IntersectionObserver(es=>es.forEach(e=>{
      if(cur!==reader)return;
      const d=e.target,i=+d.dataset.i;
      if(e.isIntersecting){if(!d.dataset.l){d.dataset.l=1;loadVisiblePage(reader,i,d)}}
      else if(d.dataset.l){delete d.dataset.l;reader.unload?.(i,d)}
    }),{root:box,rootMargin:'65% 0px'});
    cur.els.forEach(d=>cur.io.observe(d));box.scrollTop=cur.els[cur.i].offsetTop;
  }
  pageReport();
}
let sct;$('#pg').onscroll=()=>{
  if(!cur||!cur.pages||S.mode!=='scroll'||!cur.els)return;clearTimeout(sct);
  sct=setTimeout(()=>{const box=$('#pg'),y=box.scrollTop+box.clientHeight*.35;let i=0;
    while(i+1<cur.n&&cur.els[i+1].offsetTop<=y)i++;
    if(i!==cur.i){cur.i=i;pageReport()}},80)};


function clampG(){const l=$('#pg .zl');if(!l)return;const pg=$('#pg'),bw=pg.clientWidth,bh=pg.clientHeight,L=l.offsetLeft,T=l.offsetTop,Ws=l.offsetWidth*G.s,Hs=l.offsetHeight*G.s;
  G.x=Ws<=bw?(bw-Ws)/2-L:Math.min(-L,Math.max(bw-Ws-L,G.x));G.y=Hs<=bh?(bh-Hs)/2-T:Math.min(-T,Math.max(bh-Hs-T,G.y))}
function zoomAt(cx,cy,ns){
  const pg=$('#pg'),l=$('#pg .zl');if(!l)return;if(ns<=1.001)return resetG();
  const r=pg.getBoundingClientRect(),px=cx-r.left,py=cy-r.top,L=l.offsetLeft,T=l.offsetTop,wx=(px-L-G.x)/G.s,wy=(py-T-G.y)/G.s;
  pg.style.overflow='hidden';if(G.s<=1.001)pg.scrollTop=0;G.s=ns;G.x=px-L-wx*ns;G.y=py-T-wy*ns;clampG();applyG()}
(()=>{const pg=$('#pg'),P=new Map();let gs=null,tapT=0,tapX=0,tapY=0,tapTm=null;
  const ok=()=>S.mode==='page'&&cur&&cur.pages&&!cur.selmode;
  pg.addEventListener('pointerdown',e=>{if(!ok()||(e.pointerType==='mouse'&&G.s<=1.001))return;pg.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(P.size===1)gs={t:Date.now(),x:e.clientX,y:e.clientY,moved:false,pinch:false,s0:G.s,d0:0};
    if(P.size===2){const[a,b]=[...P.values()];gs.d0=Math.hypot(a.x-b.x,a.y-b.y);gs.s0=G.s}});
  pg.addEventListener('pointermove',e=>{const p=P.get(e.pointerId);if(!p||!gs)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(Math.hypot(e.clientX-gs.x,e.clientY-gs.y)>8)gs.moved=true;
    if(P.size===2){const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y);gs.pinch=true;if(gs.d0)zoomAt((a.x+b.x)/2,(a.y+b.y)/2,Math.min(5,Math.max(1,gs.s0*d/gs.d0)))}
    else if(G.s>1.001){G.x+=dx;G.y+=dy;clampG();applyG()}
    else if(gs.moved&&Math.abs(e.clientY-gs.y)>Math.abs(e.clientX-gs.x)&&pg.scrollHeight>pg.clientHeight)pg.scrollTop-=dy});
  pg.addEventListener('pointerup',e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);if(!gs||P.size>0)return;
    const g=gs,dt=Date.now()-g.t,dx=e.clientX-g.x,dy=e.clientY-g.y;gs=null;if(g.pinch||!ok())return;
    if(G.s<=1.001&&g.moved&&dt<700&&Math.abs(dx)>50&&Math.abs(dx)>1.5*Math.abs(dy)){nav(dx<0?1:-1);return}
    if(g.moved)return;const now=Date.now();
    if(now-tapT<300&&Math.hypot(e.clientX-tapX,e.clientY-tapY)<30){clearTimeout(tapTm);tapT=0;zoomAt(e.clientX,e.clientY,G.s>1.001?1:2.5)}
    else{tapT=now;tapX=e.clientX;tapY=e.clientY;
      if(G.s<=1.001&&S.edges&&e.pointerType==='touch'){const r=pg.getBoundingClientRect(),f=(e.clientX-r.left)/r.width;clearTimeout(tapTm);tapTm=setTimeout(()=>{if(f<.25)nav(-1);else if(f>.75)nav(1)},280)}}});
  pg.addEventListener('pointercancel',e=>{P.delete(e.pointerId);gs=null});
  pg.addEventListener('wheel',e=>{if(ok()&&e.ctrlKey){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.min(5,Math.max(1,G.s*(e.deltaY<0?1.15:1/1.15))))}},{passive:false});
})();


function makeThumbnailCache(limit=24){
  const entries=new Map();
  return (index,loader)=>{
    if(entries.has(index)){
      const cached=entries.get(index);entries.delete(index);entries.set(index,cached);return cached;
    }
    const task=Promise.resolve().then(loader);
    entries.set(index,task);
    while(entries.size>limit)entries.delete(entries.keys().next().value);
    task.catch(()=>{if(entries.get(index)===task)entries.delete(index)});
    return task;
  }
}

const PDF_RENDER_PIXEL_LIMIT=3000000;
function pdfViewports(page,cssWidth){
  const base=page.getViewport({scale:1});
  const scale=Math.max(.01,cssWidth/base.width);
  const css=page.getViewport({scale});
  const budget=PDF_RENDER_PIXEL_LIMIT;
  const dpr=Math.min(2.5,Math.max(1,devicePixelRatio||1));
  const factor=Math.min(dpr,Math.sqrt(budget/Math.max(1,css.width*css.height)));
  return {display:css,render:page.getViewport({scale:scale*Math.max(.01,factor)})};
}
function releaseCanvas(d){

  d.querySelectorAll('canvas').forEach(c=>{c.width=0;c.height=0});
  d.replaceChildren();
}
async function openImages(blob){
  const reader=cur;
  const zip=await JSZip.loadAsync(blob);
  if(cur!==reader)return;
  const names=reader.type==='cbz'?imgNames(zip):await scanEpub(zip);
  if(cur!==reader)return;
  if(!names||!names.length)throw new Error('sem imagens');
  if(reader.type==='cbz'){
    const dirs=new Map();names.forEach((n,i)=>{
      const d=n.includes('/')?n.slice(0,n.lastIndexOf('/')):'';
      if(!dirs.has(d))dirs.set(d,i)
    });
    if(dirs.size>1)names.toc=[...dirs].map(([d,i])=>({label:d.split('/').pop()||'(raiz)',i}));
  }
  const first=await createImageBitmap(await imgBlob(zip,names[0]));
  if(cur!==reader){first.close?.();return}
  const ratio=first.width/first.height;first.close?.();
  const cached=new Map();
  const revoke=i=>{
    const entry=cached.get(i);if(!entry)return;
    cached.delete(i);entry.dropped=true;
    if(entry.url)URL.revokeObjectURL(entry.url);
  };
  const url=i=>{
    let entry=cached.get(i);
    if(entry)return entry.promise;
    entry={url:null,dropped:false};
    entry.promise=imgBlob(zip,names[i]).then(b=>{
      const u=URL.createObjectURL(b);entry.url=u;
      if(entry.dropped||cur!==reader){URL.revokeObjectURL(u);return null}
      return u
    }).catch(e=>{if(cached.get(i)===entry)cached.delete(i);throw e});
    cached.set(i,entry);

    if(cached.size>8){
      for(const k of cached.keys())if(k!==i&&Math.abs(k-reader.i)>3){revoke(k);if(cached.size<=8)break}
    }
    return entry.promise;
  };
  reader.drop=revoke;reader.dropAll=()=>{for(const i of [...cached.keys()])revoke(i)};

  reader.searchOcrImage=async (i,quality='fast')=>{
    if(cur!==reader)throw Error('Leitura encerrada');
    if(i<0||i>=names.length)throw Error('Página inválida');
    const blob=await imgBlob(zip,names[i]);
    const bitmap=await createImageBitmap(blob);
    try{return bitmapToSearchCanvas(bitmap,quality)}finally{bitmap.close?.()}
  };
  pagesInit(names.length,ratio,async(i,d)=>{
    const token=d._pageToken=Symbol('image-page');
    const src=await url(i);
    if(!src||cur!==reader||d._pageToken!==token||!d.isConnected)return;
    const im=new Image();im.decoding='async';im.loading='eager';im.alt='';im.src=src;
    d.replaceChildren(im);
    if(S.mode==='page'){
      for(const k of cached.keys())if(Math.abs(k-i)>3)revoke(k);
      if(i+1<names.length)url(i+1).catch(()=>{});
    }
  },(i,d)=>{
    d._pageToken=null;
    releaseCanvas(d);
    revoke(i);
  },reader.meta.p);
  reader.toc=(names.toc||[]).map(t=>({label:t.label,go:()=>reader.goto(t.i)}));
  const thumbs=makeThumbnailCache();
  reader.thumb=i=>thumbs(i,async()=>{
    const bl=await imgBlob(zip,names[i]);
    let bm;
    try{
      try{bm=await createImageBitmap(bl,{resizeWidth:200,resizeQuality:'low'})}
      catch{bm=await createImageBitmap(bl)}
      const c=document.createElement('canvas');
      try{
        const k=Math.min(1,200/bm.width);c.width=Math.max(1,Math.round(bm.width*k));c.height=Math.max(1,Math.round(bm.height*k));
        c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
        return c.toDataURL('image/jpeg',.65)
      }finally{c.width=c.height=0}
    }finally{bm?.close?.()}
  });
}
async function openPdf(blob){
  const reader=cur;
  pdfjsLib.GlobalWorkerOptions.workerSrc='libs/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:await blob.arrayBuffer()}).promise;
  if(cur!==reader){await pdf.destroy();return}
  reader.pdf=pdf;
  reader.searchPdfPage=async i=>{
    if(cur!==reader)throw Error('Leitura encerrada');
    return pdf.getPage(i+1);
  };
  reader.searchOcrImage=async (i,quality='fast')=>{
    const page=await reader.searchPdfPage(i);
    if(cur!==reader)throw Error('Leitura encerrada');
    const base=page.getViewport({scale:1});

    const target=quality==='detailed'?1500:1100, megapixels=quality==='detailed'?2300000:1350000;
    const scale=Math.min(1.55,target/Math.max(1,base.width),2300/Math.max(1,base.height),Math.sqrt(megapixels/Math.max(1,base.width*base.height)));
    const vp=page.getViewport({scale:Math.max(.15,scale)});
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(vp.width));canvas.height=Math.max(1,Math.round(vp.height));
    try{await page.render({canvasContext:canvas.getContext('2d',{alpha:false,willReadFrequently:false}),viewport:vp}).promise;return canvas}
    catch(e){canvas.width=canvas.height=0;throw e}
  };
  const p1=await pdf.getPage(1);
  if(cur!==reader)return;
  const v1=p1.getViewport({scale:1});
  pagesInit(pdf.numPages,v1.width/v1.height,async(i,d)=>{
    const token=d._pageToken=Symbol('pdf-page');
    const active=()=>cur===reader&&d._pageToken===token&&d.isConnected;
    const page=await pdf.getPage(i+1);
    if(!active())return;
    const views=pdfViewports(page,Math.max(1,d.clientWidth));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.floor(views.render.width));
    c.height=Math.max(1,Math.floor(views.render.height));
    const renderTask=page.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:views.render});
    d._renderTask=renderTask;
    try{await renderTask.promise}
    catch(e){c.width=c.height=0;if(e?.name==='RenderingCancelledException'||!active())return;throw e}
    finally{if(d._renderTask===renderTask)d._renderTask=null}
    if(!active()){c.width=c.height=0;return}
    d.replaceChildren(c);
    try{
      const tc=await page.getTextContent();if(!active())return;
      const tl=document.createElement('div');tl.className='textLayer';
      tl.style.cssText=`width:${views.display.width}px;height:${views.display.height}px`;
      tl.style.setProperty('--scale-factor',views.display.scale);
      d.append(tl);
      const layer=pdfjsLib.renderTextLayer({textContentSource:tc,container:tl,viewport:views.display,textDivs:[]});
      d._textTask=layer;await layer.promise;
    }catch(e){if(active()&&e?.name!=='RenderingCancelledException')console.debug('Camada de texto indisponível',e)}
    finally{d._textTask=null}
    if(active())paintHl(d);
  },(i,d)=>{
    d._pageToken=null;
    try{d._renderTask?.cancel()}catch{}
    try{d._textTask?.cancel()}catch{}
    d._renderTask=null;d._textTask=null;
    releaseCanvas(d);
  },reader.meta.p);
  reader.addHl=()=>reader.els?.forEach(paintHl);
  const thumbs=makeThumbnailCache();
  reader.thumb=i=>thumbs(i,async()=>{
    if(cur!==reader)return '';
    const page=await pdf.getPage(i+1);
    if(cur!==reader)return '';
    const view=page.getViewport({scale:200/page.getViewport({scale:1}).width});
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(view.width));c.height=Math.max(1,Math.round(view.height));
    try{await page.render({canvasContext:c.getContext('2d'),viewport:view}).promise;return c.toDataURL('image/jpeg',.65)}
    finally{c.width=c.height=0}
  });
  reader.find=async q=>{
    const out=[],ql=q.toLowerCase();
    for(let i=1;i<=pdf.numPages&&out.length<80&&cur===reader;i++){
      const tc=await(await pdf.getPage(i)).getTextContent();
      if(cur!==reader)break;
      const str=tc.items.map(x=>x.str).join(' '),k=str.toLowerCase().indexOf(ql);
      if(k>=0)out.push({label:'pág. '+i+': …'+str.slice(Math.max(0,k-40),k+q.length+40)+'…',go:()=>reader.goto(i-1)});

      if(i%12===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return out;
  };
  pdf.getOutline().then(o=>{
    if(cur!==reader)return;
    reader.toc=(o||[]).map(t=>({label:t.title,go:async()=>{
      let dest=t.dest;if(typeof dest==='string')dest=await pdf.getDestination(dest);
      if(dest&&cur===reader)reader.goto(await pdf.getPageIndex(dest[0]));
    }}));
  }).catch(()=>{});
}


async function openEpub(blob){
  const reader=cur;
  const data=await blob.arrayBuffer();
  if(cur!==reader)return;
  view('epub');
  const book=ePub(data),m=reader.meta;reader.book=book;
  const r=book.renderTo('epub',{width:'100%',height:'100%',flow:'paginated',spread:'none'});reader.rendition=r;cur.fl='paginated';
  cur.next=()=>r.next();cur.prev=()=>r.prev();cur.jump=p=>{setBack(m.p);return r.display(p)};
  cur.find=async q=>{const res=await Promise.all(book.spine.spineItems.map(it=>it.load(book.load.bind(book)).then(()=>it.find(q)).catch(()=>[]).finally(()=>it.unload())));
    return [].concat(...res).slice(0,80).map(x=>({label:x.excerpt.trim(),go:()=>cur.jump(x.cfi)}))};
  cur.addHl=h=>r.annotations.highlight(h.a,{},()=>$('#mHl').click(),'hl-'+h.id,{fill:h.c,'fill-opacity':'0.4','mix-blend-mode':'multiply'});
  cur.rmHl=h=>r.annotations.remove(h.a,'highlight');
  r.on('selected',(cfi,ct)=>{const x=ct.window.getSelection().toString().trim();if(x)showSel({k:'e',a:cfi,x,clear:()=>ct.window.getSelection().removeAllRanges()})});
  cur.refresh=()=>{const t=effT();
    r.themes.fontSize(S.size+'%');r.themes.override('background',t.bg);r.themes.override('color',t.fg);r.themes.override('font-weight',t.w);r.themes.override('font-family',FONTS[S.font]);r.themes.override('line-height',String(S.lh));r.themes.override('text-align',S.just?'justify':'inherit');r.themes.override('hyphens',S.hy?'auto':'manual');if(cur.mgv!==S.mg){cur.mgv=S.mg;setTimeout(()=>r.resize(),60)}
    const fl=S.mode==='scroll'?'scrolled-doc':'paginated';if(cur.fl!==fl){cur.fl=fl;r.flow(fl)}};
  r.on('keyup',e=>{if(cur!==reader)return;if(e.key==='ArrowRight')nav(1);if(e.key==='ArrowLeft')nav(-1)});
  r.on('relocated',l=>{if(cur!==reader)return;m.p=l.start.cfi;const d=l.start.displayed;
    const f=reader.located?book.locations.percentageFromCfi(l.start.cfi):l.start.index/Math.max(1,book.spine.length);
    report(f,100,d&&d.total?`faltam ${d.total-d.page} págs no capítulo`:'')});
  book.loaded.navigation.then(n=>{
    if(cur===reader)reader.toc=n.toc.map(t=>({label:t.label.trim(),go:()=>reader.jump(t.href)}))
  }).catch(()=>{});
  await r.display(m.p||undefined);
  if(cur!==reader)return;
  (m.hl||[]).filter(h=>h.k==='e'&&!h.noteOnly).forEach(h=>reader.addHl(h));

  const locate=()=>{
    if(cur!==reader)return;
    book.locations.generate(1000).then(()=>{if(cur===reader)reader.located=true}).catch(()=>{});
  };
  if(typeof requestIdleCallback==='function')reader.idleHandle=requestIdleCallback(locate,{timeout:3500});
  else reader.idleTimer=setTimeout(locate,850);
}


async function openTxt(blob){
  const reader=cur,t=$('#txt'),m=reader.meta;
  const raw=await blob.text();if(cur!==reader)return;
  view('txt');reader.txt=raw;t.lang='pt-BR';
  const frac=()=>t.scrollTop/Math.max(1,t.scrollHeight-t.clientHeight);
  const render=()=>{const y=t.scrollTop;t.textContent='';let pos=0;
    for(const h of (m.hl||[]).filter(x=>x.k==='t'&&!x.noteOnly).sort((a,b)=>a.a-b.a)){if(h.a<pos)continue;t.append(raw.slice(pos,h.a));
      const mk=document.createElement('mark');mk.textContent=raw.slice(h.a,h.b);mk.style.cssText='background:'+h.c+';color:inherit';mk.title=h.n||'';mk.onclick=()=>$('#mHl').click();t.append(mk);pos=h.b}
    t.append(raw.slice(pos));t.scrollTop=y};
  cur.addHl=render;render();
  t.onscroll=()=>{if(cur){m.p=frac();report(frac(),50,'')}};
  cur.next=()=>t.scrollBy({top:t.clientHeight*.9,behavior:'smooth'});
  cur.prev=()=>t.scrollBy({top:-t.clientHeight*.9,behavior:'smooth'});
  cur.jump=p=>{setBack(m.p);t.scrollTop=p*(t.scrollHeight-t.clientHeight)};
  cur.find=async q=>{const lo=raw.toLowerCase(),ql=q.toLowerCase(),out=[];let i=0;
    while(out.length<80&&(i=lo.indexOf(ql,i))>=0){const a=i;out.push({label:'…'+raw.slice(Math.max(0,a-40),a+q.length+40).replace(/\s+/g,' ')+'…',go:()=>cur.jump(a/raw.length)});i+=q.length}return out};
  const chk=()=>{const s=getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;const r=s.getRangeAt(0);if(!t.contains(r.commonAncestorContainer))return;
    const pre=r.cloneRange();pre.selectNodeContents(t);pre.setEnd(r.startContainer,r.startOffset);const a=pre.toString().length,x=r.toString();
    if(x.trim())showSel({k:'t',a,b:a+x.length,x,clear:()=>s.removeAllRanges()})};
  t.onmouseup=t.ontouchend=()=>setTimeout(chk,50);
  requestAnimationFrame(()=>{t.scrollTop=(m.p||0)*(t.scrollHeight-t.clientHeight)});
}


const lum=c=>{const n=parseInt(c.slice(1),16);return(.2126*(n>>16)+.7152*(n>>8&255)+.0722*(n&255))/255};
const FONTS={serif:'Georgia,"Times New Roman",serif',sans:'-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',mono:'ui-monospace,"SF Mono",Consolas,monospace'};
function light(){refreshChg();$('#dim').style.opacity=1-(S.bri??1);$('#warm').style.opacity=(S.warm||0)/100;persistReading();updateReaderPreview()}
let wl=null;
async function wake(){try{if(!wl&&cur&&'wakeLock' in navigator){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>wl=null)}}catch{}}
function unwake(){try{wl&&wl.release()}catch{}wl=null}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cur&&S.awake)wake()});
function apply(){
  appApply();
  const t=effT(),r=document.documentElement.style;
  r.setProperty('--bg',t.bg);r.setProperty('--fg',t.fg);r.setProperty('--filter',S.pf&&t.f!=='none'?t.f:'brightness(1)');r.setProperty('--pbr',S.pbr||1);const dk=lum(t.bg)<.35;r.setProperty('--pgs',dk?'0 0 0 1px rgba(255,255,255,.1),0 10px 40px rgba(0,0,0,.7)':'none');$('#reader').style.colorScheme=dk?'dark':'light';r.setProperty('--w',t.w);
  r.setProperty('--rf',FONTS[S.font]);r.setProperty('--lh',S.lh);r.setProperty('--mg',S.mg+'px');
  const qt=$('#quickTheme');if(qt){qt.title='Tema atual: '+(THEMES[S.theme]?.n||S.theme)+' · alternar tema';qt.setAttribute('aria-label',qt.title)}
  const x=$('#txt').style;x.fontSize=(18*S.size/100)+'px';x.textAlign=S.just?'justify':'left';x.hyphens=S.hy?'auto':'manual';
  $('#stage').classList.toggle('noedge',!S.edges);paintPreview();
  light();cur&&cur.refresh&&cur.refresh();S.awake?wake():unwake();tick();menuVis();
  document.querySelectorAll('.themes button').forEach(b=>b.classList.toggle('on',b.dataset.t===S.theme));
}
function nav(d){if(!cur)return;if(cur.pages&&S.mode==='page'&&S.rtl)d=-d;d>0?cur.next():cur.prev()}


function sheet(title,fill){
  cancelCombinedSearch();const s=$('#sheet');s.classList.remove('read-sheet','search-documento','search-rapida','search-ocr','search-contextual');s.innerHTML='';const h=document.createElement('h2');h.textContent=title;
  const x=document.createElement('button');x.textContent='✕';x.setAttribute('aria-label','Fechar');x.onclick=()=>s.hidden=true;
  h.append(x);s.append(h);fill(s);s.hidden=false;$('#menu').hidden=true;
  s.setAttribute('role','dialog');s.setAttribute('aria-modal','false');s.setAttribute('aria-label',title);
  requestAnimationFrame(()=>{
    if(s.hidden)return;
    const first=s.querySelector('input[type=search],input:not([type=hidden]),button:not([disabled])');
    first?.focus({preventScroll:true});
  });
}
$('#mToc').onclick=()=>sheet('Sumário',s=>{
  if(!cur.toc.length){s.insertAdjacentHTML('beforeend','<p class="note">Este livro não tem sumário. Use "Ir para a página" nos ajustes.</p>');return}
  const w=document.createElement('div');w.className='toc';
  cur.toc.forEach(t=>{const b=document.createElement('button');b.textContent=t.label;b.onclick=()=>{t.go();$('#sheet').hidden=true};w.append(b)});s.append(w)});
$('#mSet').onclick=()=>openSettings();
const seg=(key,opts,done)=>{const d=document.createElement('div');d.className='seg';d.dataset.k=key;
  opts.forEach(([v,l])=>{const b=document.createElement('button');b.textContent=l;b.classList.toggle('on',S[key]===v);
    b.onclick=()=>{S[key]=v;apply();[...d.children].forEach(c=>c.classList.toggle('on',c===b));done&&done()};d.append(b)});return d};
const range=(key,min,max,step,show,live)=>{const w=document.createElement('div');w.className='rg';w.dataset.k=key;
  const i=document.createElement('input'),o=document.createElement('output');Object.assign(i,{type:'range',min,max,step,value:S[key]});o.textContent=show(S[key]);
  i.setAttribute('aria-label',key);
  i.oninput=()=>{S[key]=+i.value;o.textContent=show(S[key]);live&&(live(),0)};i.onchange=()=>{S[key]=+i.value;live?light():apply()};
  paint(i);w.append(i,o);return w};
const sw=(key,full)=>{const b=document.createElement('button');b.className='sw';b.dataset.k=key;b.setAttribute('role','switch');
  const f=()=>{b.setAttribute('aria-checked',!!S[key]);b.classList.toggle('on',!!S[key])};f();
  b.onclick=()=>{S[key]=!S[key];f();full?apply():light()};return b};
const ctl=(box,label,node)=>{const r=document.createElement('div');
  const wide=node.nodeType===1&&(node.classList.contains('sws')||node.classList.contains('rg')||node.tagName==='SELECT'||!!node.querySelector('input')||
    (node.classList.contains('seg')&&node.children.length>=3)||(!node.classList.contains('seg')&&node.querySelectorAll('button').length>=2));
  r.className='ctl'+(wide?' full':'');const sp=document.createElement('span'),inf=!$('#cfg').hidden&&INFO[label];
  if(inf){sp.innerHTML='<span class="lt"></span><small class="dsc"></small>';sp.children[0].textContent=label;sp.children[1].textContent=inf.d||'';
    if(inf.f){const t=document.createElement('em');t.className='tag';t.textContent=inf.f;sp.children[0].append(t)}}else sp.textContent=label;
  const k=(node.dataset&&node.dataset.k)||(node.querySelector&&((node.querySelector('[data-k]')||{dataset:{}}).dataset.k));
  if(k){r.dataset.k=k;box._keys&&box._keys.add(k);r.classList.toggle('chg',S[k]!==DEF[k])}
  r.append(sp,node);box.append(r)};
function openSettings(nextTab){
  if(!cur)return;
  if(nextTab)readTab=nextTab;
  const s=$('#sheet');s.innerHTML='';s.classList.add('read-sheet');s.hidden=false;
  $('#menu').hidden=true;
  const img=!!cur.pages,txtish=cur.type==='epub'||cur.type==='txt';
  const tabs=[['leitura','Leitura'],['pagina','Página'],['aparencia','Aparência'],['avancado','Avançado']];
  if(txtish)tabs.splice(2,0,['texto','Texto']);
  if(!tabs.some(t=>t[0]===readTab))readTab='leitura';
  const head=document.createElement('div');head.className='reader-sheet-head';
  const heading=document.createElement('h2');heading.textContent='Ajustes de leitura';
  const close=document.createElement('button');close.textContent='✕';close.setAttribute('aria-label','Fechar ajustes de leitura');close.onclick=()=>s.hidden=true;
  heading.append(close);head.append(heading);
  const subtitle=document.createElement('p');subtitle.className='reader-subtitle';subtitle.textContent='Altere a visualização sem sair do livro.';head.append(subtitle);
  const nav=document.createElement('nav');nav.className='read-tabs';nav.setAttribute('aria-label','Categorias dos ajustes');
  const body=document.createElement('div');body.className='read-sheet-body';
  tabs.forEach(([key,label])=>{
    const btn=document.createElement('button');btn.textContent=label;btn.classList.toggle('on',readTab===key);btn.type='button';
    btn.setAttribute('aria-pressed',String(readTab===key));
    btn.onclick=()=>{readTab=key;openSettings(key)};nav.append(btn)
  });
  head.append(nav);s.append(head,body);
  const section=(label,desc)=>{
    const heading=document.createElement('h3');heading.className='read-section-label';heading.textContent=label;body.append(heading);
    if(desc){const hint=document.createElement('p');hint.className='read-help';hint.textContent=desc;body.append(hint)}
    const div=document.createElement('div');div.className='read-panel';body.append(div);return div
  };
  const notice=(label)=>{const p=document.createElement('p');p.className='read-note';p.textContent=label;body.append(p)};
  const currentGroup=(cb,label)=>{const div=section(label);cb(div);return div};
  const controlledRange=(key,min,max,step,display,render)=>{
    const widget=range(key,min,max,step,display,render);
    const input=widget.querySelector('input');input.title='Duplo clique para restaurar o valor padrão';
    input.setAttribute('aria-valuetext',display(S[key]));
    input.addEventListener('input',()=>input.setAttribute('aria-valuetext',display(+input.value)));
    input.addEventListener('dblclick',()=>{S[key]=DEF[key];input.value=S[key];paint(input);widget.querySelector('output').textContent=display(S[key]);apply();input.dispatchEvent(new Event('input',{bubbles:true}))});
    return widget
  };
  const addPreview=()=>{const p=createReaderPreview();body.append(p);updateReaderPreview()};
  if(readTab==='leitura'){
    let g=section('Modo de navegação');
    ctl(g,'Modo',seg('mode',[['page','Página'],['scroll','Rolagem']],()=>{openSettings('leitura')}));
    if(img&&S.mode==='page'){
      ctl(g,'Direção do mangá (direita → esquerda)',sw('rtl',true));
      ctl(g,'Página dupla',sw('two',true));
      ctl(g,'Capa em página separada',sw('cov1',true));
      notice('O modo de página dupla se ativa automaticamente quando há largura suficiente. Na rolagem, cada página é exibida em sequência.');
    }else if(!img)notice('EPUB e TXT usam os modos Página e Rolagem. Os recursos de mangá e página dupla são exclusivos de PDF, CBZ e imagens.');
    if(img){g=section('Navegação por página');
      const w=document.createElement('div');w.className='rg';
      const i=document.createElement('input'),o=document.createElement('output');
      Object.assign(i,{type:'range',min:1,max:cur.n,step:1,value:cur.i+1});
      o.textContent=(cur.i+1)+' / '+cur.n;i.setAttribute('aria-label','Ir para página');paint(i);
      i.oninput=()=>{o.textContent=i.value+' / '+cur.n;paint(i)};
      i.onchange=()=>{cur.goto(+i.value-1)};
      w.append(i,o);ctl(g,'Ir para página',w)
    }
    g=section('Leitura sem distrações','O modo foco amplia o espaço de leitura e esconde os controles automaticamente. Mova o mouse, toque na página ou use o botão discreto para mostrá-los.');
    const focusRow=document.createElement('div');focusRow.className='read-focus-row';
    const focusInfo=document.createElement('div');focusInfo.innerHTML='<strong>Modo foco</strong><small>Atalho F · Esc para sair</small>';
    const focusButton=document.createElement('button');focusButton.type='button';focusButton.className='primary';
    focusButton.textContent=readerFocusActive?'Desativar foco':'Ativar foco';
    focusButton.onclick=()=>{s.hidden=true;setReaderFocus(!readerFocusActive);};
    focusRow.append(focusInfo,focusButton);g.append(focusRow);
    g=section('Aplicação dos ajustes');
    const wrap=document.createElement('div');wrap.className='read-scope';
    const scopeLabel=document.createElement('label');scopeLabel.textContent='Onde salvar as alterações';scopeLabel.htmlFor='read-scope-select';
    const sel=document.createElement('select');sel.id='read-scope-select';
    [['global','Todos os livros (padrão)'],['book','Somente este livro']].forEach(([v,l])=>{const opt=new Option(l,v);sel.append(opt)});
    sel.value=readScope;sel.onchange=()=>{setReadScope(sel.value);openSettings('leitura')};
    const explain=document.createElement('small');explain.textContent=readScope==='book'?'Este livro guarda seus ajustes próprios. Suas preferências gerais permanecem intactas.':'As mudanças serão utilizadas como padrão nos próximos livros.';
    wrap.append(scopeLabel,sel,explain);g.append(wrap);
    addPreview();
  }else if(readTab==='pagina'){
    let g=section('Tamanho e encaixe');
    ctl(g,'Zoom',controlledRange('size',50,300,5,v=>v+'%',apply));
    if(img){ctl(g,'Ajustar à',seg('fit',[['auto','Altura'],['width','Largura']]));
      notice('Altura ajusta a página à área visível. Largura preenche o espaço horizontal; use a rolagem quando necessário.');
    }
    else notice('O zoom controla o tamanho do texto em EPUB ou TXT.');
    addPreview();
  }else if(readTab==='aparencia'){
    let g=section('Fundos de leitura','Os fundos da página são independentes das cores e do tema do aplicativo.');
    ctl(g,'Fundo da leitura',bgCtl());
    const themeLabel=document.createElement('h4');themeLabel.className='read-section-label';themeLabel.textContent='Estilo das páginas';g.append(themeLabel,themeGrid());
    g=section('Iluminação','Brilho escurece a leitura; luz quente suaviza a tela.');
    ctl(g,'Brilho da leitura',controlledRange('bri',.2,1,.05,v=>Math.round(v*100)+'%',light));
    ctl(g,'Luz quente',controlledRange('warm',0,60,5,v=>v?v+'%':'Desligada',light));
    if(img){ctl(g,'Aplicar o tema à página',sw('pf',true));
      ctl(g,'Brilho da página',controlledRange('pbr',.5,1,.05,v=>Math.round(v*100)+'%',()=>{document.documentElement.style.setProperty('--pbr',S.pbr);light()}));}
    addPreview();
  }else if(readTab==='texto'){
    const g=section('Tipografia','Disponível para livros EPUB e arquivos TXT.');
    ctl(g,'Fonte',seg('font',[['serif','Serifa'],['sans','Sem serifa'],['mono','Mono']]));
    ctl(g,'Espaçamento',seg('lh',[[1.4,'Compacto'],[1.7,'Normal'],[2,'Amplo']]));
    ctl(g,'Justificar texto',sw('just',true));
    ctl(g,'Hifenização',sw('hy',true));
    ctl(g,'Margens',controlledRange('mg',16,120,8,v=>v+'px',apply));
    addPreview();
  }else{
    let g=section('Perfis de leitura','Aplique uma configuração rápida ou salve suas próprias combinações.');
    const presetList=document.createElement('div');
    const list=[...BUILTIN_READ_PRESETS.map(p=>({...p,builtin:true})),...getReadPresets().map(p=>({...p,builtin:false}))];
    list.forEach(p=>{
      const r=document.createElement('div');r.className='read-preset-row';
      const label=document.createElement('span');label.textContent=p.name;r.append(label);
      const use=mbtn('Aplicar',()=>{Object.assign(S,p.values);apply();openSettings('avancado');toast('Perfil de leitura aplicado: '+p.name)});r.append(use);
      if(!p.builtin){const del=mbtn('Excluir',()=>{if(confirm('Excluir o perfil de leitura "'+p.name+'"?')){saveReadPresets(getReadPresets().filter(x=>x.name!==p.name));openSettings('avancado')}},'read-btn-danger');del.setAttribute('aria-label','Excluir perfil '+p.name);r.append(del)}
      presetList.append(r)
    });g.append(presetList);
    const form=document.createElement('form');form.className='read-preset-input';
    const input=document.createElement('input');input.type='text';input.placeholder='Nome do novo perfil';input.maxLength=32;input.required=true;input.setAttribute('aria-label','Nome do perfil de leitura');
    const submit=document.createElement('button');submit.type='submit';submit.className='primary';submit.textContent='Salvar perfil';form.append(input,submit);
    form.onsubmit=e=>{e.preventDefault();const name=input.value.trim();if(!name)return;
      const ps=getReadPresets();if(ps.some(x=>x.name.toLowerCase()===name.toLowerCase())||BUILTIN_READ_PRESETS.some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast('Já existe um perfil com esse nome');
      if(ps.length>=32)return toast('Limite de 32 perfis personalizados');
      ps.push({name,values:readSnapshot()});saveReadPresets(ps);openSettings('avancado');toast('Perfil salvo: '+name)};
    g.append(form);
    g=section('Acessibilidade e interface');
    ctl(g,'Manter a tela ligada',sw('awake',true));
    ctl(g,'Toque nas bordas',sw('edges',true));
    ctl(g,'Relógio e bateria',sw('clock',true));
    g=section('Restaurar ajustes');
    const restore=mbtn('Restaurar somente a leitura',()=>{
      if(!confirm('Restaurar os ajustes de leitura? Seus livros, marcadores, conta, tema do app e estantes serão mantidos.'))return;
      READ_KEYS.forEach(k=>S[k]=DEF[k]);apply();openSettings('avancado');toast('Ajustes de leitura restaurados')
    });restore.className='read-btn-danger';restore.style.width='100%';g.append(restore);
    notice('Os perfis de leitura ficam neste navegador, separados por usuário. Não alteram os dados dos seus livros.');
  }
  requestAnimationFrame(()=>{updateReaderPreview();body.scrollTop=0;nav.querySelector('.on')?.scrollIntoView({block:'nearest',inline:'nearest'})});
}
function createReaderPreview(){
  const root=document.createElement('div');root.className='read-preview';root.id='reader-live-preview';
  const top=document.createElement('div');top.className='read-preview-title';
  const title=document.createElement('strong');title.textContent='Pré-visualização';
  const info=document.createElement('span');info.id='reader-live-label';top.append(title,info);
  const paper=document.createElement('div');paper.className='read-preview-page';
  const make=()=>{const el=document.createElement('div');el.className='read-preview-paper';
    const strong=document.createElement('strong');strong.textContent='Aa';el.append(strong);
    for(let i=0;i<3;i++)el.append(document.createElement('i'));return el};
  paper.append(make());
  const caption=document.createElement('div');caption.className='read-preview-caption';caption.textContent='Prévia ilustrativa. Os ajustes são aplicados imediatamente ao livro aberto.';
  root.append(top,paper,caption);return root;
}
function updateReaderPreview(){
  const el=document.getElementById('reader-live-preview');if(!el)return;
  const p=el.querySelector('.read-preview-page'),paper=p.querySelector('.read-preview-paper');
  const t=effT();p.style.setProperty('--read-canvas-bg',t.bg);p.style.setProperty('--read-canvas-fg',t.fg);
  p.style.setProperty('--read-canvas-warm',String((S.warm||0)/170));
  p.style.setProperty('--read-brightness',String(S.bri??1));
  p.style.setProperty('font-family',FONTS[S.font]||FONTS.serif);
  p.style.setProperty('font-weight',t.w);
  p.style.setProperty('font-size',Math.max(12,Math.min(22,15*S.size/100))+'px');
  p.closest('.read-preview').dataset.mode=S.mode;
  p.dataset.fit=S.fit;
  const doubl=!!(cur?.pages&&S.two&&S.mode==='page');
  let other=p.querySelector('.read-preview-paper:nth-child(2)');
  if(doubl&&!other){other=paper.cloneNode(true);p.append(other)}
  else if(!doubl&&other)other.remove();
  p.querySelectorAll('.read-preview-paper').forEach(x=>{x.classList.toggle('dual',doubl);x.style.filter=S.pf?`brightness(${S.pbr}) ${t.f}`:'brightness(1)'});
  const label=el.querySelector('#reader-live-label');if(label)label.textContent=`${S.size}% · ${S.mode==='scroll'?'Rolagem':doubl?'Dupla':'Página'}`;
  el.querySelectorAll('.read-preview-paper strong').forEach(x=>x.style.fontFamily=FONTS[S.font]||FONTS.serif);
}
$('#mBm').onclick=()=>sheet('Marcadores',s=>{
  const m=cur.meta;m.bm=m.bm||[];
  const add=document.createElement('button');add.className='primary';add.style.width='100%';add.textContent='Marcar este ponto';
  add.onclick=()=>{if(m.p==null)return toast('Leia um pouco antes de marcar');
    m.bm.push({p:m.p,l:cur.pages?'Página '+(cur.i+1):Math.round(m.f*100)+'% do livro',t:Date.now()});
    tx('books','readwrite',st=>st.put(m));$('#mBm').click()};
  s.append(add);
  if(!m.bm.length)s.insertAdjacentHTML('beforeend','<p class="note">Nenhum marcador neste livro ainda.</p>');
  m.bm.forEach((b,i)=>{const r=document.createElement('div');r.className='bm';
    const go=document.createElement('button'),del=document.createElement('button');
    go.textContent=b.l+' · '+new Date(b.t).toLocaleDateString('pt-BR');del.textContent='✕';del.setAttribute('aria-label','Remover marcador');
    go.onclick=()=>{cur.jump(b.p);$('#sheet').hidden=true};
    del.onclick=()=>{m.bm.splice(i,1);tx('books','readwrite',st=>st.put(m));$('#mBm').click()};
    r.append(go,del);s.append(r)});
});

let readerFocusActive=false, readerFocusTimer=null, readerFocusLastMove=0;
function revealReaderChrome(){
  if(!readerFocusActive||$('#reader').hidden)return;
  const reader=$('#reader');reader.classList.add('reader-focus-visible');
  clearTimeout(readerFocusTimer);
  readerFocusTimer=setTimeout(()=>{
    if(!readerFocusActive)return;
    reader.classList.remove('reader-focus-visible');
    updateReaderFocusInert();
  },4200);
  updateReaderFocusInert();
}
function updateReaderFocusInert(){
  const r=$('#reader'),hidden=readerFocusActive&&!r.classList.contains('reader-focus-visible');
  for(const el of [r.querySelector('header.bar'),r.querySelector('footer'),$('#fab'),$('#L'),$('#R'),$('#pb')]){
    if(el)el.inert=hidden;
  }
  $('#focusToggle').setAttribute('aria-pressed',String(readerFocusActive));
  $('#focusToggle').setAttribute('aria-label',readerFocusActive?'Desativar modo foco':'Ativar modo foco');
}
function setReaderFocus(enabled){
  enabled=!!enabled&&!$('#reader').hidden;
  readerFocusActive=enabled;clearTimeout(readerFocusTimer);
  const reader=$('#reader');
  reader.classList.toggle('reader-focus',enabled);
  reader.classList.toggle('reader-focus-visible',enabled);
  if(enabled){$('#menu').hidden=true;$('#sheet').hidden=true;revealReaderChrome()}
  else {reader.classList.remove('reader-focus-visible');updateReaderFocusInert()}
  $('#mFocus').textContent=enabled?'Desativar modo foco':'Modo foco';
  updateReaderFocusInert();
  requestAnimationFrame(()=>{
    if(!cur)return;
    try{if(cur.rendition?.resize)cur.rendition.resize();else if(cur.pages)cur.refresh?.()}catch(e){console.warn('Não foi possível atualizar o espaço de leitura:',e)}
  });
}
$('#focusToggle').onclick=()=>setReaderFocus(!readerFocusActive);
$('#focusHandle').onclick=()=>revealReaderChrome();
$('#mFocus').onclick=()=>setReaderFocus(!readerFocusActive);
$('#reader').addEventListener('pointermove',e=>{
  if(!readerFocusActive||e.pointerType!=='mouse')return;
  const now=Date.now();if(now-readerFocusLastMove<160)return;
  readerFocusLastMove=now;revealReaderChrome();
});
$('#stage').addEventListener('pointerdown',()=>{if(readerFocusActive)revealReaderChrome()},{passive:true});
$('#reader').addEventListener('focusin',()=>{if(readerFocusActive)revealReaderChrome()});
$('#quickSmaller').onclick=()=>{S.size=Math.max(50,(Number(S.size)||100)-10);apply()};
$('#quickLarger').onclick=()=>{S.size=Math.min(300,(Number(S.size)||100)+10);apply()};
$('#quickTheme').onclick=()=>{
  const choices=['original','quieto','calmo'];
  S.theme=choices[(Math.max(-1,choices.indexOf(S.theme))+1)%choices.length];
  apply();toast('Tema: '+THEMES[S.theme].n);
};
$('#fab').onclick=()=>{$('#sheet').hidden=true;$('#menu').hidden=!$('#menu').hidden;if(readerFocusActive)revealReaderChrome()};
$('#L').onclick=()=>nav(-1);$('#R').onclick=()=>nav(1);
document.addEventListener('keydown',e=>{
  if(!$('#reader').hidden&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='f'&&!e.altKey){e.preventDefault();if($('#sheet').hidden)$('#mFind').click();else $('#sheet').querySelector('.search156-form input[type=search]')?.focus();return}
  if($('#reader').hidden||!$('#sheet').hidden||!$('#menu').hidden||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.target.closest('input,button,select,textarea,[contenteditable=true]'))return;
  if(e.key==='ArrowRight')nav(1);if(e.key==='ArrowLeft')nav(-1);
  if((e.key==='f'||e.key==='F')&&!e.repeat){e.preventDefault();setReaderFocus(!readerFocusActive)}
  if(e.key==='Escape'){if(readerFocusActive){e.preventDefault();setReaderFocus(false)}else $('#sheet').hidden=$('#menu').hidden=true}
});
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>cur&&cur.pages&&cur.refresh(),200)});

const APP_THEMES={
  auto:{label:'Automático',dark:false,preview:'#343038',fg:'#f6f0eb',card:'#77706b',border:'#5b5350',palette:['#25211d','#8a6a55','#d5c9ba','#f6f0eb']},
  light:{label:'Claro',dark:false,preview:'#e9e1d5',fg:'#362e27',card:'#fff9ef',border:'#d5c9ba',palette:['#f4ece0','#dccdb9','#a67b5b','#42342b']},
  dark:{label:'Escuro',dark:true,preview:'#25211d',fg:'#f1e8df',card:'#4c423b',border:'#6c6056',palette:['#181512','#342b25','#a78b71','#f5eee5']},
  nord:{label:'Nord',dark:true,preview:'#2e3440',fg:'#eceff4',card:'#434c5e',border:'#637289',palette:['#2e3440','#434c5e','#81a1c1','#eceff4']},
  dracula:{label:'Dracula',dark:true,preview:'#282a36',fg:'#f8f8f2',card:'#44475a',border:'#6272a4',palette:['#282a36','#6272a4','#bd93f9','#ff79c6']},
  tokyo:{label:'Tokyo Night',dark:true,preview:'#1a1b26',fg:'#c0caf5',card:'#292e42',border:'#565f89',palette:['#1a1b26','#394b70','#7aa2f7','#bb9af7']},
  sepia:{label:'Sépia',dark:false,preview:'#ead7b5',fg:'#51412e',card:'#f9ebcc',border:'#bba37a',palette:['#f6eacc','#dcc59c','#b18a5c','#524334']},
  ocean:{label:'Ocean',dark:true,preview:'#102d3e',fg:'#e4f3f9',card:'#336078',border:'#4c91a9',palette:['#102d3e','#2b627a','#66c9e0','#d3eef4']},
  forest:{label:'Floresta',dark:true,preview:'#1d3626',fg:'#e8f2e2',card:'#3e6447',border:'#6c9773',palette:['#1d3626','#3e6447','#a0d6a6','#e8f2e2']},
  plum:{label:'Ameixa',dark:true,preview:'#32243d',fg:'#f3eaf6',card:'#70577b',border:'#9773aa',palette:['#32243d','#70577b','#d6acdc','#f3eaf6']},
  graphite:{label:'Graphite',dark:true,preview:'#20242c',fg:'#ebeff4',card:'#485364',border:'#69778b',palette:['#1c1e22','#3f444d','#8d929c','#f5f7fa']},
  'cat-mocha':{label:'Catppuccin Mocha',dark:true,preview:'#1e1e2e',fg:'#cdd6f4',card:'#313244',border:'#585b70',palette:['#1e1e2e','#313244','#cba6f7','#a6adc8']},
  'cat-latte':{label:'Catppuccin Latte',dark:false,preview:'#eff1f5',fg:'#4c4f69',card:'#e6e9ef',border:'#bcc0cc',palette:['#eff1f5','#e6e9ef','#8839ef','#7287fd']},
  'gruv-dark':{label:'Gruvbox Dark',dark:true,preview:'#282828',fg:'#ebdbb2',card:'#3c3836',border:'#665c54',palette:['#282828','#3c3836','#d79921','#98971a']},
  'gruv-light':{label:'Gruvbox Light',dark:false,preview:'#fbf1c7',fg:'#3c3836',card:'#ebdbb2',border:'#bdae93',palette:['#fbf1c7','#ebdbb2','#b57614','#79740e']},
  'sol-dark':{label:'Solarized Dark',dark:true,preview:'#002b36',fg:'#eee8d5',card:'#073642',border:'#586e75',palette:['#002b36','#073642','#268bd2','#2aa198']},
  'sol-light':{label:'Solarized Light',dark:false,preview:'#fdf6e3',fg:'#586e75',card:'#eee8d5',border:'#93a1a1',palette:['#fdf6e3','#eee8d5','#268bd2','#859900']},
  'one-dark':{label:'One Dark',dark:true,preview:'#282c34',fg:'#abb2bf',card:'#3e4451',border:'#5c6370',palette:['#282c34','#3e4451','#61afef','#c678dd']},
  'everforest':{label:'Everforest',dark:true,preview:'#2d353b',fg:'#d3c6aa',card:'#3d484d',border:'#56635f',palette:['#2d353b','#3d484d','#a7c080','#83c092']},
  'rose-pine':{label:'Rosé Pine',dark:true,preview:'#191724',fg:'#e0def4',card:'#26233a',border:'#6e6a86',palette:['#191724','#26233a','#c4a7e7','#ebbcba']},
  'ayu-mirage':{label:'Ayu Mirage',dark:true,preview:'#1f2430',fg:'#cccac2',card:'#343b4a',border:'#5c6773',palette:['#1f2430','#343b4a','#ffcc66','#73d0ff']},
  'monokai':{label:'Monokai',dark:true,preview:'#272822',fg:'#f8f8f2',card:'#3e3d32',border:'#75715e',palette:['#272822','#3e3d32','#a6e22e','#f92672']},
  'kanagawa':{label:'Kanagawa',dark:true,preview:'#1f1f28',fg:'#dcd7ba',card:'#363646',border:'#54546d',palette:['#1f1f28','#363646','#7e9cd8','#98bb6c']},
  'palenight':{label:'Material Palenight',dark:true,preview:'#292d3e',fg:'#a6accd',card:'#3b3f58',border:'#676e95',palette:['#292d3e','#3b3f58','#c792ea','#82aaff']},
  'github-dark':{label:'GitHub Dark',dark:true,preview:'#0d1117',fg:'#e6edf3',card:'#21262d',border:'#484f58',palette:['#0d1117','#21262d','#58a6ff','#3fb950']}
};
const ACC={
  marrom:['#8a6a55','#6f5242'],azul:['#4f8ef7','#326dd5'],roxo:['#9575ef','#7052cf'],
  rosa:['#e66fac','#bd4d85'],coral:['#ec7473','#c14d4c'],laranja:['#f4a85e','#cd803a'],
  amarelo:['#f4ce73','#c59a43'],verde:['#70c28d','#4b9a69'],turquesa:['#4ecfca','#2c9e99'],
  custom:['#9575ef','#7052cf']
};
const VALID_HEX=/^#[0-9a-fA-F]{6}$/;
function darkerHex(hex,factor=.77){
  const n=parseInt(hex.slice(1),16);
  return '#'+[n>>16&255,n>>8&255,n&255].map(v=>Math.round(v*factor).toString(16).padStart(2,'0')).join('');
}

function uiRgb(hex){const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255]}
function uiLuminance(hex){
  const c=uiRgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function uiContrast(a,b){const x=uiLuminance(a),y=uiLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function accentReadable(hex){return uiContrast(hex,'#1b1c24')>=uiContrast(hex,'#ffffff')?'#1b1c24':'#ffffff'}
function uiMixHex(a,b,k){
  const x=uiRgb(a),y=uiRgb(b);
  return '#'+x.map((v,i)=>Math.round(v*(1-k)+y[i]*k).toString(16).padStart(2,'0')).join('');
}

function accentOnSurface(hex,dark,bg){
  const target=dark?'#ffffff':'#101727';
  for(let i=0;i<=20;i++){
    const mixed=uiMixHex(hex,target,i/20);
    if(uiContrast(mixed,bg)>=4.5)return mixed;
  }
  return target;
}
function appApply(){
  const d=document.documentElement,theme=APP_THEMES[S.app]||APP_THEMES.auto;
  const systemDark=matchMedia('(prefers-color-scheme: dark)').matches;
  const mode=['theme','light','dark','auto'].includes(S.appMode)?S.appMode:'theme';
  const dark=mode==='dark'?true:mode==='light'?false:mode==='auto'?systemDark:(S.app==='auto'?systemDark:theme.dark);
  d.dataset.uiTheme=S.app in APP_THEMES?S.app:'auto';
  d.dataset.uiModeLock=mode==='theme'?'':(dark?'dark':'light');
  d.style.setProperty('--lector-palette-accent',(theme.palette||[])[2]||'#9575ef');
  d.dataset.app=dark?'dark':'light';d.classList.toggle('solid',!S.glass);d.classList.toggle('compact',S.dens==='compact');d.classList.toggle('lector-low-effects',!!S.lowEffects);
  const preset=ACC[S.accent]||ACC.marrom;
  const selected=S.accent==='custom'&&VALID_HEX.test(S.accentCustom||'')?S.accentCustom:preset[0];
  const selectedHover=S.accent==='custom'?darkerHex(selected):preset[1];
  d.style.setProperty('--accent',selected);d.style.setProperty('--accent-dark',selectedHover);
  d.style.setProperty('--accent-fg',accentReadable(selected));
  d.style.setProperty('--accent-dark-fg',accentReadable(selectedHover));
  const canvasBg=dark?'#171b25':'#f3f5fa';
  const accentInk=accentOnSurface(selected,dark,canvasBg);
  d.style.setProperty('--accent-ink',accentInk);
  d.style.setProperty('--ui-focus-ink',accentInk);
  const metaTheme=document.querySelector('meta[name="theme-color"]');if(metaTheme)metaTheme.content=mode==='theme'?(dark?theme.preview:(S.app==='auto'?'#e9e1d5':theme.preview)):(dark?'#171b25':'#f3f5fb');
  if(user)lsSet('leitor:last-appearance',{app:S.app,appMode:S.appMode,accent:S.accent,accentCustom:S.accentCustom,glass:S.glass});
  document.querySelectorAll('#login,#lib,#cfg').forEach(e=>{const z=(S.ui||100)/100;e.style.zoom=z;e.style.height=z===1?'':'calc(100dvh / '+z+')'});
  setLang();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>((S.appMode==='auto')||(S.appMode==='theme'&&S.app==='auto'))&&appApply());
async function tick(){const el=$('#fT');if(!S.clock||!cur){el.textContent='';return}
  let t=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});try{const b=await navigator.getBattery();t+=' · '+Math.round(b.level*100)+'%'}catch{}el.textContent=t}
setInterval(tick,30000);
$('#fs').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>toast('Tela cheia não disponível'));
