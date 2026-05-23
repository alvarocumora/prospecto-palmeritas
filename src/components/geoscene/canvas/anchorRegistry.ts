// Registro global de anclajes para la escena deck.gl.
// Cada capa registra sus entidades visibles (target/hole/anomaly + lng/lat/altura);
// el canvas consulta el registro cuando llega un evento `geoscene:focus` y
// vuela la cámara al elemento correspondiente.
import type { SceneAnchorKind } from "../anchors";

export interface AnchorEntry {
  kind: SceneAnchorKind;
  code: string;
  lng: number;
  lat: number;
  /** Altitud opcional (m s.n.m.) para anclajes en profundidad. */
  altitude?: number;
}

type Listener = () => void;

const entries = new Map<string, AnchorEntry>();
const listeners = new Set<Listener>();

const key = (kind: SceneAnchorKind, code: string) => `${kind}:${code}`;

export function registerAnchors(items: AnchorEntry[]) {
  for (const it of items) entries.set(key(it.kind, it.code), it);
  listeners.forEach((l) => l());
  return () => {
    for (const it of items) entries.delete(key(it.kind, it.code));
    listeners.forEach((l) => l());
  };
}

export function findAnchor(kind: SceneAnchorKind, code: string): AnchorEntry | undefined {
  return entries.get(key(kind, code));
}

export function listAnchors(): AnchorEntry[] {
  return Array.from(entries.values());
}

export function subscribeAnchors(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
