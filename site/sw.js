/* Followset offline shell. Scope follows this script's directory, so /fitty/ and /FollowSet/ both work.
   Exercise demo GIFs are not precached. The fetch handler stores each one the first time it is viewed. */
const CACHE = "fitty-shell-v6";
const SCOPE = new URL("./", self.location);
const SHELL = [
  new URL("./", self.location).href,
  new URL("./index.html", self.location).href,
  new URL("./exercises.json", self.location).href,
  new URL("./manifest.webmanifest", self.location).href,
  new URL("./icon-192.png", self.location).href,
  new URL("./icon-512.png", self.location).href,
  new URL("./apple-touch-icon.png", self.location).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response && response.ok) await cache.put(url, response);
          } catch {
            /* A failed precache must not block install. */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scopePath = new URL(self.registration.scope).pathname;
  if (url.pathname !== scopePath && !url.pathname.startsWith(scopePath)) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return (
            (await caches.match(new URL("./index.html", SCOPE).href)) ||
            (await caches.match(SCOPE.href)) ||
            Response.error()
          );
        }
        return Response.error();
      }
    })()
  );
});
