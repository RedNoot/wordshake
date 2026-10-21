/*
 * WordShake's service worker. One job: when the server is asleep (Render's free plan stops it after 15 minutes
 * without visitors and it takes up to a minute to start), show our own "waking up" page instead of the host's.
 *
 * Only page loads are touched, never /api, /socket.io, scripts or images, and the app itself is never cached:
 * a page comes from the server whenever the server answers (it marks its replies with X-WordShake).
 * If the server hasn't answered in a few seconds, or something else answered, the waking page (waking.html)
 * is shown; it reloads the page as soon as the server is up.
 *
 * Kill switch: this file is never cached here, so replacing it with one that calls self.registration.unregister()
 * removes it from every device on their next visit.
 */
const CACHE = "ws-waking-v1";
const WAKING = "/waking.html";
const WAIT_MS = 4000;
const SKIP = /^\/(api|socket\.io|check|__)(\/|$)|^\/(waking\.html|sw\.js)$/;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add(new Request(WAKING, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || SKIP.test(url.pathname)) return;
  event.respondWith((async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WAIT_MS);
    try {
      const res = await fetch(req, { signal: ctrl.signal });
      if (res.headers.get("X-WordShake")) return res;
    } catch (e) {
      // asleep (held too long) or offline: the waking page says which
    } finally {
      clearTimeout(timer);
    }
    return (await caches.match(WAKING)) || fetch(req);
  })());
});
