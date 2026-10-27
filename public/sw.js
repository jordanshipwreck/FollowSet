/* Followset offline shell.
   - Cache name carries the build id, stamped at build time, so each deploy replaces the old shell.
   - Install precaches index.html plus the hashed JS/CSS/fonts it references, so the app opens
     offline from the second launch on.
   - Pages: network first (4 s), then cache. Hashed assets and media: cache first.
     Demo GIFs are cached the first time they are shown.
   - No clients.claim and no reload on controllerchange: claiming a page that is still booting
     froze iOS standalone on the loading screen in earlier builds. */
const BUILD = "__BUILD_ID__";
const CACHE = `followset-${BUILD}`;
const MEDIA = "followset-media-v1";
const BASE = new URL("./", self.location).href;
const CORE = ["./", "./index.html", "./exercises.json", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./wake.mp4"].map(
  (p) => new URL(p, BASE).href,
);

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function assetUrls(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)) urls.add(new URL(m[1], BASE).href);
  for (const u of [...urls].filter((u) => u.endsWith(".css"))) {
    try {
      const css = await (await fetch(u, { cache: "reload" })).text();
      for (const m of css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) urls.add(new URL(m[1], u).href);
    } catch {
      /* fonts will cache at runtime instead */
    }
  }
  return [...urls];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        CORE.map(async (u) => {
          try {
            const r = await withTimeout(fetch(u, { cache: "reload" }), 8000);
            if (r.ok && !r.redirected) await cache.put(u, r.clone());
            if (u.endsWith("index.html") && r.ok) {
              const html = await r.text();
              await Promise.all(
                (await assetUrls(html)).map(async (a) => {
                  try {
                    const ar = await withTimeout(fetch(a, { cache: "reload" }), 8000);
                    if (ar.ok) await cache.put(a, ar);
                  } catch {
                    /* cached on first use */
                  }
                }),
              );
            }
          } catch {
            /* a slow precache must not block install */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k)));
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const r = await withTimeout(fetch(request), 4000);
    if (r.ok && r.type === "basic" && !r.redirected) cache.put(request, r.clone()).catch(() => {});
    return r;
  } catch {
    const hit = (await cache.match(request)) || (await cache.match(new URL("./index.html", BASE).href)) || (await cache.match(BASE));
    if (hit) return hit;
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#ecebe7;color:#0e0e0c;font:17px system-ui;padding:24px;text-align:center">Followset couldn\'t load. Check the connection, then open it again.</body>',
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const r = await fetch(request);
  if (r.ok && r.type === "basic") cache.put(request, r.clone()).catch(() => {});
  return r;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return;
  const path = url.href.slice(BASE.length);
  if (req.mode === "navigate") event.respondWith(networkFirst(req));
  else if (path.startsWith("assets/")) event.respondWith(cacheFirst(req, CACHE));
  else if (path.startsWith("media/")) event.respondWith(cacheFirst(req, MEDIA));
  else event.respondWith(networkFirst(req));
});
