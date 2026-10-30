
const grpP=(p,t)=>{const g=document.createElement('div');g.className='grp';const l=document.createElement('div');l.className='lab';const tx=document.createElement('span');tx.textContent=t;l.append(tx);
  const c=document.createElement('div');c.className='card2';c._keys=new Set();
  const rb=document.createElement('button');rb.className='rst';rb.textContent='Restaurar padrão';rb.hidden=true;rb.onclick=()=>{[...c._keys].forEach(k=>{S[k]=DEF[k]});apply();tab()};l.append(rb);c._rb=rb;
  g.append(l,c);p.append(g);return c};
const wrap=(...n)=>{const d=document.createElement('div');d.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end';d.append(...n);return d};
function themeGrid(){const th=document.createElement('div');th.className='themes';
  Object.entries(THEMES).forEach(([k,t])=>{const b=document.createElement('button');b.dataset.t=k;b.setAttribute('aria-label',t.n);
    b.innerHTML='<span class="aa">Aa</span><small></small>';b.children[1].textContent=t.n;b.style.cssText=`background:${t.bg};color:${t.fg}`;b.children[0].style.fontWeight=t.w;
    b.onclick=()=>{S.theme=k;apply()};th.append(b)});return th}
let curTab='Conta',cfgSearchId=0;

const TABS=[['Conta',paneConta],['Aparência',paneApar],['Leitura',paneLeit],['Biblioteca',paneBib],['Vocabulário',(...args)=>paneVocab(...args)],['Dados',(...args)=>paneDados(...args)]];
const CFG_DESCRIPTIONS={
  'Conta':'Personalize seu perfil e gerencie sua segurança.',
  'Aparência':'Escolha como o Lector aparece em suas telas.',
  'Leitura':'Configure a experiência de leitura para cada formato.',
  'Biblioteca':'Organize a página inicial, seus livros e suas estantes.',
  'Vocabulário':'Gerencie suas palavras salvas e as revisões.',
  'Dados':'Instalação, armazenamento, atualizações e backup.'
};
const CFG_GROUPS=[['PREFERÊNCIAS',['Aparência','Leitura','Biblioteca','Vocabulário']],['SUA CONTA',['Conta','Dados']]];
const CFG_ICONS={
  'Conta':'user','Aparência':'palette','Leitura':'book-open','Biblioteca':'library','Vocabulário':'type','Dados':'database'
};
function configIntro(section){
  const d=document.createElement('div');d.className='cfg-intro';
  const h=document.createElement('h2');h.textContent=section;
  const info=document.createElement('p');info.textContent=CFG_DESCRIPTIONS[section]||'';
  d.append(h,info);return d;
}
function tab(n){
  if($('#cfg').hidden){renderLT();return}
  const sq=$('#cfq').value.trim();if(sq&&!n){searchCfg(sq);return}
  ++cfgSearchId;
  const changed=n&&n!==curTab;curTab=n||curTab;const nav=$('#tabs');
  nav.replaceChildren();
  CFG_GROUPS.forEach(([heading,names])=>{
    const group=document.createElement('div');group.className='cfg-nav-group';
    const lab=document.createElement('span');lab.className='cfg-nav-label';lab.textContent=heading;group.append(lab);
    names.forEach(k=>{
      const b=document.createElement('button');b.type='button';b.dataset.tab=k;
      b.className=k===curTab?'on':'';b.setAttribute('aria-current',k===curTab?'page':'false');
      const ic=document.createElement('span');ic.className='cfg-tab-icon';ic.setAttribute('aria-hidden','true');ic.append(navIcon(CFG_ICONS[k]));
      const txt=document.createElement('span');txt.textContent=k;b.append(ic,txt);
      b.onclick=()=>{$('#cfq').value='';tab(k)};group.append(b);
    });nav.append(group);
  });
  nav.onscroll=fadeTabs;fadeTabs();
  const p=$('#pane');p.classList.toggle('account-profile',curTab==='Conta');p.replaceChildren(configIntro(curTab));
  TABS.find(t=>t[0]===curTab)[1](p);
  if(changed)$('#cfg').scrollTo({top:0});refreshChg();
}
const fadeTabs=()=>{const n=$('#tabs');n.classList.toggle('fade',n.scrollWidth>n.clientWidth+4&&n.scrollLeft+n.clientWidth<n.scrollWidth-4)};
async function setAv(o){
  uRec.av=Object.assign({},uRec.av,o);
  await tx('users','readwrite',s=>s.put(uRec));
  for(const sel of ['#av','#avpreview','#profileHeroAvatar'])avEl($(sel),uRec);
  tab();
}
async function uploadAvatar(file){
  if(!file)return;
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))return toast('Escolha uma foto JPG, PNG ou WebP');
  if(file.size>8*1024*1024)return toast('A foto deve ter no máximo 8 MB');
  const src=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=src;await img.decode();
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas indisponível');
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    if(!side)throw Error('Imagem vazia');
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);
    const photo=c.toDataURL('image/jpeg',.85);
    await setAv({photo:photo,e:''});
    toast('Foto de perfil atualizada');
  }catch(e){console.error(e);toast('Não foi possível usar esta imagem')}
  finally{URL.revokeObjectURL(src)}
}
async function chkPin(msg){if(!uRec.pin)return true;const c=prompt(msg||'Digite seu PIN atual:');if(c==null)return false;
  try{if(!await verifyPIN(user,c,uRec.pin)){toast('PIN incorreto');return false}await updateLegacyPIN(uRec,c)}
  catch(e){toast('Não foi possível verificar o PIN');return false}return c}
async function renameUser(n){n=n.trim();if(!n||n===user)return;
  if(await tx('users','readonly',s=>s.get(n)))return toast('Já existe um perfil com esse nome');
  const pin=await chkPin('Digite seu PIN atual para confirmar:');if(pin===false)return;
  const old=user,bs=await userBooks();for(const b of bs){b.user=n;await saveBook(b)}
  const rec={...uRec,name:n,pin:uRec.pin?await makePIN(n,pin):''};
  await tx('users','readwrite',s=>s.put(rec));await tx('users','readwrite',s=>s.delete(old));
  for(const k of ['cfg','hist','reading-analytics','shelves','vocab','read-presets']){const v=lsGet(`leitor:${k}:${old}`);if(v!=null)lsSet(`leitor:${k}:${n}`,v);try{localStorage.removeItem(`leitor:${k}:${old}`)}catch{}}
  user=n;uRec=rec;avEl($('#av'),uRec);avEl($('#avpreview'),uRec);$('#avn').textContent=user;toast('Nome alterado');tab()}
async function setPin(){const c=await chkPin();if(c===false)return;const n=prompt('Novo PIN (4+ dígitos):');if(n==null)return;
  if(!/^\d{4,}$/.test(n))return toast('O PIN precisa ter 4 ou mais dígitos');uRec.pin=await makePIN(user,n);await tx('users','readwrite',s=>s.put(uRec));toast('PIN salvo');tab()}
async function rmPin(){if((await chkPin())===false)return;uRec.pin='';await tx('users','readwrite',s=>s.put(uRec));toast('PIN removido');tab()}
async function delProfile(){if(!confirm('Excluir o perfil "'+user+'" e todos os livros dele? Isso não pode ser desfeito.'))return;if((await chkPin())===false)return;
  await deleteEntireLocalProfile(user);
  for(const k of ['cfg','hist','reading-analytics','shelves','vocab','read-presets'])try{localStorage.removeItem(`leitor:${k}:${user}`)}catch{}
  user=null;uRec=null;S=Object.assign({},DEF);appApply();showLogin()}
function paneConta(p){
  p.classList.add('account-profile');
  const section=(title,subtitle,kind='')=>{
    const card=grpP(p,title);
    const holder=card.parentElement;
    if(kind)holder.classList.add(kind);
    if(subtitle){const hint=document.createElement('p');hint.className='account-section-hint';hint.textContent=subtitle;holder.querySelector('.lab').after(hint)}
    return card;
  };
  const label=(title,desc)=>{
    const d=document.createElement('div');d.className='account-field-label';
    const t=document.createElement('strong');t.textContent=title;d.append(t);
    if(desc){const note=document.createElement('small');note.textContent=desc;d.append(note)}
    return d;
  };
  const action=(title,fn,cls)=>{const b=mbtn(title,fn,cls);b.type='button';return b};

  let g=section('Perfil de leitura','Identidade e informações deste perfil no dispositivo.','account-profile-group');
  const hero=document.createElement('div');hero.className='profile-editor account-searchable';
  const pv=document.createElement('div');pv.id='profileHeroAvatar';pv.className='av';avEl(pv,uRec);
  const info=document.createElement('div');info.className='profile-editor-data';
  const name=document.createElement('strong');name.textContent=user;
  const sub=document.createElement('small');sub.textContent='Seu espaço pessoal de leitura';
  const status=document.createElement('span');status.className='account-local-pill';status.textContent='Perfil neste dispositivo';
  const actions=document.createElement('div');actions.className='profile-actions';
  const pick=document.createElement('input');pick.type='file';pick.accept='image/jpeg,image/png,image/webp,image/gif';pick.hidden=true;pick.setAttribute('aria-label','Escolher foto de perfil');
  pick.onchange=async()=>{const f=pick.files?.[0];pick.value='';if(f)await uploadAvatar(f)};
  const choose=action('Escolher foto',()=>pick.click(),'primary');
  const clear=action('Remover foto',()=>setAv({photo:''}));clear.hidden=!(uRec.av||{}).photo;
  actions.append(choose,clear,pick);info.append(name,sub,status,actions);hero.append(pv,info);g.append(hero);
  const nameRow=document.createElement('div');nameRow.className='account-name-section account-searchable';
  const nameInfo=label('Nome do perfil','Exibido na biblioteca e na escolha de perfis.');
  const ni=document.createElement('input');ni.type='text';ni.value=user;ni.maxLength=24;ni.setAttribute('aria-label','Nome do perfil');ni.autocomplete='off';
  const saveName=action('Salvar alterações',()=>renameUser(ni.value),'primary');
  ni.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveName.click()}};
  const nr=document.createElement('div');nr.className='profile-name-row';nr.append(ni,saveName);
  nameRow.append(nameInfo,nr);g.append(nameRow);

  g=section('Personalização do avatar','Escolha como seu perfil aparece no Lector.','account-avatar-group');
  const choice=document.createElement('div');choice.className='profile-choices';choice.setAttribute('role','group');choice.setAttribute('aria-label','Tipo de avatar');
  const currentMode=(uRec.av||{}).photo?'photo':(uRec.av||{}).e?'emoji':'initials';
  [['initials','Iniciais'],['emoji','Emoji'],['photo','Foto']].forEach(([mode,title])=>{
    const b=action(title,()=>{
      if(mode==='initials')setAv({photo:'',e:''});
      else if(mode==='photo')pick.click();
      else setAv({photo:'',e:(uRec.av||{}).e||'📚'});
    });b.classList.toggle('on',mode===currentMode);b.setAttribute('aria-pressed',String(mode===currentMode));choice.append(b);
  });
  const choiceRow=document.createElement('div');choiceRow.className='account-custom-row account-searchable';choiceRow.append(label('Tipo de avatar','Iniciais, um emoji ou uma fotografia.'),choice);g.append(choiceRow);

  const emojiWrap=document.createElement('details');emojiWrap.className='account-emoji-details';emojiWrap.open=currentMode==='emoji';
  const summary=document.createElement('summary');summary.textContent='Escolher emoji';emojiWrap.append(summary);
  const em=document.createElement('div');em.className='avatar-emoji-grid';
  ['📚','📖','🐉','🦊','🌙','☕','🎧','🌸','🚀','🐱','⚔️','🎮','🪐','⭐','💜','🦉','🐼','💻'].forEach(e=>{
    const b=action(e,()=>setAv({photo:'',e}));b.setAttribute('aria-label','Usar emoji '+e);
    b.classList.toggle('on',currentMode==='emoji'&&(uRec.av||{}).e===e);em.append(b);
  });
  const custom=document.createElement('div');custom.className='avatar-custom-emoji';
  const ei=document.createElement('input');ei.type='text';ei.placeholder='Outro emoji';ei.maxLength=12;ei.setAttribute('aria-label','Emoji personalizado');
  const use=action('Aplicar emoji',()=>{const v=ei.value.trim();if(!v)return toast('Digite um emoji');setAv({photo:'',e:Array.from(v).slice(0,8).join('')})},'primary');
  ei.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();use.click()}};
  custom.append(ei,use);em.append(custom);emojiWrap.append(em);
  const emojiRow=document.createElement('div');emojiRow.className='account-custom-row account-emoji-row account-searchable';emojiRow.append(emojiWrap);g.append(emojiRow);

  const cs=document.createElement('div');cs.className='avatar-color-picker';
  const presets=document.createElement('div');presets.className='sws';
  const colors=['#8a6a55','#4775d8','#2f7d57','#7c5cbf','#c2557a','#c2570c','#303540','#b8860b'];
  colors.forEach(c=>{const b=action('',()=>setAv({c}));b.style.background=c;b.setAttribute('aria-label','Cor '+c);b.title=c;
    b.classList.toggle('on',((uRec.av||{}).c||'#8a6a55').toLowerCase()===c);presets.append(b)});
  const ci=document.createElement('input');ci.type='color';ci.value=/^#[0-9a-f]{6}$/i.test((uRec.av||{}).c||'')?uRec.av.c:'#8a6a55';ci.setAttribute('aria-label','Escolher qualquer cor para o avatar');ci.title='Qualquer cor';
  const hex=document.createElement('code');hex.textContent=ci.value.toUpperCase();
  ci.oninput=()=>{hex.textContent=ci.value.toUpperCase();if(!(uRec.av||{}).photo)pv.style.background=ci.value};
  ci.onchange=()=>setAv({c:ci.value});
  cs.append(presets,ci,hex);
  const colorRow=document.createElement('div');colorRow.className='account-custom-row account-color-row account-searchable';colorRow.append(label('Cor do avatar','Utilizada nas iniciais e no fundo dos emojis.'),cs);g.append(colorRow);
  const help=document.createElement('p');help.className='profile-editor-note';help.textContent='As fotografias são recortadas e compactadas para 256 × 256 pixels. Elas permanecem armazenadas neste navegador.';g.append(help);

  g=section('Segurança','Proteção opcional de acesso a este perfil local.','account-security-group');
  const sec=document.createElement('div');sec.className='account-security-row account-searchable';
  const secInfo=document.createElement('div');secInfo.className='account-security-copy';
  const secStatus=document.createElement('span');secStatus.className='account-status '+(uRec.pin?'is-enabled':'');secStatus.textContent=uRec.pin?'PIN ativo':'PIN não configurado';
  secInfo.append(secStatus,label('PIN de acesso','Ajuda a proteger este perfil no dispositivo. Não substitui a senha da conta online.'));
  const secActions=document.createElement('div');secActions.className='account-security-actions';
  if(uRec.pin){secActions.append(action('Alterar PIN',setPin,'primary'),action('Remover PIN',rmPin))}
  else secActions.append(action('Definir PIN',setPin,'primary'));
  sec.append(secInfo,secActions);g.append(sec);

  g=section('Sessão do perfil','Controle de acesso a este perfil local.','account-logout-group');
  const leave=document.createElement('div');leave.className='account-security-row';
  const leaveLabel=label('Sair do perfil','Volta à seleção de perfis. Os livros e configurações permanecem salvos.');
  const leaveBtn=action('Sair deste perfil',()=>$('#out').click());
  leaveBtn.prepend(navIcon('log-out'));leaveBtn.classList.add('lector-icon-action');
  leave.append(leaveLabel,leaveBtn);g.append(leave);
  g=section('Zona de risco','Ações irreversíveis que afetam os dados locais.','account-danger-group');
  const danger=document.createElement('div');danger.className='account-danger-row account-searchable';
  const dangerCopy=label('Excluir perfil e livros locais','Remove este perfil e seus livros deste dispositivo. Faça um backup antes de continuar.');
  danger.append(dangerCopy,action('Excluir perfil',delProfile,'dg2'));g.append(danger);
}
function paneApar(p){
  let g=grpP(p,'Temas da interface');

  const modeBlock=document.createElement('div');modeBlock.className='lector-theme-mode';
  const modeTitle=document.createElement('strong');modeTitle.textContent='Modo de aparência';
  const modeInfo=document.createElement('p');modeInfo.textContent='Fixe Claro ou Escuro para manter essa aparência ao escolher qualquer paleta. “Seguir tema” mantém o comportamento anterior.';
  const modeButtons=document.createElement('div');modeButtons.className='lector-theme-mode-actions';
  modeButtons.setAttribute('role','group');modeButtons.setAttribute('aria-label','Modo de aparência');
  const modeOptions=[['theme','Seguir tema'],['light','Claro'],['dark','Escuro'],['auto','Sistema']];
  for(const [value,title] of modeOptions){
    const b=document.createElement('button');b.type='button';b.dataset.mode=value;b.textContent=title;
    b.setAttribute('aria-pressed',String((S.appMode||'theme')===value));
    b.onclick=()=>{S.appMode=value;apply();for(const button of modeButtons.children)button.setAttribute('aria-pressed',String(button.dataset.mode===value));};
    modeButtons.append(b);
  }
  modeBlock.append(modeTitle,modeInfo,modeButtons);g.append(modeBlock);g._keys.add('appMode');
  const paletteCollapse=document.createElement('details');paletteCollapse.className='lector-palette-collapse';
  const collapseSummary=document.createElement('summary');collapseSummary.className='lector-palette-summary';
  const summaryText=document.createElement('span');summaryText.className='lector-palette-summary-name';
  const summaryLabel=document.createElement('strong');summaryLabel.textContent='Escolher paleta de cores';
  const chosen=document.createElement('small');chosen.textContent='Atual: '+(APP_THEMES[S.app]?.label||'Automático')+' · 25 temas';
  summaryText.append(summaryLabel,chosen);
  const summaryChevron=document.createElement('span');summaryChevron.className='lector-palette-chevron';summaryChevron.setAttribute('aria-hidden','true');
  summaryChevron.textContent='⌄';collapseSummary.append(summaryText,summaryChevron);paletteCollapse.append(collapseSummary);

  const picker=document.createElement('div');picker.className='lector-theme-tools';
  const find=document.createElement('input');find.type='search';find.className='lector-theme-find';
  find.placeholder='Buscar entre os 25 temas';find.setAttribute('aria-label','Pesquisar temas da interface');
  const kinds=document.createElement('div');kinds.className='lector-theme-kinds';kinds.setAttribute('role','group');kinds.setAttribute('aria-label','Filtrar temas');
  let tone='all';
  const filters=[['all','Todos'],['dark','Escuros'],['light','Claros']];
  const count=document.createElement('p');count.className='lector-theme-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
  const grid=document.createElement('div');grid.className='app-theme-grid';grid.dataset.k='app';
  const noResults=document.createElement('p');noResults.className='lector-theme-empty';noResults.textContent='Nenhum tema encontrado. Tente outra palavra.';noResults.hidden=true;
  const refreshFilter=()=>{
    const search=find.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    let visible=0;
    for(const card of grid.children){
      const matchesName=card.dataset.search.includes(search);
      const matchesTone=tone==='all'||card.dataset.tone===tone||card.dataset.themeKey==='auto';
      card.hidden=!(matchesName&&matchesTone);
      if(!card.hidden)visible++;
    }
    count.textContent=visible+' de '+Object.keys(APP_THEMES).length+' temas';
    noResults.hidden=visible!==0;
    for(const button of kinds.children){button.setAttribute('aria-pressed',String(button.dataset.tone===tone));}
  };
  for(const [key,title] of filters){const b=document.createElement('button');b.type='button';b.dataset.tone=key;b.textContent=title;b.onclick=()=>{tone=key;refreshFilter()};kinds.append(b)}
  find.addEventListener('input',refreshFilter);
  picker.append(find,kinds);
  paletteCollapse.append(picker,count);

  Object.entries(APP_THEMES).forEach(([k,v])=>{
    const b=document.createElement('button');b.type='button';b.className='app-theme-choice';
    b.classList.toggle('on',S.app===k);b.setAttribute('aria-pressed',String(S.app===k));
    b.title=v.label;b.setAttribute('aria-label','Tema '+v.label);
    b.dataset.themeKey=k;b.dataset.tone=k==='auto'?'auto':(v.dark?'dark':'light');
    b.dataset.search=(v.label+' '+k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    b.style.setProperty('--theme-bg',v.preview);b.style.setProperty('--theme-text',v.fg);
    b.style.setProperty('--theme-card',v.card);b.style.setProperty('--theme-stroke',v.border);
    const preview=document.createElement('span');preview.className='theme-preview';preview.setAttribute('aria-hidden','true');
    const dots=document.createElement('span');dots.className='theme-palette';
    (v.palette||[]).forEach(c=>{const dot=document.createElement('i');dot.style.background=c;dots.append(dot)});
    const name=document.createElement('span');name.className='theme-title';name.textContent=v.label;
    const themeDescriptions={auto:'Segue a aparência do dispositivo',light:'Leve e iluminado',dark:'Confortável para ler',nord:'Azuis frios e suaves',dracula:'Roxo com contraste',tokyo:'Azul noturno e violeta',sepia:'Tons quentes de papel',ocean:'Azul profundo e sereno',forest:'Verde natural',plum:'Violeta e ameixa',graphite:'Cinza minimalista',
      'cat-mocha':'Pastéis suaves sobre fundo escuro',
      'cat-latte':'Pastéis claros e delicados',
      'gruv-dark':'Cores quentes de inspiração retrô',
      'gruv-light':'Visual retrô em papel claro',
      'sol-dark':'Contraste suave em azul-petróleo',
      'sol-light':'Paleta solarizada de leitura clara',
      'one-dark':'Elegância de editor de código',
      'everforest':'Verde natural e contraste moderado',
      'rose-pine':'Tons suaves de rosa e lavanda',
      'ayu-mirage':'Âmbar discreto e azul noturno',
      'monokai':'Contraste clássico e vibrante',
      'kanagawa':'Azul japonês e tons naturais',
      'palenight':'Violeta noturno com azul suave',
      'github-dark':'Neutro escuro e muito legível'};
    const detail=document.createElement('span');detail.className='lector-theme-detail';detail.textContent=themeDescriptions[k]||'Paleta personalizada';
    preview.append(dots);b.append(preview,name,detail);b.onclick=()=>{
      S.app=k;apply();chosen.textContent='Atual: '+v.label+' · 25 temas';
      for(const el of grid.children){const selected=el.dataset.themeKey===k;el.classList.toggle('on',selected);el.setAttribute('aria-pressed',String(selected));}
    };grid.append(b);
  });paletteCollapse.append(grid,noResults);g.append(paletteCollapse);refreshFilter();g._keys.add('app');
  g=grpP(p,'Personalização');
  const accentBox=document.createElement('div');accentBox.className='accent-control';accentBox.dataset.k='accent';
  const sw2=document.createElement('div');sw2.className='sws accent-swatches';
  for(const [k,v] of Object.entries(ACC)){
    if(k==='custom')continue;
    const b=document.createElement('button');b.type='button';b.style.background=v[0];b.setAttribute('aria-label','Cor '+k);
    b.title='Cor '+k;b.classList.toggle('on',S.accent===k);b.setAttribute('aria-pressed',String(S.accent===k));
    b.onclick=()=>{S.accent=k;apply();tab()};sw2.append(b);
  }
  const custom=document.createElement('label');custom.className='accent-custom'+(S.accent==='custom'?' on':'');custom.title='Escolher cor personalizada';
  const cp=document.createElement('input');cp.type='color';cp.value=VALID_HEX.test(S.accentCustom||'')?S.accentCustom:'#9575ef';cp.setAttribute('aria-label','Escolher cor de destaque personalizada');
  const customIcon=document.createElement('span');customIcon.setAttribute('aria-hidden','true');customIcon.textContent='+';custom.append(cp,customIcon);
  const colorHex=document.createElement('output');colorHex.className='accent-hex';colorHex.textContent=(S.accent==='custom'?cp.value:(ACC[S.accent]||ACC.marrom)[0]).toUpperCase();
  cp.oninput=()=>{S.accent='custom';S.accentCustom=cp.value;apply();
    colorHex.textContent=cp.value.toUpperCase();custom.classList.add('on');
    sw2.querySelectorAll('button').forEach(b=>{b.classList.remove('on');b.setAttribute('aria-pressed','false')});refreshChg()};
  sw2.append(custom);accentBox.append(sw2,colorHex);
  ctl(g,'Cor de destaque',accentBox);g._keys.add('accentCustom');
  ctl(g,'Aplicar visual de vidro',sw('glass',true));
  const glassHelp=document.createElement('p');glassHelp.className='glass-explain';glassHelp.textContent='Transparência, reflexos suaves e desfoque nos painéis. Você pode desligar o efeito para priorizar o contraste.';g.append(glassHelp);
  const reset=mbtn('Restaurar aparência padrão',()=>{for(const key of ['app','appMode','accent','accentCustom','glass'])S[key]=DEF[key];apply();tab()});
  reset.classList.add('appearance-reset');g.append(reset);
  ctl(g,'Densidade',seg('dens',[['comfy','Confortável'],['compact','Compacta']]));
  ctl(g,'Tamanho do texto da interface',range('ui',85,125,5,v=>v+'%'));
  ctl(g,'Idioma',seg('lang',[['pt','Português'],['en','English']]));
}
function paneLeit(p){
  const pv=document.createElement('div');pv.id='prev';pv.className='prev';pv.lang='pt-BR';
  pv.innerHTML='<div class="pvi"><h4>Capítulo 1</h4><p>Era uma tarde clara quando a biblioteca abriu as portas. Entre prateleiras de madeira e o cheiro de papel antigo, Maria escolheu um livro ao acaso e se deixou levar pelas primeiras linhas, como quem volta para casa. Cada capítulo parecia respirar no mesmo ritmo que ela.</p></div><small class="pvl">Prévia ao vivo</small>';
  p.append(pv);paintPreview();
  let g=grpP(p,'Padrões de leitura');
  ctl(g,'Modo',seg('mode',[['page','Página'],['scroll','Rolagem']]));ctl(g,'Ajustar à',seg('fit',[['auto','Tela'],['width','Largura']]));
  ctl(g,'Mangá (direita → esquerda)',sw('rtl',true));ctl(g,'Duas páginas lado a lado',sw('two',true));ctl(g,'Capa em página separada',sw('cov1',true));ctl(g,'Zoom',range('size',50,300,10,v=>v+'%'));
  ctl(g,'Brilho',range('bri',.2,1,.05,v=>Math.round(v*100)+'%',light));ctl(g,'Luz quente',range('warm',0,60,5,v=>v?v+'%':'off',light));
  ctl(g,'Aplicar o tema à página (PDF e imagens)',sw('pf',true));ctl(g,'Brilho da página',range('pbr',.5,1,.05,v=>Math.round(v*100)+'%',()=>{document.documentElement.style.setProperty('--pbr',S.pbr);light()}));
  ctl(g,'Fundo da leitura',bgCtl());g.append(themeGrid());g._keys.add('theme');
  g=grpP(p,'Texto');ctl(g,'Fonte',seg('font',[['serif','Serifa'],['sans','Sem serifa'],['mono','Mono']]));
  ctl(g,'Espaçamento',seg('lh',[[1.4,'Compacto'],[1.7,'Normal'],[2,'Amplo']]));ctl(g,'Justificar texto',sw('just',true));ctl(g,'Hifenização',sw('hy',true));ctl(g,'Margens',range('mg',16,120,8,v=>v+'px'));
  g=grpP(p,'Geral');ctl(g,'Manter a tela ligada',sw('awake',true));ctl(g,'Toque nas bordas',sw('edges',true));ctl(g,'Relógio e bateria',sw('clock',true));
  g=grpP(p,'Dicionário e tradução');ctl(g,'Idioma do texto',selEl('dictLang',LANGS));ctl(g,'Traduzir para',selEl('trLang',LANGS));
  apply();
}
const afterShelf=()=>$('#cfg').hidden?showLib():tab();
async function renShelf(o,n){n=n.trim();if(!n||n===o)return;for(const b of await userBooks())if((b.sh||[]).includes(o)){b.sh=b.sh.map(x=>x===o?n:x);await saveBook(b)}setShelves(shelves().map(x=>x===o?n:x));if(flt==='sh:'+o)flt='sh:'+n;afterShelf()}
async function delShelf(o){for(const b of await userBooks())if((b.sh||[]).includes(o)){b.sh=b.sh.filter(x=>x!==o);await saveBook(b)}setShelves(shelves().filter(x=>x!==o));if(flt==='sh:'+o)flt='all';afterShelf()}
function paneBib(p){
  let g=grpP(p,'Tela inicial');
  [['sCont','Continuar lendo'],['sGoal','Meta do dia'],['sSeries','Continue a série'],['sAlmost','Quase terminando'],['sRecent','Adicionados recentemente'],['sShelves','Estantes e favoritos'],['sStats','Números da biblioteca'],['sNotes','Últimas anotações'],['sVocab','Cartão de vocabulário'],['sOnb','Comece por aqui']].forEach(([k,l])=>ctl(g,l,sw(k)));
  g=grpP(p,'Visualização');ctl(g,'Visualização',seg('view',[['grid','Grade'],['list','Lista']]));ctl(g,'Tamanho das capas',range('cover',110,240,10,v=>v+'px'));
  const so=document.createElement('select');so.className='sel glass';so.setAttribute('aria-label','Ordenação padrão');
  [['recent','Recentes'],['title','Título'],['prog','Progresso'],['author','Autor'],['added','Data de adição']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;so.append(o)});
  so.value=S.sort;so.onchange=()=>{S.sort=so.value;light()};ctl(g,'Ordenação padrão',so);
  g=grpP(p,'Estantes');
  if(!shelves().length){const n=document.createElement('p');n.className='note';n.textContent='Nenhuma estante ainda.';g.append(n)}
  shelves().forEach(n=>{ctl(g,n,wrap(mbtn('Renomear',()=>{const v=prompt('Novo nome:',n);if(v!=null)renShelf(n,v)}),mbtn('Remover',()=>{if(confirm('Remover a estante "'+n+'"? Os livros continuam na biblioteca.'))delShelf(n)},'dg2')))});
  const ni=document.createElement('input');ni.type='text';ni.placeholder='Nome da estante';ni.maxLength=30;ni.setAttribute('aria-label','Nome da estante');
  const nr=document.createElement('div');nr.style.cssText='display:flex;gap:8px;flex:1';nr.append(ni,mbtn('Criar',()=>{if(addShelf(ni.value))tab()},'primary'));ctl(g,'Criar uma estante',nr);
  g=grpP(p,'Organização');
  ctl(g,'Limpar nomes (tira (PT), [...], sublinhados)',mbtn('Limpar nomes',async()=>{const bs=await userBooks();let n=0;
    for(const b of bs){const t=cleanTitle(b.title);if(t!==b.title){b.title=t;await saveBook(b);n++}}toast(n+' nome(s) limpo(s)')}));
}

const STAT_ICONS={
 'Tempo acumulado':'clock', 'Livros concluídos':'check', 'Dias ativos (≥ 1 min)':'calendar',
 'Sequência atual':'activity', 'Média por dia ativo':'target', 'Em andamento':'book-open',
 'Tempo no período':'clock','Dias de leitura':'calendar','Metas diárias atingidas':'target','Melhor dia':'activity'
};
function createMetricTile(value,label){
 const tile=document.createElement('div');tile.className='analytics-tile';
 const icon=document.createElement('div');icon.className='metric-icon';icon.append(navIcon(STAT_ICONS[label]||'chart'));
 const valueNode=document.createElement('b');valueNode.textContent=value;
 const labelNode=document.createElement('span');labelNode.textContent=label;
 tile.append(icon,valueNode,labelNode);tile.setAttribute('aria-label',label+': '+value);
 return tile;
}
async function paneEst(p){
 const currentUser=user,x=hist(),bs=await userBooks();if(curTab!=='Estatísticas'||user!==currentUser)return;
 const analytics=readAnalytics();
 const historicalSeconds=Object.values(x).reduce((a,b)=>a+Math.max(0,Number(b)||0),0);
 const activeDays=Object.values(x).filter(s=>s>=60).length;
 const first=grpP(p,'Visão geral'),intro=document.createElement('p');intro.className='analytics-intro';
 intro.textContent='Seu histórico permanece salvo neste dispositivo. O LECTOR registra o tempo por livro e as sessões de leitura.';first.append(intro);
 const overview=document.createElement('div');overview.className='analytics-highlights';
 for(const [value,label] of [
   [historicalSeconds?fmt(historicalSeconds):'—','Tempo acumulado'],
   [bs.filter(isDone).length,'Livros concluídos'],
   [activeDays,'Dias ativos (≥ 1 min)'],
   [streak(x),'Sequência atual'],
   [activeDays?fmt(historicalSeconds/activeDays):'—','Média por dia ativo'],
   [bs.filter(b=>b.f>0&&!isDone(b)).length,'Em andamento']]){
   overview.append(createMetricTile(value,label));
 }first.append(overview);

 const target=statsWeekGoal(),weekToday=new Date(),monday=new Date(weekToday.getFullYear(),weekToday.getMonth(),weekToday.getDate());
 monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const weekDays=Array.from({length:7},(_,i)=>new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+i));
 const weekSeconds=weekDays.reduce((sum,d)=>sum+Math.max(0,Number(x[dk(d)])||0),0);
 const weekProgress=Math.min(100,weekSeconds/(target*60)*100);
 const weekly=grpP(p,'Meta semanal'),weekCard=document.createElement('div');weekCard.className='analytics-goal';
 const weekHead=document.createElement('div');weekHead.className='analytics-goal-head';
 const weekCopy=document.createElement('div'),wTitle=document.createElement('b'),wDesc=document.createElement('span');
 wTitle.textContent=fmt(weekSeconds)+' de '+fmt(target*60);
 wDesc.textContent='De segunda a domingo · '+Math.round(weekProgress)+'% da meta';weekCopy.append(wTitle,wDesc);
 const weekPct=document.createElement('strong');weekPct.textContent=Math.round(weekProgress)+'%';weekHead.append(weekCopy,weekPct);
 const track=document.createElement('div');track.className='analytics-goal-track';track.setAttribute('role','progressbar');
 track.setAttribute('aria-label','Progresso da meta semanal');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.round(weekProgress)));
 const fill=document.createElement('div');fill.style.width=weekProgress+'%';track.append(fill);
 const form=document.createElement('div');form.className='analytics-goal-controls';
 const inputLabel=document.createElement('label');inputLabel.textContent='Meta semanal (min)';inputLabel.htmlFor='analytics-week-target';
 const goalInput=document.createElement('input');goalInput.id='analytics-week-target';goalInput.type='number';goalInput.min='5';goalInput.max='4200';goalInput.step='5';goalInput.value=String(target);goalInput.setAttribute('aria-label','Meta de leitura semanal em minutos');
 const saveGoal=mbtn('Salvar meta',()=>{
   const n=Number(goalInput.value);
   if(!Number.isInteger(n)||n<5||n>4200)return toast('Escolha entre 5 e 4200 minutos por semana.');
   S.weekGoal=n;light();renderLT();toast('Meta semanal atualizada.');
 },'primary');
 const resetGoal=mbtn('Automática',()=>{S.weekGoal=0;light();renderLT();toast('Meta semanal vinculada à meta diária.')});
 form.append(inputLabel,goalInput,saveGoal,resetGoal);
 const hint=document.createElement('p');hint.className='analytics-note';
 hint.textContent='A meta automática é 7 × sua meta diária atual. Alterações são guardadas nas preferências deste perfil.';
 weekCard.append(weekHead,track,form,hint);weekly.append(weekCard);
 const group=grpP(p,'Atividade por período'),picker=document.createElement('div');picker.className='analytics-range';picker.setAttribute('role','group');picker.setAttribute('aria-label','Período das estatísticas');
 const area=document.createElement('div');group.append(picker,area);
 const drawRange=()=>{
   picker.replaceChildren();
   for(const [n,label] of [[7,'7 dias'],[30,'30 dias'],[90,'90 dias'],[365,'365 dias']]){
     const b=mbtn(label,()=>{statsRange=n;drawRange()});b.classList.toggle('on',statsRange===n);b.setAttribute('aria-pressed',String(statsRange===n));picker.append(b);
   }
   area.replaceChildren();
   const now=new Date(),days=Array.from({length:statsRange},(_,i)=>{
     const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(statsRange-1-i));
     return {date:d,key:dk(d),seconds:Number(x[dk(d)])||0};
   });
   const total=days.reduce((a,d)=>a+d.seconds,0),active=days.filter(d=>d.seconds>=60).length;
   const goal=Math.max(1,Number(S.goal)||30)*60,met=days.filter(d=>d.seconds>=goal).length;
   const best=days.reduce((a,b)=>b.seconds>a.seconds?b:a,days[0]);
   const summary=document.createElement('div');summary.className='analytics-highlights';
   for(const [val,label] of [[fmt(total),'Tempo no período'],[active,'Dias de leitura'],[met+' / '+statsRange,'Metas diárias atingidas'],[best.seconds?fmt(best.seconds):'—','Melhor dia']]){
     summary.append(createMetricTile(val,label));
   }area.append(summary);
   const previous=Array.from({length:statsRange},(_,i)=>{
     const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-statsRange*2+1+i);
     return Number(x[dk(d)])||0;
   }).reduce((a,b)=>a+b,0);
   const diff=document.createElement('p');diff.className='analytics-note';
   diff.textContent=previous>0?('Período anterior: '+fmt(previous)+' · '+(total>=previous?'+':'')+Math.round((total-previous)/previous*100)+'% de variação'):'Sem dados suficientes no período anterior para comparação.';
   area.append(diff);
   const chart=document.createElement('div');chart.className='analytics-chart';chart.setAttribute('role','img');
   const aggregate=statsRange===365;
   const buckets=aggregate?(()=>{
     const months=new Map();
     for(const d of days){const k=d.key.slice(0,7);if(!months.has(k))months.set(k,{seconds:0,label:d.date.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),key:k});months.get(k).seconds+=d.seconds}
     return [...months.values()];
   })():days.map(d=>({...d,label:''}));
   chart.setAttribute('aria-label',aggregate?'Tempo de leitura agrupado por mês nos últimos 365 dias':'Tempo de leitura por dia do período');
   const max=Math.max(60,...buckets.map(d=>d.seconds));
   buckets.forEach((day,i)=>{
     const col=document.createElement('div');col.className='analytics-day';
     col.title=(aggregate?day.label:day.date.toLocaleDateString('pt-BR'))+' — '+fmt(day.seconds);
     const v=document.createElement('i');v.style.height=Math.max(3,Math.round(day.seconds/max*115))+'px';
     const label=document.createElement('small');label.textContent=aggregate?day.label:(statsRange===7||i%(statsRange===30?5:15)===0?String(day.date.getDate()).padStart(2,'0'):'');
     col.append(v,label);chart.append(col);
   });area.append(chart);
   const note=document.createElement('p');note.className='analytics-note';
   note.textContent='As metas são comparadas ao objetivo atual de '+(S.goal||30)+' minutos por dia. Registros antigos continuam sendo considerados nos totais.';area.append(note);
   const top=document.createElement('div');top.className='analytics-top';
   const times=new Map();for(const d of days){const by=analytics.days[d.key]?.books||{};
     for(const [id,s] of Object.entries(by))times.set(id,(times.get(id)||0)+s);
   }
   const ranked=[...times.entries()].filter(([,s])=>s>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
   const label=document.createElement('h4');label.textContent='Livros mais lidos no período';label.className='rh';label.style.margin='18px 0 4px';area.append(label);
   if(!ranked.length){const empty=document.createElement('p');empty.className='analytics-note';empty.textContent='O tempo por livro fica disponível para sessões registradas recentemente. As leituras anteriores continuam no histórico diário.';area.append(empty)}
   else{for(const [id,s] of ranked){const b=bs.find(b=>b.id===id);const line=document.createElement('div');line.className='analytics-book';const name=document.createElement('strong');name.textContent=b?.title||'Livro não disponível neste dispositivo';name.title=name.textContent;const time=document.createElement('span');time.textContent=fmt(s);line.append(name,time);top.append(line)}area.append(top)}
 };
 drawRange();

 const trends=grpP(p,'Tendências e hábitos');
 const trendText=document.createElement('p');trendText.className='analytics-intro';
 trendText.textContent='Evolução dos últimos 6 meses, usando o histórico diário. As sessões por livro dependem da disponibilidade dos registros detalhados.';trends.append(trendText);
 const months=[],monthNow=new Date();
 for(let shift=5;shift>=0;shift--){
   const dt=new Date(monthNow.getFullYear(),monthNow.getMonth()-shift,1);
   const key=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
   const seconds=Object.entries(x).reduce((sum,[day,n])=>sum+(day.startsWith(key+'-')?Math.max(0,Number(n)||0):0),0);
   months.push({label:dt.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),seconds});
 }
 const mTitle=document.createElement('h4');mTitle.className='analytics-subtitle';mTitle.textContent='Tempo de leitura por mês';trends.append(mTitle);
 const monthlyChart=document.createElement('div');monthlyChart.className='analytics-mini-chart';monthlyChart.setAttribute('role','img');
 monthlyChart.setAttribute('aria-label','Comparação do tempo de leitura nos últimos seis meses');
 const monthMax=Math.max(60,...months.map(m=>m.seconds));
 months.forEach(m=>{
   const col=document.createElement('div');col.className='analytics-mini-col';col.title=m.label+' — '+fmt(m.seconds);
   const n=document.createElement('span');n.textContent=m.seconds?fmt(m.seconds):'—';
   const rail=document.createElement('div');rail.className='analytics-mini-rail';
   const fill=document.createElement('i');fill.style.height=(m.seconds?Math.max(4,m.seconds/monthMax*100):0)+'%';rail.append(fill);
   const label=document.createElement('small');label.textContent=m.label;col.append(n,rail,label);monthlyChart.append(col);
 });trends.append(monthlyChart);
 const habitsTitle=document.createElement('h4');habitsTitle.className='analytics-subtitle';habitsTitle.textContent='Média por dia da semana · últimas 12 semanas';trends.append(habitsTitle);
 const weekdayStats=Array.from({length:7},()=>({sum:0,days:0}));
 const base=new Date();
 for(let i=0;i<84;i++){
   const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()-i),day=(d.getDay()+6)%7;
   weekdayStats[day].sum+=Math.max(0,Number(x[dk(d)])||0);weekdayStats[day].days++;
 }
 const weekdays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
 const averages=weekdayStats.map(w=>w.days?w.sum/w.days:0),high=Math.max(60,...averages);
 const habitChart=document.createElement('div');habitChart.className='analytics-mini-chart analytics-week-chart';habitChart.setAttribute('role','img');
 habitChart.setAttribute('aria-label','Média de leitura por dia da semana, incluindo dias sem leitura');
 averages.forEach((seconds,i)=>{
   const col=document.createElement('div');col.className='analytics-mini-col';col.title=weekdays[i]+' — média '+fmt(seconds);
   const n=document.createElement('span');n.textContent=Math.round(seconds/60)+' min';
   const rail=document.createElement('div');rail.className='analytics-mini-rail';
   const fill=document.createElement('i');fill.style.height=(seconds?Math.max(4,seconds/high*100):0)+'%';rail.append(fill);
   const l=document.createElement('small');l.textContent=weekdays[i];col.append(n,rail,l);habitChart.append(col);
 });trends.append(habitChart);
 const habitsNote=document.createElement('p');habitsNote.className='analytics-note';
 habitsNote.textContent='A média por dia da semana inclui os dias sem leitura e não representa velocidade ou atenção na leitura.';trends.append(habitsNote);

 const sessionsGroup=grpP(p,'Sessões recentes');
 const sessionsHint=document.createElement('p');sessionsHint.className='analytics-intro';
 sessionsHint.textContent='Registro local das últimas 400 sessões, quando disponíveis. A lista mostra as 12 mais recentes; leituras sem sessões detalhadas podem não aparecer.';
 sessionsGroup.append(sessionsHint);
 const recent=[...analytics.sessions].filter(s=>Number.isFinite(s.seconds)&&s.seconds>0&&Number.isFinite(Date.parse(s.ended))).sort((a,b)=>Date.parse(b.ended)-Date.parse(a.ended)).slice(0,12);
 const sessionsList=document.createElement('div');sessionsList.className='analytics-sessions';
 for(const session of recent){
   const info=bs.find(b=>b.id===session.book),row=document.createElement('div');row.className='analytics-session';
   const text=document.createElement('div'),name=document.createElement('b'),timestamp=document.createElement('small'),duration=document.createElement('strong');
   name.textContent=info?.title||'Livro indisponível neste dispositivo';
   timestamp.textContent=new Date(session.ended).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
   duration.textContent=fmt(session.seconds);text.append(name,timestamp);row.append(text,duration);sessionsList.append(row);
 }
 if(!recent.length){const none=document.createElement('p');none.className='analytics-note';none.textContent='Nenhuma sessão detalhada registrada por enquanto. Abra um livro e leia para começar.';sessionsList.append(none)}
 sessionsGroup.append(sessionsList);
 const exports=grpP(p,'Exportação das estatísticas');
 const exportText=document.createElement('p');exportText.className='analytics-intro';exportText.textContent='Baixe os dados como CSV para abrir em planilhas. O histórico diário e as sessões são exportados separadamente; nenhum dado é enviado a servidores.';exports.append(exportText);
 const actions=document.createElement('div');actions.className='analytics-export-actions';
 actions.append(mbtn('Exportar histórico diário (CSV)',statsExportDaily,'primary'),mbtn('Exportar sessões (CSV)',statsExportSessions));exports.append(actions);
 const activity=grpP(p,'Calendário de leitura');
 const caption=document.createElement('p');caption.className='analytics-intro';caption.textContent='Últimos 91 dias. Quanto mais intensa a cor, maior o tempo registrado.';activity.append(caption);
 const scroll=document.createElement('div');scroll.className='analytics-heat-scroll';scroll.setAttribute('aria-label','Calendário horizontal de 13 semanas');
 const layout=document.createElement('div');layout.className='analytics-heat-layout';
 const weekLabels=document.createElement('div');weekLabels.className='analytics-weekdays';
 const head=document.createElement('div');head.className='analytics-months';
 const heat=document.createElement('div');heat.className='analytics-heatmap';heat.setAttribute('role','grid');heat.setAttribute('aria-label','Atividade diária dos últimos 91 dias, 13 semanas em colunas');
 const threshold=Math.max(60,(S.goal||30)*60),today=new Date();
 const startDate=new Date(today.getFullYear(),today.getMonth(),today.getDate()-90);
 for(let day=0;day<7;day++){
   const date=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+day);
   const label=document.createElement('span');label.textContent=date.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');weekLabels.append(label);
 }
 for(let week=0;week<13;week++){
   const date=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+week*7);
   const m=document.createElement('span');m.textContent=week===0||date.getDate()<=7?date.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''):'';head.append(m);
 }
 for(let i=0;i<91;i++){
   const date=new Date(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()+i),seconds=Number(x[dk(date)])||0;
   const cell=document.createElement('div');cell.className='analytics-heatday';cell.setAttribute('role','gridcell');
   const level=seconds<=0?0:Math.min(4,Math.max(1,Math.ceil(seconds/threshold*4)));
   if(level)cell.classList.add('level'+level);
   const info=date.toLocaleDateString('pt-BR')+' — '+fmt(seconds);cell.title=info;cell.setAttribute('aria-label',info);
   heat.append(cell);
 }
 const col=document.createElement('div');col.append(head,heat);layout.append(weekLabels,col);scroll.append(layout);activity.append(scroll);
 const legend=document.createElement('div');legend.className='analytics-heat-legend';legend.innerHTML='<span>Menos</span><i></i><i class="level2"></i><i class="level4"></i><span>Mais</span>';activity.append(legend);
 const sessionNote=document.createElement('p');sessionNote.className='analytics-note';
 const recentSessions=analytics.sessions.filter(s=>Number.isFinite(s.seconds)&&s.seconds>0);
 sessionNote.textContent=recentSessions.length?('Sessões recentes registradas: '+recentSessions.length+' · tempo médio: '+fmt(recentSessions.reduce((sum,s)=>sum+s.seconds,0)/recentSessions.length)+'. Histórico de sessões limitado às 400 mais recentes.'):'As sessões detalhadas começam a ser registradas após abrir e ler um livro com o acompanhamento de sessões ativo.';
 activity.append(sessionNote);
 const foot=document.createElement('p');foot.className='analytics-note';
 foot.textContent='O contador pausa quando a aba perde foco, os ajustes estão abertos ou passam 2 minutos sem interação. Ele estima atividade no leitor — não consegue confirmar se a pessoa está olhando para a página.';activity.append(foot);

 const formats=grpP(p,'Formatos da biblioteca');formats.parentElement.classList.add('lector-format-card');
 const breakdown=[['PDF','pdf','#8f62eb'],['EPUB','epub','#5e98fc'],['Mangás e HQs','comic','#e07bb8'],['TXT','txt','#efad71']];
 const counts={pdf:0,epub:0,comic:0,txt:0};
 for(const book of bs){const kind=String(book.type||'').toLowerCase();if(kind==='pdf')counts.pdf++;else if(kind==='epub')counts.epub++;else if(['cbz','comic','zip'].includes(kind))counts.comic++;else counts.txt++}
 const total=bs.length;
 const fmtWrap=document.createElement('div');fmtWrap.className='lector-format-layout';
 const donut=document.createElement('div');donut.className='lector-format-donut';donut.setAttribute('role','img');
 donut.setAttribute('aria-label',total+' livros, agrupados por formato');
 let running=0;const parts=[];
 for(const [,key,color] of breakdown){const count=counts[key];if(!count)continue;const end=running+count/total*100;parts.push(color+' '+running.toFixed(3)+'% '+end.toFixed(3)+'%');running=end}
 donut.style.background=parts.length?'conic-gradient('+parts.join(',')+')':'conic-gradient(var(--soft) 0 100%)';
 const donutText=document.createElement('div');donutText.className='lector-format-donut-inner';
 const totalText=document.createElement('strong');totalText.textContent=String(total);
 const unit=document.createElement('small');unit.textContent=total===1?'livro':'livros';donutText.append(totalText,unit);donut.append(donutText);
 const fmtLegend=document.createElement('div');fmtLegend.className='lector-format-legend';
 for(const [label,key,color] of breakdown){const row=document.createElement('div');row.className='lector-format-row';
 const dot=document.createElement('i');dot.style.background=color;dot.setAttribute('aria-hidden','true');
 const text=document.createElement('span');text.textContent=label;const result=document.createElement('strong');
 result.textContent=counts[key]+(total?' · '+Math.round(counts[key]/total*100)+'%':'');row.append(dot,text,result);fmtLegend.append(row)}
 fmtWrap.append(donut,fmtLegend);formats.append(fmtWrap);
 p.classList.add('lector-stat-screen');
 const heading=document.createElement('div');heading.className='lector-stat-heading';
 heading.innerHTML='<div><span class="lector-eyebrow">ESTATÍSTICAS</span><h2>Sua jornada de leitura</h2><p>Acompanhe seu progresso e descubra seus hábitos ao longo do tempo.</p></div>';
 p.prepend(heading);
 first.parentElement.classList.add('lector-stat-overview');activity.parentElement.classList.add('lector-stat-calendar');weekly.parentElement.classList.add('lector-stat-weekly');group.parentElement.classList.add('lector-stat-period');trends.parentElement.classList.add('lector-stat-trends');sessionsGroup.parentElement.classList.add('lector-stat-sessions');exports.parentElement.classList.add('lector-stat-exports');

 p.insertBefore(activity.parentElement,weekly.parentElement);
 p.insertBefore(group.parentElement,weekly.parentElement);
 p.insertBefore(formats.parentElement,trends.parentElement);
}
