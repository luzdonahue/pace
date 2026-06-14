/* Pace service worker — cache-first so the app opens instantly, even offline. */
var CACHE = 'pace-v19'; // demo seed task renamed "TikTok videos overdue" → "Film a TikTok" (no shame framing); bumped from v18
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  // ES modules — every file must be cached or the app white-screens offline
  './boot.js',
  './core-store.js', './core-logic.js',
  './adapter-ai.js', './adapter-platform.js',
  './ui-shell.js', './ui-today.js', './ui-checkin.js', './ui-dump-sort.js',
  './ui-sort-screen.js', './ui-someday-goals.js', './ui-settings.js', './ui-weekly-merge.js',
  './notificationAdapter.js'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* 3.3 — UNVERIFIED: push and notificationclick require a real device with
   notification permission granted. Cannot be tested in the Node sandbox. */
self.addEventListener('push', function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err){}
  var title = data.title || 'Pace — gentle check-in';
  var opts = {
    body: data.body || "Your day is waiting. No rush — just open when you're ready.",
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'pace-daily-reminder',
    renotify: false
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(cls){
      for(var i=0;i<cls.length;i++){
        if(cls[i].url && cls[i].focus) return cls[i].focus();
      }
      if(clients.openWindow) return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  // API calls (Anthropic) always go to the network
  if(e.request.url.indexOf('api.anthropic.com') > -1) return;
  e.respondWith(
    caches.match(e.request).then(function(hit){
      var net = fetch(e.request).then(function(res){
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
