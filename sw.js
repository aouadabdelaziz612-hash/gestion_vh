// ══════════════════════════════════════════════════
//  GestionVH FSM — Service Worker
//  Faculté des Sciences, Université Moulay Ismaïl
//  Version: 3.0 | Année 2025-2026
// ══════════════════════════════════════════════════

const CACHE_NAME = "gestionvh-fsm-v3";
const CACHE_STATIC = "gestionvh-static-v3";

// Fichiers à mettre en cache au démarrage
const STATIC_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap"
];

// ── INSTALL ──────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing GestionVH v3...");
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Failed to cache:", url, err);
          })
        )
      );
    }).then(() => {
      console.log("[SW] Installation complete ✅");
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_STATIC && name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log("[SW] Activated & old caches cleared ✅");
      return self.clients.claim();
    })
  );
});

// ── FETCH — Cache First, Network Fallback ────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== "GET") return;
  if (url.protocol === "chrome-extension:") return;

  // Google Fonts — stale-while-revalidate
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // App files — Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Revalidate in background
        fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              caches.open(CACHE_STATIC).then((cache) => {
                cache.put(event.request, response);
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache — fetch from network
      return fetch(event.request)
        .then((response) => {
          if (!response || !response.ok) return response;
          const toCache = response.clone();
          caches.open(CACHE_STATIC).then((cache) => {
            cache.put(event.request, toCache);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback — return index.html for navigation
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});

// ── SYNC / MESSAGE ───────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ── PUSH (placeholder for future use) ────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() || { title: "GestionVH", body: "Nouvelle notification" };
  event.waitUntil(
    self.registration.showNotification(data.title || "GestionVH", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "./" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || "./");
    })
  );
});
