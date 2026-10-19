// Ticket simulado en la landing, guardado en el navegador hasta que el
// inversionista se registre y aterrice en Mis inversiones.
export const ROUND = {
  target: 1_500_000,
  shares: 15_000,
  sharePrice: 100,
  minTicket: 25_000,
} as const;

export type PendingTicket = {
  slug: "cholqui" | "losverdes";
  amount: number;
  shares: number;
  at: string;
};

const KEY = "gc-pending-ticket";

export function savePendingTicket(t: Omit<PendingTicket, "at">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...t, at: new Date().toISOString() }));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function readPendingTicket(): PendingTicket | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingTicket) : null;
  } catch {
    return null;
  }
}

export function clearPendingTicket() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
