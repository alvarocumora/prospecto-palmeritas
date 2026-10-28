// Caché en memoria por isolate con TTL y deduplicación de peticiones en vuelo.
// Uso: datos públicos agregados (KPIs, snapshots) que toleran minutos de
// desfase. Nunca cachear datos privados por usuario aquí.
type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function memoize<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now()) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: now() + ttlMs });
      return value;
    })
    .catch((err) => {
      // Si falla, servir el último valor conocido antes que tumbar la página.
      if (hit) return hit.value;
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearMemoCache() {
  store.clear();
  inflight.clear();
}
