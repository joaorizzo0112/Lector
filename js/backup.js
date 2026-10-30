





const BACKUP_SCHEMA=3, MAX_BACKUP_BOOKS=10000, MAX_BACKUP_JSON=32*1024*1024;
const MAX_BACKUP_TOTAL=2*1024*1024*1024;
const MAX_BACKUP_ENTRIES=20050;
let backupBusy=false;
const backupKey=k=>`leitor:${k}:${user}`;
const backupBytes=bytes=>new TextEncoder().encode(bytes);
const backupSHA=async bytes=>{
  if(!crypto.subtle)throw Error('Este navegador não suporta a verificação SHA-256 em contexto inseguro. Use HTTPS ou localhost.');
  const d=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');
};
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[i]=c>>>0}return t})();
async function backupCRC32(blob){
  let crc=-1;const step=2*1024*1024;
  for(let off=0;off<blob.size;off+=step){
    const u=new Uint8Array(await blob.slice(off,off+step).arrayBuffer());
    for(const x of u)crc=CRC_TABLE[(crc^x)&255]^(crc>>>8);
  }
  return ((crc^-1)>>>0).toString(16).padStart(8,'0');
}
const backupPlain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const backupStr=(s,n=300)=>typeof s==='string'&&s.length<=n;
function validateBackupData(data){
  if(!backupPlain(data)||![2,3].includes(Number(data.v))||!Array.isArray(data.books)||data.books.length>MAX_BACKUP_BOOKS)throw Error('Metadados do backup incompatíveis.');
  const ids=new Set();
  for(const b of data.books){
    if(!backupPlain(b)||!backupStr(b.id,120)||!/^[a-zA-Z0-9_.-]{1,120}$/.test(b.id)||b.id.includes('..')||ids.has(b.id)||!backupStr(b.type,20)||!['pdf','epub','cbz','comic','txt'].includes(b.type)||!backupStr(b.title,500)||!Number.isFinite(b.size)||b.size<0||b.size>MAX_BACKUP_TOTAL)throw Error('O backup contém um livro com metadados inválidos.');
    ids.add(b.id);
  }
  if(data.shelves!==undefined&&(!Array.isArray(data.shelves)||data.shelves.length>200||data.shelves.some(x=>!backupStr(x,100))))throw Error('Estantes inválidas no backup.');
  if(data.hist!==undefined&&(!backupPlain(data.hist)||Object.keys(data.hist).length>20000||Object.entries(data.hist).some(([k,v])=>!/^\d{4}-\d{2}-\d{2}$/.test(k)||!Number.isFinite(v)||v<0)))throw Error('Histórico de leitura inválido.');
  validateAnalytics(data.readingAnalytics);
  if(data.readingPresets!==undefined&&(!Array.isArray(data.readingPresets)||data.readingPresets.length>32))throw Error('Perfis de leitura inválidos.');
  if(data.settings!==undefined&&!backupPlain(data.settings))throw Error('Preferências inválidas.');
  if(data.vocabulary!==undefined&&(!Array.isArray(data.vocabulary)||data.vocabulary.length>20000))throw Error('Vocabulário inválido.');
  if(data.avatar!==undefined&&data.avatar!==null&&!backupPlain(data.avatar))throw Error('Avatar inválido.');
  if(data.avatar?.photo&&(!backupStr(data.avatar.photo,800000)||!/^data:image\/(png|jpeg|webp);base64,/.test(data.avatar.photo)))throw Error('A imagem do avatar no backup é inválida.');
  return data;
}
function backupLocalStorageWorks(){
  try{const key='leitor:backup-test';localStorage.setItem(key,'ok');const ok=localStorage.getItem(key)==='ok';localStorage.removeItem(key);return ok}catch{return false}
}



async function localIntegrityAudit({deep=true,onProgress=()=>{}}={}){
  const report={books:0,missing:[],missingRecords:[],cloudRecords:[],orphan:0,
    duplicates:0,cloudOnly:0,storageOK:backupLocalStorageWorks(),
    persistent:false,temporary:memMode,sizeMismatch:[],invalidFiles:[],
    trashCount:0,trashMissing:[],trashOrphan:0,trashExpired:0,invalidMeta:[],
    examined:0,checkedAt:new Date().toISOString()};
  const all=await tx('books','readonly',st=>st.getAll());
  const mine=all.filter(b=>b.user===user);
  const files=await tx('files','readonly',st=>st.getAllKeys());
  const keys=new Set(files),bookKeys=new Set(all.map(b=>b.id)),dups=new Set();
  const deleted=await tx('trash','readonly',st=>st.getAll());
  const myTrash=deleted.filter(x=>x.user===user);
  const trashFileKeys=await tx('trashFiles','readonly',st=>st.getAllKeys());
  const trashPresent=new Set(trashFileKeys);
  const trashIds=new Set(deleted.map(x=>x.id));
  report.books=mine.length;report.trashCount=myTrash.length;
  report.orphan=files.filter(id=>!bookKeys.has(id)).length;
  report.trashOrphan=trashFileKeys.filter(id=>!trashIds.has(id)).length;
  for(const b of mine){
    if(!b||typeof b.id!=='string'||!b.id||!b.type)report.invalidMeta.push(b?.title||b?.id||'(sem identificação)');
    if(b.cloudGhost){report.cloudOnly++;report.cloudRecords.push(b)}
    else if(!keys.has(b.id)){report.missing.push(b.title||b.name||b.id);report.missingRecords.push(b)}
    const k=String(b.name||b.title)+'|'+String(b.size);
    if(dups.has(k))report.duplicates++;dups.add(k);
    if(deep&&!b.cloudGhost&&keys.has(b.id)){
      const rec=await tx('files','readonly',st=>st.get(b.id));
      if(!(rec?.blob instanceof Blob))report.invalidFiles.push(b.title||b.name||b.id);
      else if(Number.isFinite(b.size)&&rec.blob.size!==b.size)
        report.sizeMismatch.push({title:b.title||b.name||b.id,expected:b.size,actual:rec.blob.size});
    }
    report.examined++;onProgress(report.examined,mine.length+myTrash.length);
  }
  for(const item of myTrash){
    if(item.expiresAt>0&&item.expiresAt<=Date.now())report.trashExpired++;
    if(item.hasFile&&!trashPresent.has(item.id))report.trashMissing.push(item.meta?.title||item.id);
    if(deep&&item.hasFile&&trashPresent.has(item.id)){
      const rec=await tx('trashFiles','readonly',st=>st.get(item.id));
      if(!(rec?.blob instanceof Blob))report.trashMissing.push(item.meta?.title||item.id);
      else if(Number.isFinite(item.meta?.size)&&rec.blob.size!==item.meta.size)
        report.sizeMismatch.push({title:'Lixeira: '+(item.meta.title||item.id),expected:item.meta.size,actual:rec.blob.size});
    }
    report.examined++;onProgress(report.examined,mine.length+myTrash.length);
  }
  try{report.persistent=await navigator.storage?.persisted?.()||false}catch{}
  return report;
}

function recoveryDownload(blob,name){
  const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
const recoveryCSV=v=>'"'+String(v??'').replaceAll('"','""')+'"';
function recoveryExportPending(r){
  const pending=[...r.missingRecords.map(b=>({b,status:'Arquivo ausente'})),...r.cloudRecords.map(b=>({b,status:'Aguardando arquivo da nuvem'}))];
  const rows=[['Situação','Título','Nome do arquivo','Formato','Tamanho (bytes)']];
  for(const {b,status} of pending)rows.push([status,b.title||'',b.name||'',b.type||'',b.size||0]);
  const csv='\ufeff'+rows.map(row=>row.map(recoveryCSV).join(';')).join('\r\n');
  recoveryDownload(new Blob([csv],{type:'text/csv;charset=utf-8'}),'lector-arquivos-pendentes-'+dk()+'.csv');
}

function integrityDownloadCSV(r){
  const rows=[['Tipo','Livro ou registro','Detalhes']];
  const add=(type,name,info='')=>rows.push([type,name,info]);
  for(const b of r.missingRecords)add('Arquivo ausente',b.title||b.id,b.id);
  for(const b of r.cloudRecords)add('Somente nuvem',b.title||b.id,b.id);
  for(const x of r.sizeMismatch)add('Tamanho divergente',x.title,`Esperado ${x.expected}; encontrado ${x.actual}`);
  for(const title of r.invalidFiles)add('Arquivo inválido',title);
  for(const title of r.trashMissing)add('Lixeira sem arquivo recuperável',title);
  for(const title of r.invalidMeta)add('Metadados inválidos',title);
  add('Resumo','Arquivos órfãos',r.orphan);
  add('Resumo','Arquivos órfãos na lixeira',r.trashOrphan);
  add('Resumo','Livros vencidos na lixeira',r.trashExpired);
  const field=v=>{const str=String(v??'');return recoveryCSV(/^[\s]*[=+@\-]/.test(str)?"'"+str:str)};
  const csv='\ufeff'+rows.map(row=>row.map(field).join(';')).join('\r\n');
  recoveryDownload(new Blob([csv],{type:'text/csv;charset=utf-8'}),'lector-diagnostico-'+dk()+'.csv');
}
function commitRestoreLocalChanges(changes,storage=localStorage){



  const originals=new Map(),changed=[];
  try{
    for(const [key,value] of changes){
      if(!originals.has(key))originals.set(key,storage.getItem(key));
      storage.setItem(key,JSON.stringify(value));changed.push(key);
    }
  }catch(e){
    let rolledBack=true;
    for(const key of [...new Set(changed)].reverse())try{
      const original=originals.get(key);
      if(original===null)storage.removeItem(key);else storage.setItem(key,original);
    }catch(error){rolledBack=false;console.error('Rollback de preferência:',key,error)}
    throw Error((rolledBack?'As preferências anteriores foram preservadas. ':'Falha ao reverter algumas preferências. ')+
      'Confira o diagnóstico e tente novamente com o mesmo ZIP. Motivo: '+(e.message||e));
  }
}

async function recoveryAttachFiles(selected){
  if(backupBusy)throw Error('Há uma operação de backup em andamento.');
  const db=await DB.catch(()=>null);if(!db||memMode)throw Error('IndexedDB indisponível para recuperar livros.');
  const currentUser=user,all=await userBooks(),present=new Set(await tx('files','readonly',st=>st.getAllKeys()));
  const pending=all.filter(b=>!present.has(b.id)),used=new Set(),matched=[];let ignored=0;
  const normalized=name=>String(name||'').normalize('NFKC').trim().toLocaleLowerCase('pt-BR');
  for(const file of selected){
    if(!/\.(pdf|epub|cbz|zip|txt)$/i.test(file.name)){ignored++;continue}
    const candidates=pending.filter(b=>!used.has(b.id)&&normalized(b.name||b.title)===normalized(file.name)&&(!Number.isFinite(b.size)||b.size===0||Number(b.size)===file.size));
    if(candidates.length!==1){ignored++;continue}
    const b=candidates[0];
    const extensions={pdf:['pdf'],epub:['epub'],cbz:['cbz','zip'],comic:['cbz','zip'],txt:['txt']};
    if(!(extensions[b.type]||[]).some(ext=>file.name.toLowerCase().endsWith('.'+ext))){ignored++;continue}
    used.add(b.id);matched.push({file,book:b});
  }
  if(!matched.length)return{restored:0,ignored};
  const summary=matched.map(x=>x.file.name).slice(0,5).join('; ');
  if(!confirm('Reassociar '+matched.length+' arquivo(s) ao perfil atual?\n'+summary+(matched.length>5?'…':'')+'\nOs registros de leitura existentes serão preservados.'))return{restored:0,ignored:ignored+matched.length};
  if(user!==currentUser)throw Error('O perfil mudou durante a operação.');
  backupBusy=true;
  try{
    await new Promise((resolve,reject)=>{
      const t=db.transaction(['books','files'],'readwrite');
      t.oncomplete=resolve;t.onerror=()=>reject(t.error||Error('Falha ao reassociar arquivos'));
      t.onabort=()=>reject(t.error||Error('Operação de recuperação cancelada'));
      try{for(const {file,book} of matched){
        t.objectStore('files').put({id:book.id,blob:file});
        t.objectStore('books').put({...book,cloudGhost:false,size:file.size});
      }}catch(e){try{t.abort()}catch{}reject(e)}
    });
    if(typeof cloudMarkDirty==='function')cloudMarkDirty('arquivos recuperados');
    return{restored:matched.length,ignored};
  }finally{backupBusy=false}
}
async function openRecoveryFilePicker(){
  const picker=document.createElement('input');picker.type='file';picker.multiple=true;
  picker.accept='.pdf,.epub,.cbz,.zip,.txt';picker.style.display='none';document.body.append(picker);
  picker.onchange=async()=>{
    const selected=Array.from(picker.files||[]);picker.remove();if(!selected.length)return;
    try{const {restored,ignored}=await recoveryAttachFiles(selected);toast(restored+' arquivo(s) reassociado(s). '+ignored+' não correspondentes.');if(!$('#cfg').hidden)tab('Dados');else showLib()}
    catch(e){console.error(e);toast('Recuperação: '+e.message)}
  };
  picker.click();
  picker.addEventListener('cancel',()=>picker.remove(),{once:true});
}

async function recoveryPlan(info){
  const existing=await userBooks(),present=new Set(await tx('files','readonly',s=>s.getAllKeys()));
  const byKey=new Map();
  const key=b=>String(b.name||b.title)+'|'+b.size;
  for(const b of existing){const k=key(b),old=byKey.get(k);if(!old||(present.has(b.id)&&!present.has(old.id)))byKey.set(k,b)}
  const seen=new Set(),items=[],counts={fresh:0,repair:0,duplicate:0,bytes:0};
  for(const b of info.data.books){const k=key(b),old=byKey.get(k);let state;
    if(seen.has(k)||old&&present.has(old.id)){state='duplicate';counts.duplicate++}
    else if(old){state='repair';counts.repair++;counts.bytes+=b.size}
    else{state='fresh';counts.fresh++;counts.bytes+=b.size}
    seen.add(k);items.push({b,state});
  }
  return{items,counts};
}
async function recoveryVerifyAll(info,onProgress=()=>{}){
  if(backupBusy)throw Error('Outra operação de backup está em andamento.');
  backupBusy=true;
  try{for(let i=0;i<info.files.length;i++){
    const f=info.files[i],entry=info.zip.file(f.path);if(!entry)throw Error('Arquivo não encontrado: '+f.path);
    onProgress(i,info.files.length,f.path);
    const buf=await entry.async('uint8array');
    if(buf.byteLength!==f.size)throw Error('Tamanho incorreto: '+f.path);
    if(f.crc32&&(await backupCRC32(new Blob([buf])))!==f.crc32)throw Error('Integridade inválida: '+f.path);

  }onProgress(info.files.length,info.files.length,'');return true}
  finally{backupBusy=false}
}
async function openIntegrityReport(){
  try{
    toast('Verificando catálogo, arquivos e lixeira sem alterar nenhum dado…');
    const r=await localIntegrityAudit({deep:true});
    dialog('Diagnóstico de integridade da biblioteca',w=>{
      const items=[['Livros deste perfil',r.books],['Somente nuvem',r.cloudOnly],
        ['Arquivos ausentes',r.missing.length],['Tamanhos divergentes',r.sizeMismatch.length],
        ['Arquivos inválidos',r.invalidFiles.length],['Itens na lixeira',r.trashCount],
        ['Lixeira sem arquivo',r.trashMissing.length],['Órfãos (incluindo outros perfis)',r.orphan+r.trashOrphan],
        ['Possíveis duplicados',r.duplicates]];
      const grid=document.createElement('div');grid.className='backup-summary';
      for(const [label,count] of items){const c=document.createElement('div'),n=document.createElement('b'),l=document.createElement('span');n.textContent=count;l.textContent=label;c.append(n,l);grid.append(c)}w.append(grid);
      const clean=!r.missing.length&&!r.sizeMismatch.length&&!r.invalidFiles.length&&!r.trashMissing.length&&!r.invalidMeta.length;
      const info=document.createElement('p');info.className='backup-report';info.setAttribute('role','status');
      info.textContent=(clean?'✓ Nenhuma inconsistência de arquivo detectada':'⚠ Há itens que precisam de atenção')+'\n'+
        (r.storageOK?'✓ Preferências locais acessíveis':'⚠ Preferências locais indisponíveis')+'\n'+
        (r.temporary?'⚠ Banco em memória temporária':'✓ Banco de dados local acessível')+'\n'+
        (r.persistent?'✓ Armazenamento persistente concedido':'ℹ Persistência não garantida pelo navegador')+'\n'+
        (r.trashExpired?'ℹ '+r.trashExpired+' item(ns) com prazo vencido na lixeira':'✓ Nenhum item vencido na lixeira');w.append(info);
      if(r.missing.length||r.trashMissing.length||r.sizeMismatch.length){
        const note=document.createElement('p');note.className='backup-warning';
        note.textContent='Exemplos para revisão: '+[...r.missing,...r.trashMissing,...r.sizeMismatch.map(x=>x.title)].slice(0,6).join('; ');w.append(note);
      }
      const note=document.createElement('p');note.className='backup-info';
      note.textContent='Verificação somente leitura: presença, tipo e tamanho dos arquivos; não calcula o hash de cada livro nem modifica a lixeira. Não comprova recuperação sem testar um ZIP.';w.append(note);
      const acts=document.createElement('div');acts.className='backup-actions';
      acts.append(mbtn('Baixar relatório CSV',()=>integrityDownloadCSV(r)));
      if(r.missingRecords.length||r.cloudRecords.length){
        acts.append(mbtn('Reassociar arquivos',()=>{dlg.close();openRecoveryFilePicker()},'primary'));
      }
      acts.append(mbtn('Fechar',()=>dlg.close()));w.append(acts);
    });
  }catch(e){console.error(e);toast('Não foi possível verificar o banco local: '+e.message)}
}
async function exportBackup(){
  if(backupBusy)return;
  if(!backupLocalStorageWorks())return toast('Armazenamento de preferências indisponível. Verifique as permissões antes do backup.');
  backupBusy=true;
  try{
    const allBooks=await userBooks(),bs=allBooks.filter(b=>!b.cloudGhost);
    if(bs.length!==allBooks.length)toast('Backup: registros da nuvem sem arquivo não serão incluídos.');
    if(bs.length>MAX_BACKUP_BOOKS)throw Error('Biblioteca grande demais para este formato de backup.');
    const zip=new JSZip(),files=[],payload={v:BACKUP_SCHEMA,appVersion:APP_VERSION,createdAt:new Date().toISOString(),books:bs,shelves:shelves(),hist:hist(),readingAnalytics:readAnalytics(),readingPresets:getReadPresets(),settings:lsGet(backupKey('cfg'))||S,vocabulary:vocab(),avatar:uRec?.av||null};
    let total=0;
    for(let i=0;i<bs.length;i++){
      const b=bs[i];toast('Conferindo arquivo '+(i+1)+' de '+bs.length+'…');
      const rec=await tx('files','readonly',s=>s.get(b.id));
      if(!rec||!(rec.blob instanceof Blob))throw Error('Arquivo ausente: '+String(b.title||b.name).slice(0,75)+'. Backup cancelado sem gerar um ZIP incompleto.');
      if(Number.isFinite(b.size)&&rec.blob.size!==b.size)throw Error('Tamanho inconsistente: '+String(b.title||b.name).slice(0,75));
      total+=rec.blob.size;if(total>MAX_BACKUP_TOTAL)throw Error('O backup excede 2 GB. Divida a biblioteca ou use uma solução de arquivos externos.');
      const entry='files/'+String(i+1).padStart(6,'0')+'.bin';
      files.push({id:b.id,path:entry,size:rec.blob.size,crc32:await backupCRC32(rec.blob)});
      zip.file(entry,rec.blob,{binary:true,compression:'STORE'});
    }
    const json=JSON.stringify(payload),bytes=backupBytes(json);if(bytes.byteLength>MAX_BACKUP_JSON)throw Error('Metadados maiores que 32 MB.');
    const manifest={format:'lector-backup',schema:BACKUP_SCHEMA,createdAt:payload.createdAt,metadataSHA256:await backupSHA(bytes),files};
    zip.file('library.json',json);zip.file('manifest.json',JSON.stringify(manifest));
    toast('Gerando ZIP de backup…');
    const blob=await zip.generateAsync({type:'blob',compression:'STORE',streamFiles:true}),a=document.createElement('a'),url=URL.createObjectURL(blob);
    a.href=url;a.download='lector-backup-v3-'+dk()+'.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    lsSet('leitor:lastBackup:'+user,new Date().toISOString());
    toast(bs.length!==allBooks.length?'Download do ZIP iniciado; registros sem arquivo ficaram fora. Confira o arquivo na pasta Downloads.':'Download do ZIP iniciado. Confirme que o arquivo foi salvo antes de considerar o backup concluído.');
  }catch(e){console.error(e);toast('Backup cancelado: '+(e.message||e))}
  finally{backupBusy=false}
}
async function inspectBackup(file){
  if(!file||file.size>MAX_BACKUP_TOTAL)throw Error('Arquivo muito grande para a restauração no navegador (limite: 2 GB).');
  const zip=await JSZip.loadAsync(file),entries=Object.keys(zip.files);
  if(entries.length>MAX_BACKUP_ENTRIES)throw Error('O ZIP contém entradas demais.');
  const j=zip.file('library.json');if(!j)throw Error('Arquivo library.json não encontrado.');
  if(j._data?.uncompressedSize>MAX_BACKUP_JSON)throw Error('Os metadados do ZIP são muito grandes.');
  const raw=await j.async('uint8array');if(raw.length>MAX_BACKUP_JSON)throw Error('Metadados acima do limite permitido.');
  let data;try{data=validateBackupData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)))}catch(e){throw Error('Metadados inválidos: '+e.message)}
  const manifestFile=zip.file('manifest.json');let files=[];
  if(Number(data.v)===3){
    if(!manifestFile)throw Error('O manifesto de integridade está ausente.');
    const manifest=JSON.parse(await manifestFile.async('string'));
    if(!backupPlain(manifest)||manifest.format!=='lector-backup'||manifest.schema!==3||!Array.isArray(manifest.files)||manifest.files.length!==data.books.length)throw Error('Manifesto incompatível.');
    if(await backupSHA(raw)!==manifest.metadataSHA256)throw Error('Os metadados não conferem com o SHA-256 do manifesto.');
    const idSet=new Set(data.books.map(b=>b.id)),seen=new Set();let total=0;
    for(const f of manifest.files){
      if(!backupPlain(f)||!idSet.has(f.id)||seen.has(f.id)||!/^files\/\d{6}\.bin$/.test(f.path)||!Number.isFinite(f.size)||f.size<0||!/^[a-f0-9]{8}$/.test(f.crc32)||!zip.file(f.path))throw Error('Arquivo incorreto no manifesto.');
      const entry=zip.file(f.path);
      if(Number.isFinite(entry?._data?.uncompressedSize)&&entry._data.uncompressedSize!==f.size)throw Error('Tamanho do ZIP não corresponde ao manifesto.');
      seen.add(f.id);total+=f.size;files.push(f);
    }
    if(total>MAX_BACKUP_TOTAL)throw Error('O conteúdo excede o limite de 2 GB.');
    const ref=new Map(data.books.map(b=>[b.id,b]));
    if(files.some(f=>f.size!==ref.get(f.id).size))throw Error('Tamanho dos livros não corresponde ao catálogo.');
  }else{

    files=data.books.map(b=>{const path='files/'+b.id,entry=zip.file(path);
      return{id:b.id,path,size:b.size,crc32:Number.isInteger(entry?._data?.crc32)?(entry._data.crc32>>>0).toString(16).padStart(8,'0'):null};
    });
    if(files.some(f=>!zip.file(f.path)))throw Error('Backup legado incompleto: há livros sem seus arquivos.');
    if(files.some(f=>{const n=zip.file(f.path)?._data?.uncompressedSize;return Number.isFinite(n)&&n!==f.size}))throw Error('Backup legado contém arquivo com tamanho inconsistente.');
    if(files.reduce((sum,f)=>sum+f.size,0)>MAX_BACKUP_TOTAL)throw Error('O backup excede o limite de 2 GB.');
  }
  return {zip,data,files,schema:Number(data.v)};
}
function backupOptions(data){return [
  ['books','Livros e arquivos',data.books.length>0,true],
  ['shelves','Estantes',Array.isArray(data.shelves),true],
  ['history','Histórico diário de leitura',backupPlain(data.hist),true],
  ['analytics','Estatísticas por livro e sessões',backupPlain(data.readingAnalytics),true],
  ['presets','Perfis de leitura',Array.isArray(data.readingPresets),true],
  ['vocab','Vocabulário',Array.isArray(data.vocabulary),true],
  ['settings','Configurações do aplicativo',backupPlain(data.settings),false],
  ['avatar','Avatar do perfil',backupPlain(data.avatar),false]
]}
async function restoreFromInspected(info,chosen){
  if(backupBusy)throw Error('Outra operação de backup está em andamento.');
  if(!backupLocalStorageWorks())throw Error('Armazenamento de preferências indisponível.');
  const db=await DB.catch(()=>null);if(!db||memMode)throw Error('IndexedDB indisponível: não é seguro restaurar na memória temporária.');
  const targetUser=user;backupBusy=true;
  try{
    const {zip,data,files}=info;
    const existing=await userBooks(),present=new Set(await tx('files','readonly',st=>st.getAllKeys()));
    const byFingerprint=new Map();
    for(const b of existing){
      const fp=String(b.name||b.title)+'|'+b.size,prev=byFingerprint.get(fp);
      if(!prev||(present.has(b.id)&&!present.has(prev.id)))byFingerprint.set(fp,b);
    }
    const keys=new Set(byFingerprint.keys()),blobs=[],idMap=new Map();let skipped=0,repaired=0;

    for(let i=0;chosen.books&&i<files.length;i++){
      const spec=files[i],meta=data.books.find(b=>b.id===spec.id);
      const fp=String(meta.name||meta.title)+'|'+meta.size;
      const found=byFingerprint.get(fp),duplicate=!!found&&present.has(found.id);
      toast('Validando arquivo '+(i+1)+' de '+files.length+'…');
      const entry=zip.file(spec.path);if(!entry)throw Error('Arquivo ausente: '+spec.path);
      const buf=await entry.async('uint8array');
      if(buf.byteLength!==spec.size)throw Error('Tamanho incorreto: '+meta.title);
      if(spec.crc32){const crc=await backupCRC32(new Blob([buf]));if(crc!==spec.crc32)throw Error('Arquivo corrompido: '+meta.title)}
      if(duplicate){idMap.set(meta.id,found.id);skipped++;continue}
      const type={pdf:'application/pdf',epub:'application/epub+zip',txt:'text/plain',comic:'application/zip',cbz:'application/zip'}[meta.type]||'application/octet-stream';

      const id=found?.id||uid(),book=found?{...meta,...found,id,user,cloudGhost:false}:{...meta,id,user};
      const blob=new Blob([buf],{type});
      if(found)repaired++;
      blobs.push({book,blob});idMap.set(meta.id,id);keys.add(fp);byFingerprint.set(fp,book);present.add(id);
    }
    if(user!==targetUser)throw Error('O perfil mudou durante a restauração.');


    const localChanges=[];
    const safeWrite=(k,v)=>localChanges.push([`leitor:${k}:${targetUser}`,v]);
    if(chosen.shelves&&Array.isArray(data.shelves))safeWrite('shelves',[...new Set([...shelves(),...data.shelves.map(s=>s.trim()).filter(Boolean)])]);
    if(chosen.history&&backupPlain(data.hist)){
      const h=hist();for(const [k,v] of Object.entries(data.hist))h[k]=Math.max(Number(h[k])||0,v);safeWrite('hist',h);
    }
    if(chosen.analytics&&backupPlain(data.readingAnalytics))safeWrite('reading-analytics',mergeAnalytics(readAnalytics(),data.readingAnalytics,idMap));
    if(chosen.presets&&Array.isArray(data.readingPresets)){
      const old=getReadPresets(),seen=new Set([...old,...BUILTIN_READ_PRESETS].map(x=>x.name.toLowerCase()));
      for(const preset of data.readingPresets){if(old.length>=32)break;
        if(!backupPlain(preset)||!backupStr(preset.name,32)||!backupPlain(preset.values))continue;
        const name=preset.name.trim();if(!name||seen.has(name.toLowerCase()))continue;
        old.push({name,values:Object.fromEntries(READ_KEYS.filter(k=>Object.hasOwn(preset.values,k)).map(k=>[k,preset.values[k]]))});seen.add(name.toLowerCase());
      }safeWrite('read-presets',old);
    }
    if(chosen.vocab&&Array.isArray(data.vocabulary)){
      const old=vocab(),seen=new Set(old.map(v=>String(v.w||'').toLowerCase()));
      for(const item of data.vocabulary){if(!backupPlain(item)||!backupStr(item.w,150))continue;
        if(!seen.has(item.w.toLowerCase())){old.push(item);seen.add(item.w.toLowerCase())}
      }safeWrite('vocab',old);
    }
    let restoredCfg=null;
    if(chosen.settings&&backupPlain(data.settings)){
      restoredCfg={...S};
      for(const k of Object.keys(DEF))if(Object.hasOwn(data.settings,k)&&typeof data.settings[k]===typeof DEF[k])restoredCfg[k]=data.settings[k];
      safeWrite('cfg',restoredCfg);
    }
    let restoredUser=null;
    if(chosen.avatar&&backupPlain(data.avatar)){
      const safe={};if(backupStr(data.avatar.e,16))safe.e=data.avatar.e;
      if(/^#[a-f0-9]{6}$/i.test(data.avatar.c||''))safe.c=data.avatar.c;
      if(backupStr(data.avatar.photo,800000)&&/^data:image\/(png|jpeg|webp);base64,/.test(data.avatar.photo))safe.photo=data.avatar.photo;
      restoredUser={...uRec,av:{...(uRec.av||{}),...safe}};
    }

    for(const [,value] of localChanges)if(typeof JSON.stringify(value)!=='string')throw Error('Uma preferência do ZIP não pode ser serializada.');
    if(user!==targetUser)throw Error('O perfil mudou durante a restauração.');
    if(blobs.length||restoredUser){

      await new Promise((resolve,reject)=>{
        const names=restoredUser?['books','files','users']:['books','files'];
        const t=db.transaction(names,'readwrite');
        t.oncomplete=resolve;t.onerror=()=>reject(t.error||new Error('Falha na restauração'));
        t.onabort=()=>reject(t.error||new Error('Restauração cancelada pelo banco'));
        try{
          for(const item of blobs){t.objectStore('files').put({id:item.book.id,blob:item.blob});t.objectStore('books').put(item.book)}
          if(restoredUser)t.objectStore('users').put(restoredUser);
        }catch(e){try{t.abort()}catch{}reject(e)}
      });
    }
    if(restoredUser)uRec=restoredUser;
    if(user!==targetUser)throw Error('Perfil alterado após o commit dos livros; retome pelo perfil original.');
    try{commitRestoreLocalChanges(localChanges)}
    catch(e){throw Error('Os arquivos do catálogo foram preservados, mas algumas preferências não foram aplicadas. '+e.message)}
    if(blobs.length||localChanges.length)if(typeof cloudMarkDirty==='function')cloudMarkDirty('backup restaurado');
    if(restoredCfg){S=restoredCfg;apply()}
    toast((blobs.length-repaired)+' livro(s) adicionados, '+repaired+' arquivos recuperados'+(skipped?' · '+skipped+' duplicado(s) preservado(s)':'')+'.');
    if(!$('#cfg').hidden)tab('Dados');else showLib();
  }finally{backupBusy=false}
}
async function importBackup(file){
  try{
    if(backupBusy)return toast('Aguarde a operação anterior terminar.');
    toast('Lendo o manifesto do backup…');
    const info=await inspectBackup(file),opts=backupOptions(info.data),plan=await recoveryPlan(info);
    let free=null;
    try{const {usage,quota}=await navigator.storage.estimate();if(Number.isFinite(quota)&&Number.isFinite(usage))free=Math.max(0,quota-usage)}catch{}
    dialog('Restaurar backup com segurança',w=>{
      const note=document.createElement('p');note.className='backup-center-intro';
      note.textContent='Confira o conteúdo antes de importar. O LECTOR não apaga livros existentes; arquivos ausentes podem ser recuperados com o mesmo ID.';w.append(note);
      const grid=document.createElement('div');grid.className='backup-summary';
      const {counts}=plan;
      for(const [label,value] of [['Novos livros',counts.fresh],['Arquivos recuperáveis',counts.repair],['Já presentes',counts.duplicate],['Dados a gravar',fmtSize(counts.bytes)]]){
        const el=document.createElement('div'),b=document.createElement('b'),cap=document.createElement('span');
        b.textContent=value;cap.textContent=label;el.append(b,cap);grid.append(el);
      }w.append(grid);
      const origin=document.createElement('p');origin.className='backup-info';
      origin.textContent='Backup '+(info.schema===3?'v3 · SHA-256 do catálogo conferido':'legado v2 · integridade não autenticada')+' · '+info.data.books.length+' livro(s) · '+(info.data.createdAt?new Date(info.data.createdAt).toLocaleString('pt-BR'):'data desconhecida');w.append(origin);
      if(free!==null&&counts.bytes>free){
        const quota=document.createElement('p');quota.className='backup-warning';quota.textContent='Atenção: a cota disponível estimada ('+fmtSize(free)+') é menor que os arquivos previstos ('+fmtSize(counts.bytes)+'). A importação pode falhar.';w.append(quota);
      }
      const preview=document.createElement('div');preview.className='backup-preview';
      const title=document.createElement('div');title.className='backup-preview-title';title.textContent='Prévia dos arquivos';preview.append(title);
      const list=document.createElement('div');list.className='backup-preview-list';
      for(const {b,state} of plan.items.slice(0,10)){
        const row=document.createElement('div');row.className='backup-preview-item';
        const name=document.createElement('span');name.textContent=b.title||b.name||'Livro sem título';
        const status=document.createElement('small');status.textContent=state==='fresh'?'Adicionar · '+fmtSize(b.size):state==='repair'?'Recuperar arquivo':'Já existe';
        row.append(name,status);list.append(row);
      }if(!plan.items.length){const empty=document.createElement('div');empty.textContent='Nenhum arquivo de livro neste backup.';list.append(empty)}
      preview.append(list);
      if(plan.items.length>10){const more=document.createElement('p');more.className='backup-preview-hint';more.textContent='Exibindo 10 de '+plan.items.length+' livros.';preview.append(more)}
      w.append(preview);
      const chosen={},choices=document.createElement('div');choices.className='backup-choices';
      for(const [key,label,available,on] of opts){
        const wrap=document.createElement('label');wrap.className='backup-choice';
        const c=document.createElement('input');c.type='checkbox';c.checked=available&&on;c.disabled=!available;
        c.onchange=()=>{chosen[key]=c.checked};chosen[key]=c.checked;
        const caption=document.createElement('span');caption.textContent=label+(available?'':' (indisponível)');wrap.append(c,caption);choices.append(wrap);
      }w.append(choices);
      const hint=document.createElement('p');hint.className='backup-note';
      hint.textContent='Os dados são privados. A verificação de integridade detecta corrupção, mas não garante a origem do ZIP. O PIN, sessões de login e PDFs armazenados somente na nuvem não são exportados.';w.append(hint);
      const progress=document.createElement('p');progress.className='backup-workstatus';progress.setAttribute('role','status');progress.textContent='Você pode verificar todos os arquivos antes de restaurar.';
      const meter=document.createElement('div');meter.className='backup-meter';const fill=document.createElement('i');meter.append(fill);w.append(progress,meter);
      const actions=document.createElement('div');actions.className='backup-actions';
      const cancel=mbtn('Cancelar',()=>dlg.close());
      const verify=mbtn('Verificar arquivos',async()=>{
        verify.disabled=true;go.disabled=true;cancel.disabled=true;progress.classList.remove('err','ok');
        try{
          await recoveryVerifyAll(info,(done,total,path)=>{
            fill.style.width=(total?Math.round(done/total*100):100)+'%';
            progress.textContent=done===total?'Todos os arquivos foram verificados.':'Verificando '+(done+1)+' de '+total+' · '+path;
          });progress.classList.add('ok');
        }catch(e){progress.classList.add('err');progress.textContent='Falha: '+e.message}
        finally{verify.disabled=false;go.disabled=false;cancel.disabled=false}
      });
      const go=mbtn('Restaurar selecionados',async()=>{
        if(!Object.values(chosen).some(Boolean))return toast('Selecione ao menos uma categoria.');
        verify.disabled=true;go.disabled=true;cancel.disabled=true;progress.classList.remove('err','ok');
        progress.textContent='Validando e restaurando os itens selecionados…';
        try{await restoreFromInspected(info,chosen);dlg.close()}
        catch(e){console.error(e);progress.textContent='Restauração não concluída: '+e.message;progress.classList.add('err');verify.disabled=false;go.disabled=false;cancel.disabled=false}
      },'primary');
      actions.append(cancel,verify,go);w.append(actions);
    });
  }catch(e){console.error(e);toast('Backup rejeitado: '+(e.message||e))}
}
$('#bak').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)importBackup(file)};
async function paneDados(p){
  const bs=await userBooks();if(curTab!=='Dados')return;await appGroup(p);let g=grpP(p,'Armazenamento');
  const used=bs.reduce((n,b)=>n+b.size,0);let extra='';try{const e=await navigator.storage.estimate();extra=' · '+fmtSize(e.usage)+' / '+fmtSize(e.quota)}catch{}
  const sp=document.createElement('b');sp.textContent=fmtSize(used)+extra;ctl(g,'Uso de armazenamento',sp);
  g=grpP(p,'Desempenho e estabilidade');
  const perfAbout=document.createElement('p');perfAbout.className='perf-help';
  perfAbout.textContent='A biblioteca carrega os cartões gradualmente, prioriza capas visíveis e evita reconstruir a página inicial ao filtrar livros.';
  g.append(perfAbout);
  const opt=document.createElement('input');opt.type='checkbox';opt.checked=!!S.lowEffects;
  opt.setAttribute('aria-label','Reduzir efeitos visuais pesados');
  opt.onchange=()=>{S.lowEffects=opt.checked;apply();toast(opt.checked?'Efeitos leves ativados':'Efeitos normais ativados')};
  ctl(g,'Reduzir transparências e desfoques em cartões (útil em celulares)',opt);
  const perfCount=document.createElement('span');perfCount.className='perf-diagnostic';
  perfCount.textContent=bs.length+' livros · '+bs.filter(b=>b.cover).length+' capas cadastradas';
  ctl(g,'Biblioteca local',perfCount);
  const dependencyStatus=document.createElement('div');dependencyStatus.className='lector-dependency-list';
  dependencyStatus.setAttribute('role','status');dependencyStatus.setAttribute('aria-label','Estado das bibliotecas de leitura');
  for(const [name,loaded,path] of readingDependencies()){
    const row=document.createElement('div');row.className='lector-dependency';
    const symbol=document.createElement('span');symbol.className=loaded?'dep-ok':'dep-warn';
    symbol.textContent=loaded?'✓':'!';symbol.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=name+' · '+(loaded?'disponível':'arquivo ausente: '+path);
    row.append(symbol,label);dependencyStatus.append(row);
  }
  g.append(dependencyStatus);
  const perfButton=mbtn('Verificar desempenho',async()=>{
    perfButton.disabled=true;perfButton.textContent='Verificando…';
    try{
      const result=[];
      const count=bs.length;
      result.push(count+' livros no catálogo');
      const storage=await navigator.storage?.estimate?.().catch(()=>null);
      if(storage&&Number.isFinite(storage.usage)&&Number.isFinite(storage.quota))result.push('armazenamento do navegador: '+fmtSize(storage.usage)+' / '+fmtSize(storage.quota));
      result.push('bibliotecas: '+readingDependencies().filter(([,loaded])=>loaded).length+'/3 carregadas');
      result.push('cache OCR e arquivos permanecem no dispositivo');
      perfCount.textContent=result.join(' · ');
      toast('Diagnóstico atualizado sem remover dados');
    }catch(e){toast('Não foi possível consultar as informações de armazenamento')}
    finally{perfButton.disabled=false;perfButton.textContent='Verificar desempenho'}
  });
  ctl(g,'Inspecionar uso e quantidade de arquivos sem apagar os dados',perfButton);
  g=grpP(p,'Centro de backup e recuperação');
  const intro=document.createElement('p');intro.className='backup-center-intro';intro.textContent='Proteja a biblioteca neste dispositivo. Faça um ZIP completo, verifique o armazenamento local e recupere arquivos ausentes sem perder progresso e marcadores.';g.append(intro);
  ctl(g,'Verificar arquivos, tamanhos, lixeira, registros órfãos e duplicatas (somente leitura)',mbtn('Diagnóstico',openIntegrityReport));
  ctl(g,'Incluir livros, estantes, estatísticas, vocabulário, configurações e avatar',mbtn('Exportar backup completo',exportBackup,'primary'));
  ctl(g,'Visualizar, verificar e restaurar um ZIP antes de importar',mbtn('Importar e revisar ZIP',()=>$('#bak').click()));
  ctl(g,'Reassociar PDFs, EPUBs, mangás ou HQs que ficaram sem arquivo',mbtn('Reassociar arquivos',openRecoveryFilePicker));
  const help=document.createElement('p');help.className='backup-info';help.textContent='Os backups são locais: guarde o ZIP fora do navegador. O formato ZIP v3 verifica o catálogo e os arquivos (SHA-256/CRC32); backups v2 continuam aceitos. A prévia evita duplicações e pode recuperar arquivos ausentes. O PIN não é exportado.';g.append(help);
  const lastBackup=lsGet('leitor:lastBackup:'+user),status=document.createElement('small');status.className='backup-info';status.textContent=lastBackup?'Última tentativa de download neste aparelho: '+new Date(lastBackup).toLocaleString('pt-BR')+' (confirme o arquivo salvo)':'Nenhum download de backup registrado neste aparelho';g.append(status);
  g=grpP(p,'Conta na nuvem · Supabase');cloudSettings(g);
  g=grpP(p,'Zona de risco');
  ctl(g,'Restaurar todos os ajustes (tema, leitura, biblioteca)',mbtn('Restaurar tudo',()=>{if(confirm('Restaurar todos os ajustes para o padrão? Seus livros e perfis não são afetados.')){Object.assign(S,DEF,{goal:S.goal,goalSet:S.goalSet,lt:S.lt});apply();tab();toast('Ajustes restaurados')}},'dg2'));
  ctl(g,'Limpar histórico de leitura',mbtn('Limpar histórico de leitura',()=>{if(confirm('Apagar o histórico de tempo lido e as estatísticas?')){lsSet('leitor:hist:'+user,{});lsSet(analyticsKey(),emptyAnalytics());toast('Histórico e estatísticas limpos')}},'dg2'));
  ctl(g,'Mover todos os livros para a Lixeira',mbtn('Mover para a Lixeira',async()=>{if(bs.length&&confirm('Mover todos os '+bs.length+' livros deste perfil para a Lixeira?')){await rmBooks(bs.map(b=>b.id));toast('Livros enviados para a Lixeira');tab()}},'dg2'));
}
