/* Followset offline shell. Scope is /FollowSet/ (case-sensitive).
   Exercise demo GIFs are not precached. The fetch handler stores each one the first time it is viewed.
   A missing or stale shell must not turn a navigation into a blank page. */
const CACHE = "fitty-shell-v7";
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

function shellFallback() {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Followset</title>
  </head>
  <body style="margin:0;min-height:100vh;background:#f4f1ea;color:#12140a;font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px">
    <main style="max-width:28rem">
      <h1 style="font-size:28px;margin:0 0 8px">Followset</h1>
      <p data-testid="shell-fallback" style="font-size:17px;line-height:1.45;margin:0">Followset couldn't load. Check the connection, then open the app again.</p>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response && response.ok && response.type === "basic" && !response.redirected) {
              await cache.put(url, response);
            }
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
      await Promise.all(
        keys
          .filter((key) => key !== CACHE && (key.startsWith("fitty-shell") || key.startsWith("fitty-")))
          .map((key) => caches.delete(key))
      );
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
        if (!response) throw new Error("empty response");
        let usable = response;
        if (response.redirected) {
          const body = await response.blob();
          const headers = new Headers(response.headers);
          headers.delete("content-encoding");
          headers.delete("content-length");
          usable = new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }
        if (usable.ok && usable.type === "basic") {
          const copy = usable.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return usable;
      } catch {
        try {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const shell =
              (await caches.match(new URL("./index.html", SCOPE).href)) ||
              (await caches.match(SCOPE.href));
            if (shell) return shell;
            return shellFallback();
          }
        } catch {
          if (request.mode === "navigate") return shellFallback();
        }
        return Response.error();
      }
    })()
  );
});
