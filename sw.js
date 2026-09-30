/* Mapa zvuka - Service Worker
 * Strategija:
 *  - App shell (vlastite datoteke): precache + cache-first
 *  - CDN biblioteke i mape (tile-ovi): stale-while-revalidate
 *  - API pozivi (Apps Script, Cloudinary): uvijek mreža, bez cacheiranja
 */

const VERSION = 'v1.0.0';
const SHELL_CACHE = `mz-shell-${VERSION}`;
const CDN_CACHE = `mz-cdn-${VERSION}`;
const TILES_CACHE = `mz-tiles-${VERSION}`;
const MAX_TILES = 200; // ograničenje tile cache-a (spremište je konačno)

const SHELL_URLS = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './config.js',
    './logo.png',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

// Domeni kojima SW ne smije dirati odgovore (upload, dohvat podataka)
const BYPASS_HOSTS = [
    'script.google.com',
    'script.googleusercontent.com',
    'api.cloudinary.com',
    'upload.cloudinary.com',
    'res.cloudinary.com'
];

// Domeni s mrežnim resursima koje vrijedi cache-irati
const TILE_HOSTS = [
    'tiles.openfreemap.org',
    'tile.openstreetmap.org',
    'server.arcgisonline.com',
    'a.tile.opentopomap.org',
    'b.tile.opentopomap.org',
    'c.tile.opentopomap.org'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('mz-') && key !== SHELL_CACHE && key !== CDN_CACHE && key !== TILES_CACHE)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        await cache.delete(keys[0]);
        return trimCache(cacheName, maxEntries);
    }
}

// Cache-first za vlastite datoteke
async function shellFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        return caches.match('./index.html');
    }
}

// Stale-while-revalidate za CDN biblioteke i tile-ove
async function staleWhileRevalidate(request, cacheName) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok || response.type === 'opaque') {
            caches.open(cacheName).then((cache) => {
                cache.put(request, response.clone());
                trimCache(cacheName, cacheName === TILES_CACHE ? MAX_TILES : 60);
            });
        }
        return response;
    }).catch(() => null);
    return cached || (await fetchPromise) || Response.error();
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // API i upload promet ide izravno u mrežu
    if (BYPASS_HOSTS.some((host) => url.hostname.endsWith(host))) return;

    // Navigacija (otvaranje app-a): mreža pa cache fallback za offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const cache = caches.open(SHELL_CACHE);
                    cache.then((c) => c.put('./index.html', response.clone()));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Vlastite datoteke
    if (url.origin === self.location.origin) {
        event.respondWith(shellFirst(request));
        return;
    }

    // Mape (tile-ovi): prvo cache, u pozadini osvježi
    if (TILE_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request, TILES_CACHE));
        return;
    }

    // CDN biblioteke (unpkg, Google Fonts...): prvo cache, u pozadini osvježi
    if (url.protocol === 'https:') {
        event.respondWith(staleWhileRevalidate(request, CDN_CACHE));
    }
});
