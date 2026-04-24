const CACHE_NAME = 'raspadito-v40-offline';

// Aquí le decimos qué archivos debe guardar en la memoria del celular/PC
const urlsToCache = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Instalación: Descarga y guarda los archivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Intercepción: Cuando no hay internet, saca los archivos del caché
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Si el archivo está guardado, lo devuelve. Si no, intenta buscarlo en internet.
      return response || fetch(event.request);
    })
  );
});