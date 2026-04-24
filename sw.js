const CACHE_NAME = 'raspadito-dinamico-v1';

// 1. Se instala y se activa al instante sin esperar
self.addEventListener('install', event => {
    self.skipWaiting(); 
});

self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim()); 
});

// 2. Estrategia: Red primero, Caché como respaldo (Network First, fallback to Cache)
self.addEventListener('fetch', event => {
    // Solo cacheamos las lecturas (GET). Ignoramos extensiones de Chrome o cosas raras.
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // SI HAY INTERNET: Descarga la info, clónala y guárdala en el caché automáticamente
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // SI NO HAY INTERNET: Busca en el caché el archivo que se intentó descargar
                return caches.match(event.request);
            })
    );
});
