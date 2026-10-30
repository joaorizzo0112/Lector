const $=s=>document.querySelector(s);
const APP_VERSION='17.0';
const THEMES={
  original:{n:'Original',bg:'#ffffff',fg:'#1d1d1f',f:'none',w:400},
  quieto:{n:'Quieto',bg:'#1c1c1e',fg:'#d1d1d6',f:'invert(.9) hue-rotate(180deg)',w:400},
  noite:{n:'Noite',bg:'#000000',fg:'#c9c9c9',f:'invert(.92) hue-rotate(180deg)',w:400},
  papel:{n:'Papel',bg:'#ececec',fg:'#222',f:'grayscale(1) contrast(.95)',w:400},
  negrito:{n:'Negrito',bg:'#ffffff',fg:'#000',f:'contrast(1.25)',w:700},
  calmo:{n:'Calmo',bg:'#f0dcc0',fg:'#4a3a28',f:'sepia(.55)',w:400},
  foco:{n:'Foco',bg:'#fbf7e2',fg:'#2a2a2a',f:'sepia(.2)',w:400}
};
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const lsSet=(k,v)=>{
  try{
    const serialized=JSON.stringify(v),previous=localStorage.getItem(k);
    localStorage.setItem(k,serialized);

    if(previous!==serialized&&typeof cloudMarkDirty==='function'&&typeof user!=='undefined'&&user&&
       ['leitor:shelves:','leitor:hist:','leitor:reading-analytics:','leitor:vocab:']
         .some(prefix=>k===prefix+user))cloudMarkDirty('metadados');
  }catch(error){console.warn('Não foi possível salvar uma preferência local:',error)}
};
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+''+Math.random();

const hash=async s=>{try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return btoa(unescape(encodeURIComponent(s)))}};
const PIN_ITERATIONS=180000;
const hexFromBytes=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const bytesFromHex=str=>new Uint8Array((str.match(/../g)||[]).map(x=>parseInt(x,16)));
async function pinKey(name,pin,salt,iterations){
  if(!crypto.subtle)throw Error('Proteção do PIN exige HTTPS ou localhost.');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(name+':'+pin),'PBKDF2',false,['deriveBits']);
  return hexFromBytes(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,256)));
}
async function makePIN(name,pin){
  const salt=crypto.getRandomValues(new Uint8Array(16));return 'pbkdf2$'+PIN_ITERATIONS+'$'+hexFromBytes(salt)+'$'+await pinKey(name,pin,salt,PIN_ITERATIONS);
}
async function verifyPIN(name,pin,stored){
  if(!stored)return false;
  if(!stored.startsWith('pbkdf2$'))return await hash(name+pin)===stored;
  const m=/^pbkdf2\$(\d{5,7})\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored);
  if(!m)return false;
  const iter=Number(m[1]);if(iter<100000||iter>400000)return false;
  return await pinKey(name,pin,bytesFromHex(m[2]),iter)===m[3];
}
async function updateLegacyPIN(rec,pin){
  if(!rec?.pin||rec.pin.startsWith('pbkdf2$'))return;
  try{rec.pin=await makePIN(rec.name,pin);await tx('users','readwrite',st=>st.put(rec))}
  catch(e){console.warn('Não foi possível migrar o PIN legado',e)}
}
const toast=t=>{$('#toast')?.remove();const d=document.createElement('div');d.id='toast';d.setAttribute('role','status');d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),3500)};
const fmt=s=>{const m=Math.round(s/60);if(m<1)return'menos de 1 min';return m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min'};
