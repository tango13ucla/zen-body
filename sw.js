const CACHE_NAME = "zen-body-shell-v3";
const SHELL_ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          SHELL_ASSETS.map((url) =>
            fetch(url, { cache: "no-store" })
              .then((res) => (res && res.ok ? cache.put(url, res) : null))
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("zen-body-shell-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept cross-origin sync traffic (e.g. ntfy.sh) or live encrypted vault snapshot
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("vault.enc")) return;

  const isDocNav =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  // Stale-While-Revalidate for 0ms instant native-like launch + silent background freshness
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const matchKey = isDocNav ? "./index.html" : req;
      const cached = await cache.match(matchKey, { ignoreSearch: isDocNav });

      const networkFetch = fetch(isDocNav ? "./index.html" : req, { cache: "no-store" })
        .then((res) => {
          if (res && res.status === 200) {
            cache.put(matchKey, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      const fresh = await networkFetch;
      if (fresh) return fresh;
      return cache.match("./index.html");
    })
  );
});
