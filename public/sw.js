const CACHE = 'writemore-v4';
const FONT_CACHE = 'writemore-fonts-v1';
const ASSETS = ['/writemore/', '/writemore/index.html', '/writemore/manifest.json', '/writemore/icons/128x128.png', '/writemore/icons/512x512.png'];

function isAppShellRequest(request, url) {
  return request.mode === 'navigate' || url.pathname === '/writemore/' || url.pathname === '/writemore/index.html';
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (url.origin === self.location.origin && isAppShellRequest(e.request, url)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/writemore/index.html')))
    );
    return;
  }

  // Google Fonts CSS + 字体文件：Cache First（缓存优先，有缓存直接返回，无缓存才请求并写入）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // 应用资源：Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
