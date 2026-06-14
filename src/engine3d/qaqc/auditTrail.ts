// Audit Trail — Sprint 4
// Log inmutable de eventos clave del workflow minero. Persistencia en localStorage.
// Cada acción genera un evento con timestamp y hash. Genera scenario IDs reproducibles.

export type AuditEventType =
  | "import.csv"
  | "qaqc.run"
  | "compositing.run"
  | "estimation.update"
  | "blockmodel.build"
  | "section.export"
  | "ni43101.snapshot"
  | "preset.save"
  | "preset.load";

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  timestamp: number;
  iso: string;
  payload: Record<string, unknown>;
  hash: string;
  scenarioId: string;
};

const STORAGE_KEY = "engine3d.audit.v1";
const MAX_EVENTS = 500;

function hashStr(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("0000000" + (h >>> 0).toString(16)).slice(-8);
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj as object).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

export function computeHash(payload: unknown): string {
  return hashStr(stableStringify(payload));
}

function read(): AuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as AuditEvent[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(events: AuditEvent[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = events.slice(-MAX_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota — ignore
  }
}

const listeners = new Set<(events: AuditEvent[]) => void>();

export const auditTrail = {
  log(type: AuditEventType, payload: Record<string, unknown>): AuditEvent {
    const timestamp = Date.now();
    const hash = computeHash({ type, payload });
    const scenarioId = `${type}-${hash}-${timestamp.toString(36)}`;
    const event: AuditEvent = {
      id: `evt_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp,
      iso: new Date(timestamp).toISOString(),
      payload,
      hash,
      scenarioId,
    };
    const events = [...read(), event];
    write(events);
    listeners.forEach((l) => l(events));
    return event;
  },
  list(): AuditEvent[] {
    return read();
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((l) => l([]));
  },
  subscribe(cb: (events: AuditEvent[]) => void): () => void {
    listeners.add(cb);
    cb(read());
    return () => listeners.delete(cb);
  },
  export(): string {
    return JSON.stringify(read(), null, 2);
  },
};
