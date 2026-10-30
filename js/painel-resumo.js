
(function(){
  const home=document.getElementById('v-home');
  const toggle=document.getElementById('lectorSummaryToggle');
  if(!home||!toggle)return;
  const key=()=>`leitor:summary-collapsed:${user||'local'}`;
  function setCollapsed(value){
    home.classList.toggle('lector-summary-collapsed',!!value);
    toggle.setAttribute('aria-expanded',String(!value));
    toggle.setAttribute('aria-label',value?'Expandir Painel de Resumo':'Recolher Painel de Resumo');
    toggle.title=value?'Expandir Painel de Resumo':'Recolher Painel de Resumo';
    const txt=toggle.querySelector('.lector-summary-toggle-text');if(txt)txt.textContent=value?'Expandir':'Recolher';
  }
  window.lectorRestoreSummaryState=()=>setCollapsed(!!lsGet(key()));
  toggle.addEventListener('click',()=>{
    const next=!home.classList.contains('lector-summary-collapsed');
    setCollapsed(next);lsSet(key(),next);
  });
})();

S=Object.assign({},DEF,lsGet('leitor:last-appearance')||{});
appApply();
initStaticIcons();
initVisualRail();
showLogin();
