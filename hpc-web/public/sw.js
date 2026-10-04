/**
 * Health & Pain Care Center (HPC) - Service Worker
 * Provides offline resilience, local network LAN caching, asset pre-fetching, and fast load times.
 */

const CACHE_NAME = "hpc-cache-v1";

const PRECACHE_ASSETS = [
  "/",
  "/login",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

// 1. Install event: Pre-cache core offline assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[HPC SW] Pre-cache warning (normal on first run):", err);
      })
  );
});

// 2. Activate event: Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-while-revalidate for static assets, Network-first for navigation & API
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and SSE realtime streams
  if (request.method !== "GET" || url.pathname.startsWith("/api/realtime")) {
    return;
  }

  // Static Assets (fonts, images, chunks): Cache-First / Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        })
      )
    );
    return;
  }

  // HTML Navigation Pages: Network-First with Cache Fallback for Local LAN resiliency
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return (
              cached ||
              caches.match("/") ||
              new Response(
                `<!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>HPC | Local Network Mode</title>
                  <style>
                    body { font-family: system-ui, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                    .card { background: #1e293b; padding: 32px; border-radius: 16px; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
                    h1 { font-size: 20px; margin-bottom: 8px; color: #10b981; }
                    p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
                    .btn { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #059669; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Health &amp; Pain Care Center</h1>
                    <p>Connected via Local Clinic LAN. Please ensure the local server is running on the host machine.</p>
                    <button class="btn" onclick="window.location.reload()">Retry Connection</button>
                  </div>
                </body>
                </html>`,
                { headers: { "Content-Type": "text/html" } }
              )
            );
          });
        })
    );
  }
});
