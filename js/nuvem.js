







const CLOUD_DEFAULT_CONFIG=Object.freeze({
  url:'https://kfbuhaefwumwbbroovtv.supabase.co',
  key:'sb_publishable_gM0JkJOy6q6iboPifCnDTw_j2fL8kH9'
});
const cloudConfig=()=>CLOUD_DEFAULT_CONFIG;

try{localStorage.removeItem('leitor:cloud-config')}catch{}
let cloudSession=null,cloudTimer=null,cloudWorking=false,cloudLastError='',cloudConflictPending=false;
const cloudLinkKey=()=>`leitor:cloud-linked:${user}`;
const cloudAutoKey=()=>`leitor:cloud-auto:${user}`;
const cloudSessionKey=()=>`leitor:cloud-session:${user}`;
const cloudLastKey=()=>`leitor:cloud-last:${user}`;
const cloudRevisionKey=()=>`leitor:cloud-revision:${user}`;
const cloudFingerprintKey=()=>`leitor:cloud-fingerprint:${user}`;




const cloudPendingKey=()=>`leitor:cloud-pending:${user}`;
const cloudConflictKey=()=>`leitor:cloud-conflict:${user}`;
let cloudMemoryPending=null;
function cloudPending(){
  if(!user)return null;
  try{
    const v=JSON.parse(localStorage.getItem(cloudPendingKey())||'null');
    return v&&Number.isInteger(v.seq)&&v.seq>0?v:(cloudMemoryPending?.user===user?cloudMemoryPending:null);
  }catch{return cloudMemoryPending?.user===user?cloudMemoryPending:null}
}
let cloudNotifyTimer=null;
function cloudNotify(){
  if(cloudNotifyTimer!==null)return;
  cloudNotifyTimer=setTimeout(()=>{
    cloudNotifyTimer=null;
    if(typeof updateLECTORShortcuts==='function')updateLECTORShortcuts();
    document.querySelectorAll('[data-cloud-live]').forEach(node=>{
      const state=cloudState();node.textContent=state.label;node.dataset.state=state.kind;
    });
  },80);
}
function cloudMarkDirty(reason='metadados'){
  if(!user||!lsGet(cloudLinkKey()))return;
  const current=cloudPending(),value={seq:(current?.seq||0)+1,at:current?.at||Date.now(),reason:String(reason).slice(0,40)};
  try{localStorage.setItem(cloudPendingKey(),JSON.stringify(value));cloudMemoryPending=null}
  catch{cloudMemoryPending={...value,user};cloudLastError='Não foi possível persistir o aviso de alterações pendentes.'}
  cloudNotify();
}
function cloudClearPending(seq){
  const current=cloudPending();if(!current||current.seq!==seq)return false;
  try{localStorage.removeItem(cloudPendingKey());cloudMemoryPending=null;cloudNotify();return true}
  catch{return false}
}
function cloudSetConflict(active){
  cloudConflictPending=!!active;
  try{if(active)localStorage.setItem(cloudConflictKey(),'true');else localStorage.removeItem(cloudConflictKey())}catch{}
  cloudNotify();
}
function cloudHasConflict(){
  if(cloudConflictPending)return true;
  try{return localStorage.getItem(cloudConflictKey())==='true'}catch{return false}
}
function cloudState(){
  const pending=!!cloudPending(),linked=user?lsGet(cloudLinkKey()):null;
  const authenticated=!!(cloudSession?.user?.id&&cloudSession.localUser===user);
  if(!user)return {kind:'local',label:'Escolha um perfil'};
  if(!navigator.onLine)return {kind:'offline',label:pending?'Offline · alterações pendentes':'Sem internet'};
  if(!authenticated)return {kind:'local',label:pending?'Alterações aguardando login':'Modo local'};
  if(cloudWorking)return {kind:'working',label:'Sincronizando…'};
  if(linked!==cloudSession.user.id)return {kind:'connected',label:'Conta conectada · não vinculada'};
  if(cloudHasConflict())return {kind:'conflict',label:'Conflito · revisão necessária'};
  if(cloudLastError)return {kind:'error',label:pending?'Falha · alterações pendentes':'Falha na sincronização'};
  if(pending)return {kind:'pending',label:'Alterações pendentes'};
  if(lsGet(cloudLastKey())&&lsGet(cloudRevisionKey()))return {kind:'synced',label:'Sincronizado'};
  return {kind:'connected',label:'Conta conectada · sincronização pendente'};
}
window.addEventListener('offline',()=>cloudNotify());
window.addEventListener('storage',event=>{
  if(!user||!event.key)return;
  if([cloudPendingKey(),cloudConflictKey(),cloudLastKey(),cloudRevisionKey()].includes(event.key))cloudNotify();
});

function cloudStopTimer(){if(cloudTimer!==null){clearInterval(cloudTimer);cloudTimer=null}}
function cloudSaveSession(){
  if(!user)return;
  try{if(cloudSession)sessionStorage.setItem(cloudSessionKey(),JSON.stringify(cloudSession));
      else sessionStorage.removeItem(cloudSessionKey())}catch{}
}
function cloudLoadSession(){
  cloudSession=null;
  if(!user)return;
  try{
    const s=JSON.parse(sessionStorage.getItem(cloudSessionKey())||'null');
    if(s?.localUser===user&&s?.access_token&&s?.refresh_token&&s?.user?.id&&s?.endpoint===cloudConfig()?.url)cloudSession=s;
  }catch{}
  cloudConflictPending=!!(user&&lsGet(cloudConflictKey()));
  if(cloudSession&&lsGet(cloudLinkKey())===cloudSession.user.id&&lsGet(cloudAutoKey())===true)cloudStartTimer();
  cloudNotify();
}
function cloudStartTimer(){
  cloudStopTimer();
  if(!cloudSession||lsGet(cloudLinkKey())!==cloudSession.user.id||lsGet(cloudAutoKey())!==true)return;
  cloudTimer=setInterval(()=>{
    if(navigator.onLine&&!cloudWorking&&!cloudHasConflict()&&user===cloudSession?.localUser&&$('#reader').hidden){
      cloudSync(true).catch(e=>{cloudLastError=e.message;console.warn('Sincronização automática:',e)})
    }
  },300000);
}
window.addEventListener('online',()=>{
  if(cloudSession&&lsGet(cloudLinkKey())===cloudSession.user.id&&lsGet(cloudAutoKey())===true&&!cloudHasConflict()){
    cloudSync(true).catch(e=>console.warn('Sincronização ao reconectar:',e));
  }
});
function cloudCredentials(){
  const c=cloudConfig();
  if(!c||typeof c.url!=='string'||typeof c.key!=='string')throw Error('Configure URL e chave publicável primeiro.');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)&&!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(c.url))throw Error('Use a URL HTTPS oficial do projeto Supabase.');
  if(!/^(sb_publishable_[\w-]+|eyJ[\w.\-]+)$/.test(c.key))throw Error('Use a chave publicável ou anon, nunca service_role/secret.');
  return c;
}
async function cloudRequest(method,path,body=null,auth=true,retry=true,extras={}){
  const cfg=cloudCredentials();
  if(auth){
    if(!cloudSession||cloudSession.localUser!==user)throw Error('Faça login na conta online.');
    if(Date.now()>Number(cloudSession.expires_at||0)*1000-60000&&retry)await cloudRefresh();
  }
  const headers={'apikey':cfg.key,'Accept':'application/json',...(body===null?{}:{'Content-Type':'application/json'}),...extras};
  if(auth)headers.Authorization='Bearer '+cloudSession.access_token;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  let response;
  try{response=await fetch(cfg.url+path,{method,headers,body:body===null?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store'})}
  catch(e){throw Error(e.name==='AbortError'?'Servidor não respondeu dentro do tempo limite.':'Sem conexão com o Supabase. '+e.message)}
  finally{clearTimeout(timeout)}
  if(response.status===401&&auth&&retry){await cloudRefresh();return cloudRequest(method,path,body,true,false,extras)}
  const raw=await response.text();let result=null;
  try{result=raw?JSON.parse(raw):null}catch{result=null}
  if(!response.ok){const msg=result?.msg||result?.message||result?.error_description||result?.error||('HTTP '+response.status);
    const err=new Error(String(msg).slice(0,250));err.status=response.status;err.code=result?.code;throw err}
  return result;
}
async function cloudRefresh(){
  const s=cloudSession,cfg=cloudCredentials();if(!s?.refresh_token)throw Error('Sessão online expirada. Entre novamente.');
  const response=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:s.refresh_token}),cache:'no-store'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token){cloudSession=null;cloudSaveSession();throw Error('Sessão expirada. Entre novamente no Supabase.')}
  cloudSession={...s,...data,localUser:user,endpoint:cfg.url,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
  cloudSaveSession();
}
async function cloudAuth(mode,email,password){
  const cfg=cloudCredentials();
  if(!navigator.onLine)throw Error('É preciso estar online para criar conta ou entrar.');
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<6)throw Error('Informe e-mail válido e senha de pelo menos 6 caracteres.');
  const path=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  const data=await cloudRequest('POST',path,{email,password},false);
  if(!data?.access_token||!data?.refresh_token){
    toast('Conta criada. Verifique seu e-mail e confirme o cadastro antes de entrar.');return false;
  }
  if(!data.user?.id)throw Error('Servidor não retornou uma identidade válida.');
  const linked=lsGet(cloudLinkKey());
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('leitor:cloud-linked:')&&k!==cloudLinkKey()&&lsGet(k)===data.user.id)throw Error('Esta conta online já está vinculada a outro perfil local neste aparelho.');}
  if(linked&&linked!==data.user.id)throw Error('Este perfil local está vinculado a outra conta. Desvincule-o antes de mudar de conta.');
  cloudSession={...data,localUser:user,endpoint:cfg.url,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
  cloudSaveSession();cloudLastError='';cloudNotify();return true;
}
async function cloudLogout(){
  try{if(cloudSession&&navigator.onLine)await cloudRequest('POST','/auth/v1/logout',{},true)}catch{}
  cloudStopTimer();cloudSession=null;cloudSaveSession();cloudNotify();
}
const cloudStr=(v,n=500)=>typeof v==='string'?v.slice(0,n):'';
const cloudNum=(v,defaultValue=0)=>Number.isFinite(Number(v))?Number(v):defaultValue;
const cloudArr=(v,max=200)=>Array.isArray(v)?v.slice(0,max):[];
const cloudKey=b=>[cloudStr(b.name||b.title,250).trim().toLocaleLowerCase('pt-BR'),cloudNum(b.size),cloudStr(b.type,12)].join('|');
function cloudBookExport(b){
  return {
    id:cloudStr(b.cloudId||b.id,120),name:cloudStr(b.name||'',300),title:cloudStr(b.title||'',400),
    type:cloudStr(b.type,12),size:Math.max(0,cloudNum(b.size)),pages:Math.max(0,cloudNum(b.pages)),
    author:cloudStr(b.author||'',150),series:cloudStr(b.series||'',150),genre:cloudStr(b.genre||'',100),
    description:cloudStr(b.description||'',400),volume:cloudNum(b.volume,null),
    f:Math.min(1,Math.max(0,cloudNum(b.f))),p:b.p??null,last:Math.max(0,cloudNum(b.last)),
    fav:!!b.fav,sh:cloudArr(b.sh,100).filter(x=>typeof x==='string').map(x=>x.slice(0,100)),
    bm:cloudArr(b.bm,100),hl:cloudArr(b.hl,75),readPrefs:b.readPrefs&&typeof b.readPrefs==='object'?b.readPrefs:null,
    updated:Math.max(0,cloudNum(b.syncUpdatedAt||b.last))
  };
}
async function cloudSnapshot(){
  const bs=await userBooks();if(bs.length>1500)throw Error('A sincronização suporta até 1.500 livros por perfil nesta versão.');
  const h=hist(),ah=readAnalytics(),dates=Object.keys(h).sort().slice(-365);
  const history=Object.fromEntries(dates.map(d=>[d,Math.max(0,cloudNum(h[d]))]));
  const adays=Object.fromEntries(Object.entries(ah.days||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-180));
  const prefs=Object.fromEntries(Object.keys(DEF).filter(k=>!['lt'].includes(k)).map(k=>[k,S[k]]));
  return {schema:1,books:bs.map(cloudBookExport),shelves:shelves().slice(0,100),hist:history,
    analytics:{v:1,days:adays,sessions:cloudArr(ah.sessions,400).slice(-100)},
    vocab:cloudArr(vocab(),500),settings:prefs,
    updated:new Date().toISOString()};
}
function cloudValidateSnapshot(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||data.schema!==1||!Array.isArray(data.books)||data.books.length>1500||!Array.isArray(data.shelves)||data.shelves.length>100)throw Error('Formato de dados da nuvem incompatível.');
  const ids=new Set();
  for(const b of data.books){
    if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[\w.-]{1,120}$/.test(b.id)||ids.has(b.id)||typeof b.title!=='string'||b.title.length>400||!['pdf','epub','comic','cbz','txt'].includes(b.type)||!Number.isFinite(b.size)||b.size<0||!Number.isFinite(b.f)||b.f<0||b.f>1)throw Error('O catálogo remoto contém registros inválidos.');
    ids.add(b.id);
  }
  if(data.hist&&(!Object.keys(data.hist).every(k=>/^\d{4}-\d{2}-\d{2}$/.test(k))||Object.keys(data.hist).length>3650))throw Error('Histórico remoto inválido.');
  return data;
}
function cloudMergeBook(local,remote){
  const localMeta=cloudBookExport(local),remoteNewer=Number(remote.updated||0)>Number(localMeta.updated||0);
  const chosen=remoteNewer?remote:localMeta;
  const merged={...local,...chosen,id:local.id,user,cloudId:remote.id};

  const advanced=Number(remote.last||0)>Number(local.last||0);
  merged.f=Math.max(Number(local.f||0),Number(remote.f||0));
  merged.p=advanced?remote.p:local.p;
  merged.last=Math.max(Number(local.last||0),Number(remote.last||0));
  merged.sh=[...new Set([...cloudArr(local.sh),...cloudArr(remote.sh)])].slice(0,100);
  merged.fav=!!(local.fav||remote.fav);
  merged.bm=[...new Map([...cloudArr(local.bm),...cloudArr(remote.bm)].map((v,i)=>[String(v?.id||JSON.stringify(v)),v])).values()].slice(0,100);
  merged.hl=[...new Map([...cloudArr(local.hl),...cloudArr(remote.hl)].map(v=>[String(v?.id||JSON.stringify(v)),v])).values()].slice(0,75);
  merged.cover=local.cover||'';merged.cloudGhost=!!local.cloudGhost;
  return merged;
}
function cloudCombine(local,remote){
  cloudValidateSnapshot(remote);
  const byId=new Map(local.books.map(b=>[b.id,b]));
  const byCloud=new Map(local.books.filter(b=>b.cloudId).map(b=>[b.cloudId,b]));
  const byFingerprint=new Map(local.books.map(b=>[cloudKey(b),b]));
  const result=new Map(local.books.map(b=>[b.id,b]));
  const idMap=new Map();
  const removed=trashTombstones();
  for(const book of remote.books){
    if(removed[book.id])continue;
    const old=byCloud.get(book.id)||byId.get(book.id)||byFingerprint.get(cloudKey(book));
    if(old){
      idMap.set(book.id,old.id);result.set(old.id,cloudMergeBook(old,book));
    }else{
      const ghost={...book,id:book.id,user,cloudId:book.id,cloudGhost:true,cover:'',added:Date.now(),n:0,spf:0};
      result.set(ghost.id,ghost);
    }
  }
  const remoteShelves=cloudArr(remote.shelves,100).filter(x=>typeof x==='string');
  const allShelves=[...new Set([...local.shelves,...remoteShelves])].slice(0,100);
  const h={...local.hist};for(const [d,v] of Object.entries(remote.hist||{}))h[d]=Math.max(cloudNum(h[d]),cloudNum(v));
  const analytics=mergeAnalytics(local.analytics,remote.analytics,idMap);
  const voc=new Map(cloudArr(remote.vocab,500).map(v=>[String(v.w||'').toLowerCase(),v]));
  for(const v of local.vocab)if(v&&v.w)voc.set(String(v.w).toLowerCase(),v);

  return {books:[...result.values()],shelves:allShelves,hist:h,analytics,vocab:[...voc.values()].slice(0,500),settings:remote.settings&&typeof remote.settings==='object'?remote.settings:local.settings};
}
async function cloudDigest(snapshot){
  const {updated,...stable}=snapshot;
  const bytes=new TextEncoder().encode(JSON.stringify(stable));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
async function cloudReadRevision(){
  const s=cloudSession;
  const rows=await cloudRequest('GET','/rest/v1/leitor_sync_state?user_id=eq.'+encodeURIComponent(s.user.id)+'&select=revision');
  return Array.isArray(rows)&&rows[0]?Number(rows[0].revision||0):0;
}
async function cloudReadRemote(){
  const s=cloudSession;
  const rows=await cloudRequest('GET','/rest/v1/leitor_sync_state?user_id=eq.'+encodeURIComponent(s.user.id)+'&select=revision,payload');
  if(!Array.isArray(rows))throw Error('Resposta do banco de dados inválida. Confira o SQL e RLS.');
  return rows[0]||{revision:0,payload:null};
}
async function cloudWriteRemote(revision,payload){
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  if(bytes.length>900000)throw Error('Metadados excedem 900 KB. Reduza notas e histórico; os livros continuam seguros localmente.');
  const uid=cloudSession.user.id;
  if(revision===0){
    await cloudRequest('POST','/rest/v1/leitor_sync_state',{user_id:uid,revision:1,payload,updated_at:new Date().toISOString()},true,true,{'Prefer':'return=representation'});
    return;
  }
  const result=await cloudRequest('PATCH','/rest/v1/leitor_sync_state?user_id=eq.'+encodeURIComponent(uid)+'&revision=eq.'+revision,
    {revision:revision+1,payload,updated_at:new Date().toISOString()},true,true,{'Prefer':'return=representation'});
  if(!Array.isArray(result)||result.length!==1){const e=new Error('Conflito de revisão; tente novamente.');e.status=409;throw e}
}
async function cloudApplyMerged(data){
  const current=await userBooks(),oldById=new Map(current.map(b=>[b.id,b]));
  const additions=[],updates=[];
  for(const b of data.books){
    const old=oldById.get(b.id);
    if(!old)additions.push(b);
    else if(JSON.stringify(cloudBookExport(old))!==JSON.stringify(cloudBookExport(b))||old.cloudId!==b.cloudId)updates.push(b);
  }
  const db=await DB.catch(()=>null);if(!db)throw Error('Banco IndexedDB indisponível. A nuvem não substituirá um armazenamento temporário.');
  if(additions.length||updates.length){
    await new Promise((resolve,reject)=>{
      const t=db.transaction(['books'],'readwrite');t.oncomplete=resolve;t.onerror=()=>reject(t.error||new Error('Falha ao restaurar catálogo'));
      t.onabort=()=>reject(t.error||new Error('Transação cancelada'));
      const store=t.objectStore('books');for(const b of [...additions,...updates])store.put(b);
    });
  }


  const changes=[
    ['leitor:shelves:'+user,data.shelves],['leitor:hist:'+user,data.hist],
    [analyticsKey(),data.analytics],['leitor:vocab:'+user,data.vocab]
  ];
  const previous=changes.map(([key])=>[key,localStorage.getItem(key)]);
  try{for(const [key,value] of changes)localStorage.setItem(key,JSON.stringify(value))}
  catch(error){
    for(const [key,value] of previous)try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}
    throw Error('Os metadados locais não puderam ser gravados. Verifique o espaço e tente novamente. '+error.message);
  }
}
async function cloudApplyRemoteSettings(){
  if(!cloudSession||lsGet(cloudLinkKey())!==cloudSession.user.id)throw Error('Vincule este perfil a uma conta online primeiro.');
  const remote=await cloudReadRemote();
  const settings=remote.payload?.settings;
  if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Não há preferências disponíveis na nuvem.');
  if(!confirm('Aplicar as preferências da nuvem neste dispositivo? Seus livros não serão afetados.'))return;
  for(const k of Object.keys(DEF)){
    if(k==='lt'||!Object.hasOwn(settings,k))continue;
    const val=settings[k];
    if(['string','number','boolean'].includes(typeof val)&&String(val).length<=100)S[k]=val;
  }
  apply();toast('Preferências da nuvem aplicadas a este aparelho.');
}
async function cloudSync(silent=false,pushSettings=false){
  if(cloudWorking)return;if(!user||!cloudSession)throw Error('Entre primeiro na sua conta online.');
  if(memMode)throw Error('O armazenamento local está temporário. Não é seguro sincronizar.');
  if(!navigator.onLine)throw Error('Sem internet. Continue lendo normalmente e sincronize depois.');
  const uid=cloudSession.user.id,localUser=user;
  const linked=lsGet(cloudLinkKey());
  if(linked&&linked!==uid)throw Error('Este perfil local está vinculado a outra conta Supabase.');
  if(!linked&&silent)return;
  if(!linked&&!confirm('Vincular este perfil local a esta conta Supabase? Serão enviados apenas metadados, estantes e progresso. Os arquivos dos livros NÃO serão enviados.'))return;
  cloudWorking=true;cloudLastError='';cloudNotify();
  const pendingAtStart=cloudPending();let acceptedRevision=null;
  try{
    const localBooks=await userBooks();
    if(localBooks.length>1500)throw Error('Há livros demais para o limite inicial de sincronização.');

    if(linked===uid&&!pushSettings&&!cloudPending()&&!cloudHasConflict()){
      const fingerprint=await cloudDigest(await cloudSnapshot());
      if(lsGet(cloudFingerprintKey())===fingerprint){
        const revision=await cloudReadRevision();
        if(revision>0&&revision===lsGet(cloudRevisionKey())){
          cloudLastError='';cloudNotify();
          if(!silent)toast('Já está sincronizado. Nenhuma alteração pendente.');
          return;
        }
      }
    }
    for(let attempt=0;attempt<3;attempt++){
      const remote=await cloudReadRemote();
      if(user!==localUser||cloudSession?.user?.id!==uid)throw Error('A conta foi alterada durante a sincronização.');


      const lastRevision=Number(lsGet(cloudRevisionKey())||0);
      const remoteRevision=Number(remote.revision||0);
      if(linked===uid&&cloudPending()&&lastRevision>0&&remoteRevision!==lastRevision&&acceptedRevision!==remoteRevision){
        cloudSetConflict(true);
        if(silent)throw Error('Alterações simultâneas detectadas. Abra Sincronização e revise antes de mesclar.');
        if(!confirm('Há alterações locais e uma revisão diferente na nuvem. Mesclar os dados agora? O LECTOR preserva os arquivos locais, o maior progresso e une marcadores/estantes; títulos e outros metadados podem exigir conferência. Cancelar mantém as alterações locais e bloqueia o envio.')){
          throw Error('Conflito mantido para revisão. Nenhum dado foi enviado por esta tentativa.');
        }
        acceptedRevision=remoteRevision;
      }
      const snapshot=await cloudSnapshot();
      const data=remote.payload?cloudCombine({
        ...snapshot,
        books:await userBooks(),shelves:shelves(),hist:hist(),analytics:readAnalytics(),vocab:vocab()
      },remote.payload):{
        books:await userBooks(),shelves:shelves(),hist:hist(),analytics:readAnalytics(),vocab:vocab(),settings:snapshot.settings
      };

      const payload={schema:1,books:data.books.map(cloudBookExport),shelves:data.shelves,
        hist:Object.fromEntries(Object.entries(data.hist).sort(([a],[b])=>a.localeCompare(b)).slice(-365)),
        analytics:{v:1,days:Object.fromEntries(Object.entries(data.analytics.days||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-180)),sessions:cloudArr(data.analytics.sessions,400).slice(-100)},
        vocab:data.vocab,settings:pushSettings?snapshot.settings:data.settings,updated:new Date().toISOString()};
      try{await cloudWriteRemote(Number(remote.revision||0),payload)}
      catch(e){if((e.status===409||e.status===412||e.code==='23505')&&attempt<2)continue;throw e}
      if(user!==localUser||cloudSession?.user?.id!==uid)throw Error('Perfil alterado durante a sincronização. Nenhum dado local foi substituído.');

      if((cloudPending()?.seq||0)!==(pendingAtStart?.seq||0))
        throw Error('Houve novas alterações locais durante a sincronização. Nada foi substituído neste aparelho; sincronize novamente.');
      await cloudApplyMerged(data);
      lsSet(cloudLinkKey(),uid);lsSet(cloudLastKey(),new Date().toISOString());
      lsSet(cloudRevisionKey(),Number(remote.revision||0)+1);
      lsSet(cloudFingerprintKey(),await cloudDigest(await cloudSnapshot()));
      cloudClearPending(pendingAtStart?.seq);cloudSetConflict(false);cloudLastError='';
      if(!linked){lsSet(cloudAutoKey(),true)}
      cloudStartTimer();cloudNotify();
      if(!$('#lib').hidden)await showLib();
      if(!silent)toast('Sincronização concluída. Arquivos mantidos neste aparelho.');
      return;
    }
    throw Error('O servidor recebeu outras alterações. Tente sincronizar novamente.');
  }catch(e){cloudLastError=e.message;cloudNotify();if(!silent)toast('Falha na sincronização: '+e.message);throw e}
  finally{cloudWorking=false;cloudNotify()}
}
function cloudSettings(g,onChange=()=>tab('Dados')){
  g.classList.add('lector-cloud-settings');
  const intro=document.createElement('p');intro.className='cloud-intro';intro.textContent='Opcional: sincroniza títulos, progresso, estantes, favoritos, marcadores e parte do histórico. Os arquivos e as capas ficam apenas no dispositivo. Os perfis locais continuam funcionando sem conta.';g.append(intro);
  const config=cloudConfig();
  const status=document.createElement('div');status.className='cloud-status';status.setAttribute('role','status');
  const linked=lsGet(cloudLinkKey());
  if(cloudSession){
    const statusTitle=document.createElement('strong');statusTitle.className='lector-cloud-status-title';
    statusTitle.textContent='Conta online conectada';
    const identity=document.createElement('span');identity.className='lector-cloud-status-identity';
    identity.textContent=cloudSession.user?.email||cloudSession.user?.id||'Conta autenticada';
    const detail=document.createElement('small');detail.className='lector-cloud-status-detail';
    detail.textContent='Perfil local: '+user+' · '+(linked===cloudSession.user.id?'Sincronização vinculada':'Vinculação pendente');
    status.append(statusTitle,identity,detail);
  }else{
    const offlineLabel=document.createElement('strong');offlineLabel.textContent='Modo local ativo';
    const detail=document.createElement('small');detail.textContent='Entre com sua conta para habilitar a sincronização.';
    status.append(offlineLabel,detail);
  }
  g.append(status);
  const syncHealth=document.createElement('div');syncHealth.className='cloud-health';syncHealth.setAttribute('role','status');
  const healthIcon=document.createElement('span');healthIcon.className='cloud-health-symbol';healthIcon.append(navIcon('sync'));
  const healthText=document.createElement('span');healthText.dataset.cloudLive='true';
  const stateNow=cloudState();healthText.textContent=stateNow.label;healthText.dataset.state=stateNow.kind;
  const pendingInfo=document.createElement('small');
  const pendingData=cloudPending();
  pendingInfo.textContent=pendingData?'Alterações locais aguardam envio. Os livros e arquivos permanecem neste aparelho.':'Conexão e sincronização são estados diferentes; a confirmação ocorre após uma operação bem-sucedida.';
  syncHealth.append(healthIcon,healthText,pendingInfo);g.append(syncHealth);
  const actions=document.createElement('div');actions.className='cloud-actions';
  if(!cloudSession){

    actions.classList.add('cloud-actions-guest');
    const fields=document.createElement('div');fields.className='cloud-fields';
    const l1=document.createElement('label');l1.textContent='E-mail';const email=document.createElement('input');email.type='email';email.autocomplete='email';l1.append(email);
    const l2=document.createElement('label');l2.textContent='Senha';const pass=document.createElement('input');pass.type='password';pass.autocomplete='current-password';l2.append(pass);fields.append(l1,l2);g.append(fields);
    for(const [label,mode] of [['Entrar','login'],['Criar conta','signup']]){
      const button=mbtn(label,async()=>{
        try{await cloudAuth(mode,email.value.trim(),pass.value);pass.value='';onChange()}
        catch(e){pass.value='';toast('Conta online: '+e.message)}
      },mode==='login'?'primary':'');
      button.classList.add('lector-cloud-action',mode==='login'?'lector-cloud-primary':'lector-cloud-secondary');
      actions.append(button);
    }
  }else{
    const syncNow=mbtn('Sincronizar agora',async()=>{
      try{await cloudSync(false);onChange()}catch(e){toast('Sincronização: '+e.message)}
    },'primary');
    syncNow.classList.add('lector-cloud-action','lector-cloud-primary');
    syncNow.prepend(navIcon('sync'));actions.append(syncNow);
    const syncOn=document.createElement('label');syncOn.className='lector-cloud-auto';
    const check=document.createElement('input');check.type='checkbox';check.checked=lsGet(cloudAutoKey())===true;check.onchange=()=>{
      if(!lsGet(cloudLinkKey())){check.checked=false;return toast('Faça a primeira sincronização manualmente.')}lsSet(cloudAutoKey(),check.checked);cloudStartTimer();
    };
    const autoCopy=document.createElement('span');autoCopy.className='lector-cloud-auto-copy';
    const autoTitle=document.createElement('strong');autoTitle.textContent='Sincronização automática';
    const autoDescription=document.createElement('small');autoDescription.textContent='A cada 5 minutos, quando o aplicativo estiver ativo e online.';
    autoCopy.append(autoTitle,autoDescription);syncOn.append(autoCopy,check);g.append(syncOn);
    if(linked===cloudSession.user.id){
      const applyRemote=mbtn('Aplicar preferências da nuvem',async()=>{
        try{await cloudApplyRemoteSettings();onChange()}catch(e){toast(e.message)}
      });
      const sendLocal=mbtn('Enviar minhas preferências',async()=>{
        try{await cloudSync(false,true);onChange()}catch(e){toast(e.message)}
      });
      applyRemote.classList.add('lector-cloud-action','lector-cloud-secondary');
      sendLocal.classList.add('lector-cloud-action','lector-cloud-secondary');
      applyRemote.prepend(navIcon('download'));
      sendLocal.prepend(navIcon('upload'));
      actions.append(applyRemote,sendLocal);
    }
    const disconnect=mbtn('Sair da conta online',async()=>{await cloudLogout();onChange()});
    disconnect.classList.add('lector-cloud-action','lector-cloud-disconnect');
    disconnect.prepend(navIcon('log-out'));actions.append(disconnect);
  }
  g.append(actions);
  const last=lsGet(cloudLastKey());const note=document.createElement('p');note.className='cloud-warning';
  note.textContent=(last?'Última sincronização neste aparelho: '+new Date(last).toLocaleString('pt-BR')+'. ':'')+
    'Alterações feitas offline ficam marcadas como pendentes neste aparelho. A sincronização automática respeita o interruptor e depende de uma sessão online ativa. Arquivos, capas e Lixeira continuam locais; exclusões não são propagadas entre dispositivos.';
  g.append(note);
  if(cloudSession&&linked===cloudSession.user.id){
    const unlink=mbtn('Desvincular este perfil local',()=>{
      if(!confirm('Desvincular este perfil? Os dados locais e da nuvem permanecerão.'))return;
      localStorage.removeItem(cloudLinkKey());localStorage.removeItem(cloudAutoKey());localStorage.removeItem(cloudRevisionKey());localStorage.removeItem(cloudFingerprintKey());localStorage.removeItem(cloudPendingKey());localStorage.removeItem(cloudConflictKey());cloudConflictPending=false;cloudStopTimer();onChange();
    });
    unlink.classList.add('lector-cloud-unlink');
    const footer=document.createElement('div');footer.className='lector-cloud-footer';footer.append(unlink);g.append(footer);
  }
}
