
const DB=new Promise((ok,no)=>{
  if(!('indexedDB' in window)){no(new Error('IndexedDB indisponível neste navegador'));return}
  let r;try{r=indexedDB.open('leitor',2)}catch(error){no(error);return}
  r.onblocked=()=>{
    console.warn('LECTOR: IndexedDB bloqueado por outra aba.');
    toast('Outra aba pode estar bloqueando a biblioteca. Feche outras abas do LECTOR e recarregue.');
  };
  r.onupgradeneeded=e=>{const d=r.result;if(e.oldVersion<1){d.createObjectStore('users',{keyPath:'name'});d.createObjectStore('books',{keyPath:'id'}).createIndex('user','user');d.createObjectStore('files',{keyPath:'id'})}if(!d.objectStoreNames.contains('trash'))d.createObjectStore('trash',{keyPath:'id'}).createIndex('user','user');if(!d.objectStoreNames.contains('trashFiles'))d.createObjectStore('trashFiles',{keyPath:'id'})};
  r.onsuccess=()=>{
    const database=r.result;
    database.onversionchange=()=>{
      database.close();
      console.warn('LECTOR: outra aba iniciou uma migração do banco local.');
      toast('Banco local atualizado por outra aba. Salve seu trabalho e recarregue o LECTOR antes de continuar.');
    };
    ok(database);
  };r.onerror=()=>no(r.error)});
let memMode=false;const mem={users:new Map(),books:new Map(),files:new Map(),trash:new Map(),trashFiles:new Map()};
function showStorageFailure(){
 memMode=true;let bar=document.getElementById('storage-critical');if(bar)return;
 bar=document.createElement('div');bar.id='storage-critical';bar.setAttribute('role','alert');
 const icon=navIcon('database');icon.setAttribute('aria-hidden','true');
 const message=document.createElement('span');message.textContent='Armazenamento local indisponível. Não é seguro adicionar livros, alterar dados ou sincronizar. Verifique as permissões do navegador e recarregue.';
 const close=document.createElement('button');close.type='button';close.textContent='Fechar aviso';close.onclick=()=>bar.remove();
 bar.append(icon,message,close);document.body.append(bar);
}

const fake=n=>{const m=mem[n],k=n==='users'?'name':'id';return{getAll:()=>({result:[...m.values()]}),getAllKeys:()=>({result:[...m.keys()]}),get:x=>({result:m.get(x)}),put:v=>(m.set(v[k],v),{result:v[k]}),delete:x=>(m.delete(x),{result:1}),index:()=>({getAll:u=>({result:[...m.values()].filter(b=>b.user===u)})})}};

const tx=(st,mode,fn)=>DB.then(d=>new Promise((ok,no)=>{
  let q;const t=d.transaction(st,mode);
  t.oncomplete=()=>{if(mode==='readwrite'&&st==='books'&&typeof cloudMarkDirty==='function')cloudMarkDirty('livros');ok(q&&q.result)};t.onerror=()=>no(t.error||new Error('Falha no IndexedDB'));
  t.onabort=()=>no(t.error||new Error('Transação abortada'));
  try{q=fn(t.objectStore(st))}catch(e){try{t.abort()}catch{}no(e)}
}),()=>{showStorageFailure();
  if(mode!=='readonly')throw Error('IndexedDB indisponível: nenhuma alteração foi gravada. Confira as permissões do site.');
  return fn(fake(st)).result;});

async function saveBookAndFile(meta,blob){
  const db=await DB.catch(()=>null);
  if(!db){showStorageFailure();throw Error('IndexedDB indisponível: o livro não foi importado para evitar perda ao fechar o aplicativo.')}
  return new Promise((resolve,reject)=>{
    const t=db.transaction(['books','files'],'readwrite');
    t.oncomplete=()=>{if(typeof cloudMarkDirty==='function')cloudMarkDirty('livros');resolve()};t.onerror=()=>reject(t.error||new Error('Falha ao salvar livro'));
    t.onabort=()=>reject(t.error||new Error('Gravação abortada'));
    try{t.objectStore('files').put({id:meta.id,blob});t.objectStore('books').put(meta)}
    catch(e){try{t.abort()}catch{}reject(e)}
  });
}

let user=null,uRec=null,S={},cur=null,books=[],selUser=null,lt='home';
const DEF={theme:'original',size:100,mode:'page',bri:1,rtl:false,warm:0,fit:'auto',font:'serif',lh:1.7,awake:true,goal:30,weekGoal:0,app:'auto',appMode:'theme',accent:'marrom',accentCustom:'#9575ef',glass:true,lowEffects:false,dens:'comfy',ui:100,lang:'pt',view:'grid',cover:150,sort:'recent',just:false,hy:false,mg:44,edges:true,clock:false,two:true,cov1:true,sCont:true,sGoal:true,sSeries:true,sAlmost:true,sRecent:true,sShelves:true,sStats:true,dictLang:'en',trLang:'pt-BR',lt:'home',sNotes:true,sVocab:true,sOnb:true,goalSet:false,pf:false,pbr:1,rbg:'theme',rbgc:'#000000'};

const READ_KEYS=['theme','size','mode','bri','rtl','warm','fit','font','lh','awake','just','hy','mg','edges','clock','two','cov1','pf','pbr','rbg','rbgc'];
const readSnapshot=()=>Object.fromEntries(READ_KEYS.map(k=>[k,S[k]]));
let readScope='global',readGlobal=null,readMetaTimer=null,readTab='leitura';
const presetStorage=()=>`leitor:read-presets:${user}`;
const getReadPresets=()=>{const v=lsGet(presetStorage());return Array.isArray(v)?v.filter(x=>x&&typeof x.name==='string'&&x.values&&typeof x.values==='object').slice(0,32):[]};
const saveReadPresets=v=>lsSet(presetStorage(),v);
const BUILTIN_READ_PRESETS=[
  {name:'Mangá',values:{mode:'page',rtl:true,two:false,fit:'auto',theme:'original',pf:false,rbg:'theme',size:100}},
  {name:'Quadrinhos',values:{mode:'page',rtl:false,two:true,fit:'auto',cov1:true,size:100}},
  {name:'Noite',values:{theme:'quieto',bri:.65,warm:20,rbg:'black',pf:true}},
  {name:'Livro tradicional',values:{mode:'page',theme:'papel',font:'serif',lh:1.7,mg:44,size:110}}
];
function persistReading(){
  if(!user)return;
  if(cur&&readScope==='book'&&readGlobal){

    lsSet('leitor:cfg:'+user,{...S,...readGlobal});
    cur.meta.readPrefs=readSnapshot();
    clearTimeout(readMetaTimer);
    readMetaTimer=setTimeout(()=>{if(cur&&cur.meta.readPrefs)tx('books','readwrite',s=>s.put(cur.meta)).catch(console.error)},300);
  }else lsSet('leitor:cfg:'+user,S);
}
function setReadScope(v){
  if(!cur)return;
  if(v==='book'){
    if(readScope!=='book'){
      readGlobal=Object.fromEntries(READ_KEYS.map(k=>[k,(lsGet('leitor:cfg:'+user)||{})[k]??S[k]]));
      readScope='book';
      cur.meta.readPrefs=readSnapshot();
    }
  }else if(readScope==='book'){
    clearTimeout(readMetaTimer);
    readScope='global';readGlobal=null;
    delete cur.meta.readPrefs;
    tx('books','readwrite',s=>s.put(cur.meta)).catch(console.error);
  }
  apply();
}
const show=id=>['login','lib','reader','cfg'].forEach(s=>$('#'+s).hidden=s!==id);
const view=id=>['epub','pg','txt'].forEach(v=>$('#'+v).hidden=v!==id);


async function showLogin(){
  user=null;show('login');$('#pinf').hidden=true;
  const us=await tx('users','readonly',s=>s.getAll());
  $('#newp').open=!us.length;
  $('#login').classList.toggle('has-profiles',!!us.length);
  $('#users').replaceChildren(...us.map(u=>{const b=document.createElement('button');b.className='user';
    b.innerHTML='<span class="av"></span><span></span>';avEl(b.children[0],u);
    b.children[1].textContent=u.name+(u.pin?'  🔒':'');b.onclick=()=>pickUser(u);return b}));
}
function pickUser(u){if(!u.pin)return enter(u.name);selUser=u;$('#pinf').hidden=false;$('#pin').value='';$('#pin').focus()}
$('#pinf').onsubmit=async e=>{e.preventDefault();
  const pin=$('#pin').value;
  try{if(await verifyPIN(selUser.name,pin,selUser.pin)){await updateLegacyPIN(selUser,pin);enter(selUser.name)}
    else{toast('PIN incorreto');$('#pin').value=''}}catch(err){toast('Não foi possível verificar o PIN: '+err.message)}};
$('#nf').onsubmit=async e=>{e.preventDefault();try{
  const name=$('#nn').value.trim(),pin=$('#np').value;
  if(pin&&!/^\d{4,}$/.test(pin))return toast('O PIN precisa ter 4 ou mais dígitos');
  if(await tx('users','readonly',s=>s.get(name)))return toast('Já existe um perfil com esse nome');
  const ph=pin?await makePIN(name,pin):'';
  await tx('users','readwrite',s=>s.put({name,pin:ph}));
  enter(name)}catch(err){console.error(err);toast('Erro ao criar perfil: '+(err.message||err))}};
async function enter(name){cloudStopTimer();cloudSession=null;user=name;uRec=await tx('users','readonly',s=>s.get(name));S=Object.assign({},DEF,lsGet('leitor:cfg:'+name));srt=S.sort;apply();cloudLoadSession();cloudNotify();$('#nf').reset();try{await purgeExpiredTrash();await reconcileTrashTombstones()}catch(e){console.warn('Revisão da lixeira:',e);toast('Confira as exclusões locais antes de sincronizar: '+e.message)}showLib();lectorRestoreSummaryState()}
$('#out').onclick=()=>{setReaderFocus(false);cloudStopTimer();cloudSession=null;user=null;uRec=null;S=Object.assign({},DEF,lsGet('leitor:last-appearance')||{});appApply();showLogin()};


let flt='all',srt='recent',ser=null,selMode=false,fmtF='all',lpAt=0;const sel=new Set();
const dk=d=>{d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const hist=()=>lsGet('leitor:hist:'+user)||{};
function streak(x){let n=0;const d=new Date();if(!(x[dk(d)]>=60))d.setDate(d.getDate()-1);while(x[dk(d)]>=60){n++;d.setDate(d.getDate()-1)}return n}
