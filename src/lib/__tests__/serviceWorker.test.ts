import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it, expect } from "vitest";

const SW_SOURCE = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://app.test";

type CacheSpy = { puts: string[]; matches: string[] };

function makeSw(fetchImpl: (req: unknown) => Promise<unknown>) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const cacheSpies: Record<string, CacheSpy> = {};
  const deleted: string[] = [];
  const cacheStore = new Map<string, Map<string, unknown>>();

  const openCache = async (name: string) => {
    if (!cacheSpies[name]) cacheSpies[name] = { puts: [], matches: [] };
    if (!cacheStore.has(name)) cacheStore.set(name, new Map());
    const store = cacheStore.get(name)!;
    return {
      match: async (req: { url?: string } | string) => {
        const key = typeof req === "string" ? req : (req.url ?? "");
        cacheSpies[name].matches.push(key);
        return store.get(key);
      },
      put: async (req: { url?: string } | string, res: unknown) => {
        const key = typeof req === "string" ? req : (req.url ?? "");
        cacheSpies[name].puts.push(key);
        store.set(key, res);
      },
      keys: async () => [...store.keys()],
      delete: async (k: string) => store.delete(k),
    };
  };

  const sandbox: Record<string, unknown> = {
    self: {
      addEventListener: (t: string, fn: (e: unknown) => void) => {
        listeners[t] = fn;
      },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
      registration: { unregister: async () => {} },
      location: { origin: ORIGIN },
    },
    caches: {
      keys: async () => [...cacheStore.keys()],
      delete: async (k: string) => {
        deleted.push(k);
        return cacheStore.delete(k);
      },
      open: openCache,
    },
    fetch: fetchImpl,
    URL,
    Response,
    Promise,
    setTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox);

  const dispatchFetch = async (url: string) => {
    let responded: Promise<unknown> | undefined;
    const event = {
      request: {
        method: "GET",
        url,
        mode: "navigate",
        headers: { get: (h: string) => (h.toLowerCase() === "accept" ? "text/html" : null) },
      },
      respondWith: (p: Promise<unknown>) => {
        responded = p;
      },
    };
    listeners.fetch(event);
    return responded ? ((await responded) as Response) : undefined;
  };

  return { listeners, cacheSpies, deleted, cacheStore, dispatchFetch };
}

describe("service worker (public/sw.js)", () => {
  it("usa VERSION nueva y borra cachés antiguas al activar", async () => {
    expect(SW_SOURCE).toContain('geocap-sw-v4"');
    const sw = makeSw(async () => new Response("ok"));
    sw.cacheStore.set("geocap-html-geocap-sw-v3", new Map());
    sw.cacheStore.set("geocap-tiles-geocap-sw-v3", new Map());
    sw.cacheStore.set("geocap-html-geocap-sw-v4", new Map());
    sw.cacheStore.set("geocap-tiles-geocap-sw-v4", new Map());
    let waited: Promise<unknown> | undefined;
    sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
    expect(sw.deleted).toContain("geocap-html-geocap-sw-v3");
    expect(sw.deleted).toContain("geocap-tiles-geocap-sw-v3");
    expect(sw.deleted).not.toContain("geocap-html-geocap-sw-v4");
  });

  it("nunca guarda en caché navegaciones a /dashboard ni subrutas", async () => {
    const sw = makeSw(async () => new Response("<html>dashboard</html>", { status: 200 }));
    for (const path of [
      "/dashboard",
      "/dashboard/investments",
      "/dashboard/finance",
      "/dashboard/team",
      "/dashboard/profile",
      "/dashboard/investors",
      "/dashboard/documentos",
      "/dashboard/admin",
      "/onboarding",
      "/auth",
    ]) {
      const res = await sw.dispatchFetch(ORIGIN + path);
      expect(res?.status).toBe(200);
    }
    const allPuts = Object.values(sw.cacheSpies).flatMap((c) => c.puts);
    expect(allPuts).toEqual([]);
  });

  it("offline en ruta privada devuelve fallback neutro 503 sin datos cacheados", async () => {
    const sw = makeSw(async () => {
      throw new Error("offline");
    });
    const res = await sw.dispatchFetch(ORIGIN + "/dashboard/investments");
    expect(res?.status).toBe(503);
    const body = await res!.text();
    expect(body).toContain("Sin conexión");
    expect(body).not.toContain("USD");
    const allPuts = Object.values(sw.cacheSpies).flatMap((c) => c.puts);
    expect(allPuts).toEqual([]);
  });

  it("sí cachea páginas públicas de la allowlist", async () => {
    const sw = makeSw(async () => new Response("<html>public</html>", { status: 200 }));
    await sw.dispatchFetch(ORIGIN + "/");
    await sw.dispatchFetch(ORIGIN + "/proyectos");
    const htmlPuts = sw.cacheSpies["geocap-html-geocap-sw-v4"]?.puts ?? [];
    expect(htmlPuts.some((u) => u === ORIGIN + "/")).toBe(true);
    expect(htmlPuts.some((u) => u === ORIGIN + "/proyectos")).toBe(true);
  });

  it("offline en página pública sirve la copia cacheada", async () => {
    let calls = 0;
    const sw = makeSw(async () => {
      calls++;
      if (calls === 1) return new Response("<html>public</html>", { status: 200 });
      throw new Error("offline");
    });
    await sw.dispatchFetch(ORIGIN + "/proyectos");
    const res = await sw.dispatchFetch(ORIGIN + "/proyectos");
    expect(res?.status).toBe(200);
    expect(await res!.text()).toContain("public");
  });

  it("mantiene cache-first de tiles públicos", async () => {
    const sw = makeSw(async () => new Response("tile-bytes", { status: 200 }));
    const res = await sw.dispatchFetch("https://server.arcgisonline.com/tile/1/2/3");
    expect(res?.status).toBe(200);
    const tilePuts = sw.cacheSpies["geocap-tiles-geocap-sw-v4"]?.puts ?? [];
    expect(tilePuts).toContain("https://server.arcgisonline.com/tile/1/2/3");
  });

  it("no intercepta /api/* ni archivos de control", async () => {
    const sw = makeSw(async () => new Response("net", { status: 200 }));
    for (const path of [
      "/api/public/x",
      "/_server/foo",
      "/sw.js",
      "/version.json",
      "/manifest.webmanifest",
    ]) {
      const res = await sw.dispatchFetch(ORIGIN + path);
      expect(res).toBeUndefined();
    }
  });
});
