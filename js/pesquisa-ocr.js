
const SEARCH_OCR_JS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const SEARCH_OCR_WORKER='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js';
const SEARCH_OCR_CORE='https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0';
const SEARCH_OCR_LANG='https://tessdata.projectnaptha.com/4.0.0';
let ocrLibraryPromise=null,combinedSearchJob=null,searchCacheDBPromise=null,searchOcrPool=null;

const searchSessionIndex=new Map();
const searchNormalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const searchYield=()=>new Promise(resolve=>setTimeout(resolve,0));
function bitmapToSearchCanvas(bmp,quality='fast'){
  const maxW=quality==='detailed'?1500:1100,maxPixels=quality==='detailed'?2300000:1350000;
  const scale=Math.min(1,maxW/Math.max(1,bmp.width),2000/Math.max(1,bmp.height),Math.sqrt(maxPixels/Math.max(1,bmp.width*bmp.height)));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
  c.getContext('2d',{alpha:false}).drawImage(bmp,0,0,c.width,c.height);return c;
}
function searchCacheDB(){
  if(searchCacheDBPromise)return searchCacheDBPromise;
  searchCacheDBPromise=new Promise(resolve=>{
    try{const req=indexedDB.open('leitor-search-v1',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('pages')){
        const st=db.createObjectStore('pages',{keyPath:'key'});st.createIndex('book','book');
      }};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
    }catch{resolve(null)}
  });return searchCacheDBPromise;
}
const searchBookKey=(profile,book)=>JSON.stringify([profile,book.id,book.size||0]);
const searchPageKey=(bookKey,kind,lang,page)=>JSON.stringify([bookKey,kind,lang,page]);
async function searchBookRecords(bookKey){
  const db=await searchCacheDB();if(!db)return [];
  return new Promise(resolve=>{try{
    const rq=db.transaction('pages','readonly').objectStore('pages').index('book').getAll(bookKey);
    rq.onsuccess=()=>resolve(rq.result||[]);rq.onerror=()=>resolve([]);
  }catch{resolve([])}});
}
async function indexedSearchText(bookKey,kind,lang,page){
  const db=await searchCacheDB();if(!db)return null;
  return new Promise(resolve=>{try{
    const rq=db.transaction('pages','readonly').objectStore('pages').get(searchPageKey(bookKey,kind,lang,page));
    rq.onsuccess=()=>resolve(rq.result?.text??null);rq.onerror=()=>resolve(null);
  }catch{resolve(null)}});
}
async function saveIndexedSearchText(bookKey,kind,lang,page,text){
  let session=searchSessionIndex.get(bookKey);if(!session){session=new Map();searchSessionIndex.set(bookKey,session)}
  session.set(`${kind}|${lang}|${page}`,String(text??''));
  if(searchSessionIndex.size>6)searchSessionIndex.delete(searchSessionIndex.keys().next().value);
  const db=await searchCacheDB();if(!db)return;
  return new Promise(resolve=>{try{
    const rq=db.transaction('pages','readwrite').objectStore('pages').put({
      key:searchPageKey(bookKey,kind,lang,page),book:bookKey,text:String(text??''),date:Date.now()
    });rq.onsuccess=()=>resolve();rq.onerror=()=>resolve();
  }catch{resolve()}});
}
async function purgeBookSearchCache(profile,id){
  for(const key of searchSessionIndex.keys()){try{const arr=JSON.parse(key);if(arr[0]===profile&&arr[1]===id)searchSessionIndex.delete(key)}catch{}}
  const db=await searchCacheDB();if(!db)return;
  return new Promise(resolve=>{try{
    const tr=db.transaction('pages','readwrite'),rq=tr.objectStore('pages').index('book').openCursor();
    rq.onsuccess=()=>{const c=rq.result;if(!c)return;
      try{const arr=JSON.parse(c.value.book);if(arr[0]===profile&&arr[1]===id)c.delete()}catch{}c.continue();
    };tr.oncomplete=()=>resolve();tr.onerror=()=>resolve();tr.onabort=()=>resolve();
  }catch{resolve()}});
}
function releaseSearchOcrPool(){
  const pool=searchOcrPool;searchOcrPool=null;
  if(pool){clearTimeout(pool.timer);Promise.resolve(pool.worker?.terminate()).catch(()=>{});}
}
function cancelCombinedSearch(){
  const job=combinedSearchJob;if(!job)return;
  job.cancelled=true;combinedSearchJob=null;

  if(job.worker){if(searchOcrPool?.worker===job.worker)searchOcrPool=null;
    const worker=job.worker;job.worker=null;Promise.resolve(worker.terminate()).catch(()=>{});
  }
}
async function loadOcrLibrary(){
  if(window.Tesseract?.createWorker)return window.Tesseract;
  if(!ocrLibraryPromise)ocrLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=SEARCH_OCR_JS;script.async=true;
    script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(Error('Biblioteca OCR indisponível'));
    script.onerror=()=>reject(Error('Não foi possível baixar o OCR. Conecte-se à internet para a primeira utilização.'));
    document.head.append(script);
  }).catch(err=>{ocrLibraryPromise=null;throw err});
  return ocrLibraryPromise;
}
async function makeOcrWorker(job,lang){
  if(searchOcrPool?.lang===lang&&searchOcrPool.worker){
    clearTimeout(searchOcrPool.timer);job.worker=searchOcrPool.worker;return job.worker;
  }
  releaseSearchOcrPool();
  const api=await loadOcrLibrary();if(job.cancelled)throw Error('Pesquisa cancelada');
  const worker=await api.createWorker(lang.includes('+')?lang.split('+'):lang,1,{
    workerPath:SEARCH_OCR_WORKER,corePath:SEARCH_OCR_CORE,langPath:SEARCH_OCR_LANG,
    logger:m=>{const active=combinedSearchJob;if(active&&!active.cancelled&&m.status==='recognizing text')active.ocrProgress?.(Math.round((m.progress||0)*100))}
  });
  if(job.cancelled){await worker.terminate();throw Error('Pesquisa cancelada')}
  try{await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'})}catch(err){console.debug('OCR: configuração PSM não disponível',err)}
  searchOcrPool={worker,lang,timer:null};job.worker=worker;return worker;
}
function relaxSearchWorker(job){
  if(job.worker&&searchOcrPool?.worker===job.worker){
    searchOcrPool.timer=setTimeout(()=>{if(!combinedSearchJob)releaseSearchOcrPool()},90000);
  }
  job.worker=null;
}

function searchIndexWithMap(input){
  let normalized='',offsets=[];const s=String(input??'');
  for(let i=0;i<s.length;){
    const cp=s.codePointAt(i),char=String.fromCodePoint(cp),n=searchNormalize(char);
    for(let j=0;j<n.length;j++)offsets.push(i);
    normalized+=n;i+=char.length;
  }
  offsets.push(s.length);return {normalized,offsets};
}
function searchFindOffsets(text,query,limit=4){
  const mapped=searchIndexWithMap(text),needle=searchNormalize(query).trim(),found=[];
  if(!needle||needle.length<2)return found;
  let at=0;
  while(found.length<limit){
    const i=mapped.normalized.indexOf(needle,at);if(i<0)break;
    const a=mapped.offsets[i],b=mapped.offsets[Math.min(i+needle.length,mapped.offsets.length-1)];
    if(b>a)found.push({from:a,to:b});
    at=i+Math.max(1,needle.length);
  }
  return found;
}
function searchReadableOcrLine(line){
  const s=String(line||'').trim();if(s.length<3||s.length>330)return false;
  const alpha=(s.match(/\p{L}/gu)||[]).length;
  const chars=[...s].filter(ch=>!(/\s/u).test(ch)).length;
  const words=s.split(/\s+/).filter(Boolean);
  const singles=words.filter(w=>/^\p{L}$/u.test(w)).length;
  const odd=(s.match(/[=<>()[\]{}|^~_\d»«]/g)||[]).length;
  return alpha>=3 && alpha/Math.max(1,chars)>.63 && odd/Math.max(1,chars)<.12 && (words.length<5||singles/words.length<.38);
}
function searchBuildContext(text,query,kind='Texto',maxPerPage=3){
  const original=String(text||'');if(!original.trim())return [];
  const hits=[];const matches=searchFindOffsets(original,query,Math.max(8,maxPerPage*6));
  for(const match of matches){
    if(hits.length>=maxPerPage)break;
    let from,to,raw='';
    if(kind==='OCR'){

      const ls=original.lastIndexOf('\n',match.from-1),le=original.indexOf('\n',match.to);
      from=ls<0?0:ls+1;to=le<0?original.length:le;
      const line=original.slice(from,to).trim();
      if(!searchReadableOcrLine(line)){
        hits.push({valid:false,text:'',from:0,to:0});continue;
      }

      const local=Math.max(0,match.from-from);let a=0,b=to-from;
      if(b>230){a=Math.max(0,local-90);b=Math.min(to-from,local+(match.to-match.from)+125)}
      from+=a;to=from+(b-a);
    }else{
      from=Math.max(0,match.from-105);to=Math.min(original.length,match.to+145);
      const left=original.slice(from,match.from);
      const boundary=Math.max(left.lastIndexOf('. '),left.lastIndexOf('! '),left.lastIndexOf('? '),left.lastIndexOf('\n'));
      if(boundary>=0&&match.from-(from+boundary)<95)from+=boundary+(left[boundary]==='\n'?1:2);
      const right=original.slice(match.to,to);const end=right.search(/[.!?](?:\s|$)|\n/);
      if(end>=16)to=match.to+end+1;
    }
    const prefix=(from>0&&original.slice(0,from).trim()?'… ':'');
    const suffix=(to<original.length&&original.slice(to).trim()?' …':'');
    const before=(prefix+original.slice(from,match.from)).replace(/\s+/g,' ');
    const found=original.slice(match.from,match.to);
    const after=(original.slice(match.to,to)+suffix).replace(/\s+/g,' ');
    const full=(before+found+after).trim();

    const valid=kind!=='OCR'||searchReadableOcrLine(full.replace(/[.…]/g,''));
    hits.push({valid,before,found,after});
  }
  return hits;
}
function searchSnippet(text,query){
  const candidate=searchBuildContext(text,query,'Texto',1)[0];
  return candidate?(candidate.before+candidate.found+candidate.after):'';
}
function renderSearchExcerpt(host,hit,query){
  host.replaceChildren();
  if(hit.valid===false){
    const p=document.createElement('span');p.textContent=`Possível ocorrência de “${query}”. O reconhecimento não gerou um trecho legível. Abra a página para conferir.`;
    host.append(p);return;
  }
  host.append(document.createTextNode(hit.before||''));
  const mark=document.createElement('mark');mark.textContent=hit.found||query;
  host.append(mark,document.createTextNode(hit.after||''));
}
function searchPageOrder(total,current,mode){
  const chosen=[],seen=new Set(),max=mode==='near'?Math.min(total,12):total;
  for(let k=0;chosen.length<max&&k<=total;k++){
    for(const i of k===0?[current]:[current+k,current-k]){
      if(i>=0&&i<total&&!seen.has(i)){seen.add(i);chosen.push(i);if(chosen.length===max)break}
    }
  }return chosen;
}



function createIncrementalSearchIndex(pageIndex, contextBuilder=searchBuildContext){
  let term='', token='', revision=0, hitsRevision=0;
  let memoOrder=null, memoRevision=-1, memoHits=[];
  const pageHits=new Map();
  const metrics={pageScans:0,listBuilds:0};
  function configure(query,cacheToken){
    const t=String(query||'').trim(),tok=String(cacheToken||'');
    if(term!==t||token!==tok){term=t;token=tok;revision++;hitsRevision++;pageHits.clear()}
    return revision;
  }
  function invalidate(page){pageHits.delete(page);hitsRevision++}
  function hitsForPage(i){
    if(pageHits.has(i))return pageHits.get(i);
    metrics.pageScans++;
    const rows=[];
    if(searchNormalize(term).length>=2){
      for(const [kind,txt] of [['Texto',pageIndex.get(`pdf||${i}`)||''],['OCR',pageIndex.get(`ocr|${token}|${i}`)||'']]){
        const snippets=contextBuilder(txt,term,kind,3);
        if(!snippets.length)continue;
        for(let j=0;j<snippets.length;j++)rows.push({i,type:kind,context:snippets[j],n:j+1});
        break;
      }
    }
    pageHits.set(i,rows);return rows;
  }
  function list(indices){
    if(indices===memoOrder&&hitsRevision===memoRevision)return memoHits;
    const all=[];for(const i of indices)all.push(...hitsForPage(i));
    metrics.listBuilds++;
    memoOrder=indices;memoRevision=hitsRevision;memoHits=all;
    return all;
  }
  function clear(){pageHits.clear();hitsRevision++}
  return {configure,invalidate,list,hitsForPage,metrics,clear};
}
$('#mFind').onclick=()=>{
  if(!cur)return;
  cancelCombinedSearch();
  const reader=cur,profile=user,book=reader.meta,bookKey=searchBookKey(profile,book);
  const isPdf=reader.type==='pdf',imageOnly=reader.type==='comic'||reader.type==='cbz';
  const pageable=!!(reader.pages&&(isPdf||imageOnly)),total=reader.n||0;

  const pageIndex=new Map(searchSessionIndex.get(bookKey)||[]);
  let indexEpoch=0;
  const snapshotEpoch=indexEpoch;
  const snapshotPromise=searchBookRecords(bookKey).then(records=>{
    if(indexEpoch!==snapshotEpoch||cur!==reader)return;
    for(const row of records){try{
      const [key,kind,lang,i]=JSON.parse(row.key);if(key!==bookKey||!Number.isInteger(i))continue;
      pageIndex.set(`${kind}|${lang}|${i}`,row.text??'');

      if(kind==='ocr'&&!lang.includes('@'))pageIndex.set(`ocr|${lang}@fast|${i}`,row.text??'');
    }catch{}}
    for(const [k,v] of searchSessionIndex.get(bookKey)||[])pageIndex.set(k,v);
  });
  sheet('Pesquisar no livro',s=>{
    s.classList.add('search-rapida','search-ocr','search-contextual');
    const body=document.createElement('div');body.className='fastsearch-body';
    const subtitle=document.createElement('p');subtitle.className='fastsearch-subtitle';
    subtitle.textContent=pageable?'Trechos com contexto · clique em um resultado para ir à página.':'Pesquise palavras e frases com contexto.';
    const form=document.createElement('form');form.className='fastsearch-form';form.style.display='contents';form.autocomplete='off';
    const bar=document.createElement('label');bar.className='fastsearch-bar';
    bar.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.5 4.5"/></svg>';
    const query=document.createElement('input');query.type='search';query.required=true;query.minLength=2;query.placeholder='Buscar uma palavra, fala ou frase…';query.setAttribute('aria-label','Texto a pesquisar');
    const keyHint=document.createElement('span');keyHint.className='fastsearch-kbd';keyHint.textContent='ENTER';bar.append(query,keyHint);
    form.append(bar);
    let near=null,all=null,ocr=null,language=null,quality=null,force=null;
    if(pageable){
      const modes=document.createElement('div');modes.className='fastsearch-seg';modes.setAttribute('role','group');modes.setAttribute('aria-label','Área da pesquisa');
      for(const [name,sub,value] of [['Perto de onde parei','Até 12 páginas · mais rápido','near'],['Livro inteiro','Resultados progressivos','all']]){
        const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='fastsearchscope';radio.value=value;radio.checked=value==='near';
        const bold=document.createElement('strong');bold.textContent=name;const small=document.createElement('span');small.textContent=sub;
        label.append(radio,bold,small);modes.append(label);if(value==='near')near=radio;else all=radio;
      }form.append(modes);
      const advanced=document.createElement('details');advanced.className='fastsearch-extras';
      const summary=document.createElement('summary');summary.textContent='Opções de OCR · idiomas e qualidade';advanced.append(summary);
      const wrap=document.createElement('div');wrap.className='fastsearch-extra-content';
      const check=document.createElement('label');check.className='fastsearch-toggle';
      ocr=document.createElement('input');ocr.type='checkbox';ocr.checked=true;
      const checkLabel=document.createElement('span');checkLabel.textContent='Reconhecer texto nas imagens (mangás, HQs e PDFs digitalizados)';check.append(ocr,checkLabel);wrap.append(check);
      if(isPdf){
        const fl=document.createElement('label');fl.className='fastsearch-toggle';force=document.createElement('input');force.type='checkbox';
        const lab=document.createElement('span');lab.textContent='Usar OCR mesmo nas páginas com texto selecionável';fl.append(force,lab);wrap.append(fl);
      }
      const fields=document.createElement('div');fields.className='fastsearch-fields';
      const langF=document.createElement('label');langF.className='fastsearch-field';langF.textContent='Idioma dos balões';
      language=document.createElement('select');language.innerHTML='<option value="por">Português · mais leve</option><option value="por+eng">Português + inglês</option><option value="eng">Inglês</option><option value="jpn">Japonês</option><option value="jpn_vert">Japonês vertical</option>';
      langF.append(language);
      const qualF=document.createElement('label');qualF.className='fastsearch-field';qualF.textContent='Processamento de imagens';
      quality=document.createElement('select');quality.innerHTML='<option value="fast">Rápido · resolução reduzida</option><option value="detailed">Detalhado · letras pequenas</option>';
      qualF.append(quality);fields.append(langF,qualF);wrap.append(fields);
      const notice=document.createElement('p');notice.className='fastsearch-options-note';notice.textContent='Primeiro uso: requer internet para baixar o OCR. Páginas reconhecidas ficam no dispositivo e são reutilizadas. A busca completa em quadrinhos grandes pode levar minutos.';
      wrap.append(notice);advanced.append(wrap);form.append(advanced);
      ocr.onchange=()=>{language.disabled=quality.disabled=!ocr.checked;if(force)force.disabled=!ocr.checked;refreshCached()};
      language.onchange=quality.onchange=()=>refreshCached();
      near.onchange=all.onchange=()=>refreshCached();
    }
    const actions=document.createElement('div');actions.className='fastsearch-actions';
    const run=document.createElement('button');run.type='submit';run.className='fastsearch-btn fastsearch-btn-primary';run.textContent='Pesquisar agora';
    const stop=document.createElement('button');stop.type='button';stop.className='fastsearch-btn fastsearch-btn-ghost';stop.textContent='Parar';stop.hidden=true;
    const clear=document.createElement('button');clear.type='button';clear.className='fastsearch-btn fastsearch-btn-ghost';clear.textContent='Limpar índice';
    actions.append(run,stop,clear);form.append(actions);
    const meta=document.createElement('div');meta.className='fastsearch-meta';
    const indexCount=document.createElement('span');indexCount.className='fastsearch-pill';indexCount.textContent='Verificando índice…';
    const matchesBadge=document.createElement('span');matchesBadge.className='fastsearch-pill fastsearch-pill--good';matchesBadge.textContent='0 resultados';meta.append(indexCount,matchesBadge);
    const progress=document.createElement('div');progress.className='fastsearch-progress';progress.hidden=true;
    const progressHead=document.createElement('div');progressHead.className='fastsearch-progress-line';
    const state=document.createElement('strong');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
    const steps=document.createElement('span');steps.textContent='0%';progressHead.append(state,steps);
    const progBar=document.createElement('progress');progBar.max=100;progBar.value=0;
    const eta=document.createElement('small');progress.append(progressHead,progBar,eta);
    const section=document.createElement('div');section.className='fastsearch-section';
    const summary=document.createElement('div');summary.className='fastsearch-summary';summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');summary.textContent='O índice local responde enquanto você digita; só páginas novas precisam de processamento.';
    const head=document.createElement('div');head.className='fastsearch-section-heading';
    const title=document.createElement('h3');title.textContent='Trechos encontrados';
    const note=document.createElement('span');note.textContent='Contexto anterior e posterior à palavra';head.append(title,note);
    const results=document.createElement('div');results.className='fastsearch-results';results.setAttribute('aria-label','Resultados encontrados');
    const foot=document.createElement('p');foot.className='fastsearch-foot';foot.textContent='Trechos OCR não são transcrições verificadas. Confirme cada fala na página original; nada é enviado ao Supabase.';
    section.append(head,results);body.append(subtitle,form,meta,summary,progress,section,foot);s.append(body);
    const cachedHits=createIncrementalSearchIndex(pageIndex);
    let initialized=false,debounce=null,queried=false,completed=false;
    const isVisible=()=>cur===reader&&user===profile&&!s.hidden;
    const chosenMode=()=>all?.checked?'all':'near';
    const chosenLang=()=>language?.value||'por';
    const cacheOcrKey=()=>`${chosenLang()}@${quality?.value||'fast'}`;
    let lastOrderKey='',lastOrder=[];
    const order=()=>{
      if(!pageable)return [];
      const key=`${total}|${reader.i||0}|${chosenMode()}`;
      if(key!==lastOrderKey){lastOrder=searchPageOrder(total,reader.i||0,chosenMode());lastOrderKey=key}
      return lastOrder;
    };
    function updateIndexBadge(){
      if(!pageable){indexCount.textContent='Pesquisa textual';return}
      const token=cacheOcrKey(),indexed=new Set();
      for(const i of order())if(pageIndex.has(`ocr|${token}|${i}`)||pageIndex.has(`pdf||${i}`)&&String(pageIndex.get(`pdf||${i}`)).trim().length>=45)indexed.add(i);
      indexCount.textContent=`${indexed.size} / ${order().length} páginas com índice`;
    }
    function makeEmpty(message,detail){
      results.replaceChildren();const e=document.createElement('div');e.className='fastsearch-empty';
      const strong=document.createElement('strong');strong.textContent=message;
      const small=document.createElement('span');small.textContent=detail;e.append(strong,small);results.append(e);
    }
    function foundPages(term){
      if(searchNormalize(term).length<2)return [];
      cachedHits.configure(term,cacheOcrKey());
      return cachedHits.list(order());
    }
    function renderCached(term,precomputed){
      if(!pageable)return;
      const found=precomputed||foundPages(term),limit=100;
      const frag=document.createDocumentFragment();
      for(const hit of found.slice(0,limit)){
        const btn=document.createElement('button');btn.type='button';btn.className='fastsearch-result';
        btn.setAttribute('aria-label',`Abrir página ${hit.i+1}, ocorrência ${hit.n}`);
        const h=document.createElement('div');h.className='fastsearch-result-head';
        const number=document.createElement('strong');number.textContent=`Página ${hit.i+1}${hit.n>1?' · trecho '+hit.n:''}`;
        const source=document.createElement('span');source.textContent=hit.type==='OCR'?'OCR · verificar':'Texto selecionável';
        h.append(number,source);
        const excerpt=document.createElement('div');excerpt.className='fastsearch-excerpt';
        renderSearchExcerpt(excerpt,hit.context,term);
        const contextLabel=document.createElement('div');contextLabel.className='fastsearch-context-note';
        contextLabel.textContent=hit.type==='OCR'?'Trecho reconhecido automaticamente · confirme na imagem':'Trecho original · abrir na página';
        btn.append(h,excerpt,contextLabel);
        btn.onclick=()=>{if(!isVisible())return;cancelCombinedSearch();reader.goto(hit.i);s.hidden=true};
        frag.append(btn);
      }
      results.replaceChildren(frag);
      matchesBadge.textContent=`${found.length} ${found.length===1?'trecho':'trechos'}`;
      if(!found.length)makeEmpty(term.length>=2?'Nenhuma ocorrência no índice atual':'Digite uma palavra ou frase',
        term.length>=2?'Pesquisar agora analisa as páginas que ainda não têm índice.':'Os trechos aparecerão aqui com contexto antes e depois da palavra pesquisada.');
      updateIndexBadge();
      note.textContent=found.length>=limit?`Exibindo os primeiros ${limit} trechos`:'Toque em um trecho para abrir a página';
    }
    function refreshCached(){
      clearTimeout(debounce);debounce=setTimeout(()=>{if(!isVisible())return;renderCached(query.value.trim())},80);
    }
    query.addEventListener('input',()=>{
      if(combinedSearchJob){cancelCombinedSearch();setBusy(false);summary.textContent='Busca interrompida para alterar a consulta.'}
      completed=false;queried=false;refreshCached();
    });
    function setBusy(yes){run.disabled=yes;stop.hidden=!yes;clear.disabled=yes;progress.hidden=!yes;
      if(yes){progress.style.display='grid'}else{progress.style.display='none'}
    }
    const close=s.querySelector('h2 button');if(close)close.addEventListener('click',()=>{cancelCombinedSearch();clearTimeout(debounce)});
    s.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelCombinedSearch();s.hidden=true}});
    stop.onclick=()=>{cancelCombinedSearch();setBusy(false);summary.textContent='Interrompido. Os resultados já reconhecidos permanecem salvos.';renderCached(query.value.trim())};
    clear.onclick=async()=>{
      if(combinedSearchJob)return;clear.disabled=true;indexEpoch++;await purgeBookSearchCache(profile,book.id);pageIndex.clear();cachedHits.clear();
      renderCached(query.value.trim());summary.textContent='Índice deste livro apagado. PDFs, anotações e progresso preservados.';clear.disabled=false;
    };
    snapshotPromise.then(()=>{initialized=true;cachedHits.clear();if(isVisible())renderCached(query.value.trim())});
    form.onsubmit=async e=>{
      e.preventDefault();const term=query.value.trim();if(term.length<2){query.focus();return}
      cancelCombinedSearch();await snapshotPromise;if(!isVisible())return;
      const job={reader,profile,book,bookKey,cancelled:false,worker:null,ocrProgress:null};combinedSearchJob=job;
      const isLive=()=>!job.cancelled&&combinedSearchJob===job&&isVisible();
      queried=true;completed=false;setBusy(true);progress.hidden=false;progBar.value=0;steps.textContent='0%';summary.textContent='Analisando as páginas solicitadas…';
      state.textContent='Buscando nos dados existentes…';eta.textContent='Resultados serão exibidos à medida que forem encontrados.';
      let processed=0,recognized=0,failed=0,ocrUnavailable=false,previousHitCount=-1,ocrDurations=[];
      const currentMode=chosenMode(),chosenQuality=quality?.value||'fast';
      const key=cacheOcrKey(),lng=chosenLang(),includeOCR=!!ocr?.checked;
      try{
        if(!pageable){
          if(!reader.find)throw Error('Este formato não oferece busca textual.');
          const list=await reader.find(term);if(!isLive())return;
          results.replaceChildren();const frag=document.createDocumentFragment();
          for(const item of list.slice(0,100)){
            const b=document.createElement('button');b.type='button';b.className='fastsearch-result';b.textContent=item.label;
            b.onclick=()=>{if(!isVisible())return;item.go();s.hidden=true};frag.append(b)
          }
          results.append(frag);matchesBadge.textContent=`${list.length} resultados`;
          if(!list.length)makeEmpty('Nada encontrado','Tente outra palavra ou frase.');
          summary.textContent='Busca concluída';return;
        }
        const indices=searchPageOrder(total,reader.i||0,currentMode);
        for(const i of indices){
          if(!isLive())return;

          try{
            let direct=pageIndex.get(`pdf||${i}`);
            if(isPdf&&direct===undefined){
              try{
                const page=await reader.searchPdfPage(i);if(!isLive())return;
                const txt=await page.getTextContent();if(!isLive())return;
                direct=txt.items.map(item=>item.str||'').join(' ').replace(/\s+/g,' ').trim();
                pageIndex.set(`pdf||${i}`,direct);cachedHits.invalidate(i);
                await saveIndexedSearchText(bookKey,'pdf','',i,direct);
              }catch(error){
                if(!isLive())return;
                console.debug('Camada de texto indisponível na página',i+1,error);
                if(!includeOCR)throw error;
              }
            }
            const alreadyOcr=pageIndex.has(`ocr|${key}|${i}`);
            const shouldOcr=includeOCR&&!ocrUnavailable&&(imageOnly||!!force?.checked||String(direct||'').replace(/\s+/g,'').length<45);
            if(shouldOcr&&!alreadyOcr){
              state.textContent=`Reconhecendo diálogos · página ${i+1}`;
              const begun=performance.now();
              if(!job.worker){
                try{await makeOcrWorker(job,lng)}
                catch(error){ocrUnavailable=true;throw error}
              }
              if(!isLive())return;
              job.ocrProgress=pct=>{if(isLive())eta.textContent=`Página ${i+1} · OCR ${pct}% · reconhecendo localmente.`};
              let canvas;
              try{
                canvas=await reader.searchOcrImage(i,chosenQuality);
                if(!isLive())return;
                const result=await job.worker.recognize(canvas);
                if(!isLive())return;
                const text=result?.data?.text||'';
                pageIndex.set(`ocr|${key}|${i}`,text);cachedHits.invalidate(i);
                await saveIndexedSearchText(bookKey,'ocr',key,i,text);
                recognized++;
                ocrDurations.push((performance.now()-begun)/1000);
                if(ocrDurations.length>6)ocrDurations.shift();
              }finally{if(canvas){canvas.width=canvas.height=0}job.ocrProgress=null}
            }
          }catch(error){
            if(!isLive())return;
            failed++;
            console.warn('Pesquisa: página não processada',i+1,error);

            if(ocrUnavailable){
              eta.textContent='OCR indisponível nesta sessão. Os trechos já indexados continuam pesquisáveis.';
            }
          }
          if(!isLive())return;
          processed++;const pct=Math.round(processed/indices.length*100);progBar.value=pct;steps.textContent=pct+'%';
          const shouldPaint=processed%4===0||processed===indices.length||cachedHits.metrics.pageScans===0;
          const found=shouldPaint?foundPages(term):null;
          const hits=found?found.length:null;
          state.textContent=`${processed}/${indices.length} páginas analisadas${hits===null?'':` · ${hits} ${hits===1?'resultado':'resultados'}`}`;
          summary.textContent=`${processed} de ${indices.length} páginas verificadas. Resultados disponíveis abaixo.`;
          if(ocrDurations.length){
            const average=ocrDurations.reduce((a,b)=>a+b,0)/ocrDurations.length;
            eta.textContent=`OCR local em andamento · faltam ${indices.length-processed} páginas. Resultados encontrados já podem ser abertos.`;
          }else{eta.textContent='Usando o índice salvo quando disponível · você pode interromper a qualquer momento.'}
          if(found&&(hits!==previousHitCount||processed===indices.length||processed%4===0)){
            renderCached(term,found);previousHitCount=hits;
          }
          if(processed%3===0)await searchYield();
        }
        if(!isLive())return;completed=true;
        state.textContent=`${failed?'Pesquisa parcial':'Pesquisa concluída'} · ${processed} páginas verificadas, ${recognized} reconhecidas agora por OCR.`;
        summary.textContent=`${processed} páginas verificadas · ${recognized} páginas indexadas agora${failed?' · '+failed+' falhas (tente novamente)':''}.`;
        eta.textContent=ocrUnavailable?'OCR indisponível; confira internet e as bibliotecas. Os resultados existentes continuam acessíveis.':
          (failed?'Algumas páginas falharam. Uma nova pesquisa tentará processá-las.':'As próximas pesquisas aproveitam o índice local.');
      }catch(err){if(isLive()){console.error('Busca combinada',err);state.textContent='Não foi possível concluir a pesquisa: '+(err?.message||err);summary.textContent=state.textContent;eta.textContent='Confira a conexão para a primeira carga do OCR ou tente o modo Rápido.'}}
      finally{
        if(job.cancelled)return;
        relaxSearchWorker(job);
        if(combinedSearchJob===job){combinedSearchJob=null;setBusy(false);renderCached(term)}
      }
    };
    setBusy(false);setTimeout(()=>query.focus(),60);
  });
};
