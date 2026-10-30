                                          
                                                        
                                                                                          
   
const CACHE_NAME = 'lector-shell-v17.0';
                                                                                         
const CACHE_PREFIXES = ['leitor-shell-', 'lector-shell-'];
const ROOT = new URL('./', self.registration.scope);
const APP_SHELL = new URL('index.html', ROOT).href;
const APP_HOME = ROOT.href;
const FALLBACK = new URL('offline.html', ROOT).href;
const REQUIRED = [APP_SHELL, FALLBACK, new URL('manifest.json', ROOT).href, ...['css/base.css','css/temas-perfis.css','css/leitura-anotacoes.css','css/pesquisa-ocr.css','css/backup-estatisticas.css','css/interface-responsiva.css','css/acessibilidade.css','css/lixeira-navegacao.css','css/paletas.css','css/painel-temas.css','css/consistencia-visual.css','css/estabilidade.css','css/estatisticas-layout.css','css/configuracoes-menu.css','css/biblioteca-filtros.css','css/layout-creditos.css','css/conta-nuvem.css','css/offline.css','js/core.js','js/armazenamento-perfis.js','js/estatisticas-biblioteca.js','js/biblioteca-operacoes.js','js/leitura.js','js/anotacoes.js','js/pesquisa-ocr.js','js/configuracoes-estatisticas.js','js/backup.js','js/nuvem.js','js/interface.js','js/lixeira-sincronizacao.js','js/painel-resumo.js'].map(path => new URL(path, ROOT).href)];
const OPTIONAL = [
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'libs/jszip.min.js', 'libs/epub.min.js',
  'libs/pdf.min.js', 'libs/pdf.worker.min.js'
].map(path => new URL(path, ROOT).href);
const STATIC_PATHS = new Set([...REQUIRED, ...OPTIONAL]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
                                                                                     
    await cache.addAll(REQUIRED);
                                                                               
    await Promise.all(OPTIONAL.map(async url => {
      try {
        const response = await fetch(url, {cache: 'no-store'});
        if (response.ok && response.type === 'basic') await cache.put(url, response);
      } catch (_) {                                            }
    }));
                                                                      
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      name !== CACHE_NAME && CACHE_PREFIXES.some(prefix => name.startsWith(prefix))
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT.href)) return;
                                                                             
                                                                           
  if (url.search || url.hash) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        if (network.ok && (url.href === APP_SHELL || url.href === APP_HOME) && network.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_SHELL, network.clone()).catch(() => {});
        }
        return network;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        if (url.href === APP_SHELL || url.href === APP_HOME) return await cache.match(APP_SHELL) || await cache.match(FALLBACK) || Response.error();
        return await cache.match(FALLBACK) || Response.error();
      }
    })());
    return;
  }
  if (!STATIC_PATHS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) { return Response.error(); }
  })());
});
