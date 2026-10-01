// Anclajes de escena para el Geo Copilot.
// El modelo emite tokens inline `[target:CODE]`, `[hole:ID]`, `[anomaly:CODE]`
// que se parsean a chips clicables y disparan un CustomEvent que los visores
// pueden escuchar para enfocar/resaltar la entidad.

export type SceneAnchorKind = "target" | "hole" | "anomaly";

export interface SceneAnchor {
  kind: SceneAnchorKind;
  code: string;
}

export interface SceneFocusDetail extends SceneAnchor {
  source: "copilot";
}

export const SCENE_FOCUS_EVENT = "geoscene:focus";

const ANCHOR_RE = /\[(target|hole|anomaly):([A-Za-z0-9_\-./]+)\]/g;

export type ParsedSegment =
  { type: "text"; value: string } | { type: "anchor"; anchor: SceneAnchor };

export function parseAnchors(text: string): ParsedSegment[] {
  const out: ParsedSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(ANCHOR_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: "text", value: text.slice(last, idx) });
    out.push({
      type: "anchor",
      anchor: { kind: m[1] as SceneAnchorKind, code: m[2] },
    });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export function emitSceneFocus(anchor: SceneAnchor) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SceneFocusDetail>(SCENE_FOCUS_EVENT, {
      detail: { ...anchor, source: "copilot" },
    }),
  );
}

export const ANCHOR_LABEL: Record<SceneAnchorKind, string> = {
  target: "Target",
  hole: "Sondaje",
  anomaly: "Anomalía",
};
