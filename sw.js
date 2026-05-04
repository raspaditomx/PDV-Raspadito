const CACHE_NAME = 'raspadito-dinamico-v3';
const TIEMPO_ESPERA_MAXIMO = 3000; // 3 segundos (3000 milisegundos)

// 1. Instalación y activación rápida
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });

// 2. Estrategia: Red con límite de tiempo (Timeout), respaldo en Caché
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        new Promise((resolve, reject) => {
            // Ponemos un temporizador de 3 segundos
            const timeoutId = setTimeout(() => {
                caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) resolve(cachedResponse);
                });
            }, TIEMPO_ESPERA_MAXIMO);

            // Intentamos descargar de internet
            fetch(event.request)
                .then(response => {
                    clearTimeout(timeoutId); // Si internet responde rápido, cancelamos el temporizador
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    resolve(response);
                })
                .catch(err => {
                    clearTimeout(timeoutId); // Si falla la red (ej. WiFi apagado), cancelamos el temporizador
                    caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) resolve(cachedResponse);
                        else reject(err);
                    });
                });
        })
    );
});
