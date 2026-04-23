// Sprint 6.8 — Visual layer + UI for live collaboration on the operational map.
// - Listens to map mousemove → broadcasts cursor
// - Renders remote cursors as DOM markers
// - Renders persistent annotation pins (with popup, resolve, delete)
// - "Add note" mode: next click on the map creates a pin

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, LayerGroup } from "leaflet";
import type { LeafletNS } from "./types";
import { useLiveCollab, type LiveCursor, type MapAnnotation } from "@/hooks/useLiveCollab";
import { MessageSquarePlus, Users, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  projectId: string | null;
  map: LeafletMap | null;
  L: LeafletNS | null;
};

export function LiveCollabLayer({ projectId, map, L }: Props) {
  const {
    cursors, annotations, sharing, setSharing,
    broadcastCursor, addAnnotation, toggleResolved, deleteAnnotation,
    currentUserId,
  } = useLiveCollab(projectId);
  const [adding, setAdding] = useState(false);
  const [composer, setComposer] = useState<{ lat: number; lng: number; text: string } | null>(null);
  const cursorLayerRef = useRef<LayerGroup | null>(null);
  const cursorMarkersRef = useRef<Map<string, Marker>>(new Map());
  const annotLayerRef = useRef<LayerGroup | null>(null);

  // Mousemove → broadcast
  useEffect(() => {
    if (!map || !sharing) return;
    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      broadcastCursor(e.latlng.lat, e.latlng.lng);
    };
    map.on("mousemove", handler);
    return () => { map.off("mousemove", handler); };
  }, [map, sharing, broadcastCursor]);

  // Click → add annotation when in adding mode
  useEffect(() => {
    if (!map || !adding) return;
    const container = map.getContainer();
    container.style.cursor = "crosshair";
    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      setComposer({ lat: e.latlng.lat, lng: e.latlng.lng, text: "" });
      setAdding(false);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
      container.style.cursor = "";
    };
  }, [map, adding]);

  // Render remote cursors
  useEffect(() => {
    if (!map || !L) return;
    if (!cursorLayerRef.current) {
      cursorLayerRef.current = L.layerGroup().addTo(map);
    }
    const layer = cursorLayerRef.current;
    const seen = new Set<string>();

    for (const c of cursors) {
      seen.add(c.user_id);
      const html = buildCursorHtml(c);
      const icon = L.divIcon({ html, className: "live-cursor-icon", iconSize: [0, 0], iconAnchor: [0, 0] });
      const existing = cursorMarkersRef.current.get(c.user_id);
      if (existing) {
        existing.setLatLng([c.lat, c.lng]);
        existing.setIcon(icon);
      } else {
        const m = L.marker([c.lat, c.lng], { icon, interactive: false, keyboard: false });
        m.addTo(layer);
        cursorMarkersRef.current.set(c.user_id, m);
      }
    }
    // Remove stale
    for (const [uid, m] of cursorMarkersRef.current.entries()) {
      if (!seen.has(uid)) {
        m.remove();
        cursorMarkersRef.current.delete(uid);
      }
    }
  }, [cursors, map, L]);

  // Cleanup cursors layer when unmounting / map changes
  useEffect(() => {
    return () => {
      cursorMarkersRef.current.forEach((m) => m.remove());
      cursorMarkersRef.current.clear();
      cursorLayerRef.current?.remove();
      cursorLayerRef.current = null;
    };
  }, [map]);

  // Render annotation pins
  useEffect(() => {
    if (!map || !L) return;
    annotLayerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    annotLayerRef.current = layer;

    for (const a of annotations) {
      const html = `<div class="annot-pin ${a.resolved ? "resolved" : ""}" style="background:${a.resolved ? "#22c55e" : "#f0c96b"}">📍</div>`;
      const icon = L.divIcon({ html, className: "annot-pin-icon", iconSize: [24, 24], iconAnchor: [12, 24] });
      const m = L.marker([a.lat, a.lng], { icon });
      const popup = buildAnnotPopup(a, currentUserId);
      m.bindPopup(popup, { closeButton: true });
      m.on("popupopen", (ev: { popup: { getElement(): HTMLElement | null } }) => {
        const el = ev.popup.getElement();
        if (!el) return;
        el.querySelector<HTMLButtonElement>("[data-act='resolve']")?.addEventListener("click", () => {
          void toggleResolved(a.id, !a.resolved).then(() => map.closePopup());
        });
        el.querySelector<HTMLButtonElement>("[data-act='delete']")?.addEventListener("click", () => {
          if (!confirm("¿Eliminar esta nota?")) return;
          void deleteAnnotation(a.id).then(() => map.closePopup());
        });
      });
      m.addTo(layer);
    }
    return () => { layer.remove(); };
  }, [annotations, map, L, currentUserId, toggleResolved, deleteAnnotation]);

  if (!projectId) return null;

  return (
    <>
      {/* Control panel — top-left, compact, sits above ProspectivityButton */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1 rounded-md bg-bg-secondary/95 backdrop-blur border border-border px-1.5 py-1 shadow-md">
        <button
          onClick={() => setSharing(!sharing)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
            sharing ? "bg-gold text-bg-primary" : "text-foreground hover:bg-accent"
          }`}
          title={sharing ? "Detener compartir cursor" : "Compartir mi cursor con el equipo"}
        >
          <Users className="w-3.5 h-3.5" />
          {sharing ? `En vivo · ${cursors.length + 1}` : "Compartir cursor"}
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => setAdding((v) => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
            adding ? "bg-gold text-bg-primary" : "text-foreground hover:bg-accent"
          }`}
          title="Soltar una nota en el mapa"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          {adding ? "Click en el mapa…" : `Notas (${annotations.length})`}
        </button>
      </div>

      {/* Composer modal */}
      {composer && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-black/40" onClick={() => setComposer(null)}>
          <div
            className="bg-bg-secondary border border-border rounded-lg p-4 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Nueva nota</div>
              <button onClick={() => setComposer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mb-2">
              {composer.lat.toFixed(5)}, {composer.lng.toFixed(5)}
            </div>
            <textarea
              autoFocus
              maxLength={500}
              value={composer.text}
              onChange={(e) => setComposer({ ...composer, text: e.target.value })}
              placeholder="Comentario visible para todo el equipo…"
              className="w-full h-24 bg-bg-tertiary border border-border rounded p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-gold"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setComposer(null)}
                className="px-3 py-1 text-xs rounded border border-border hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const text = composer.text.trim();
                  if (!text) return;
                  void addAnnotation(composer.lat, composer.lng, text)
                    .then(() => { setComposer(null); toast.success("Nota publicada"); })
                    .catch((e: Error) => toast.error(e.message ?? "Error al publicar"));
                }}
                disabled={!composer.text.trim()}
                className="px-3 py-1 text-xs rounded bg-gold text-bg-primary font-medium disabled:opacity-40"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .live-cursor-icon { pointer-events: none; }
        .live-cursor-label {
          position: absolute; left: 14px; top: 4px;
          font: 600 10px ui-monospace, monospace;
          padding: 1px 5px; border-radius: 4px;
          color: #0a0a0a; white-space: nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,.3);
        }
        .live-cursor-arrow svg { display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
        .annot-pin {
          width: 24px; height: 24px; border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          border: 2px solid rgba(0,0,0,.6);
          box-shadow: 0 2px 6px rgba(0,0,0,.4);
        }
        .annot-pin > * { transform: rotate(45deg); }
        .annot-popup-body { font-family: ui-monospace, monospace; font-size: 11px; min-width: 180px; }
        .annot-popup-body .meta { color: #888; font-size: 9px; margin-bottom: 4px; }
        .annot-popup-body .text { white-space: pre-wrap; word-break: break-word; }
        .annot-popup-body .actions { display: flex; gap: 6px; margin-top: 8px; }
        .annot-popup-body button {
          font: 600 10px ui-monospace, monospace;
          padding: 3px 6px; border-radius: 3px; cursor: pointer;
          border: 1px solid #444; background: #1a1a1a; color: #ddd;
        }
        .annot-popup-body button:hover { background: #2a2a2a; }
      `}</style>
    </>
  );
}

function buildCursorHtml(c: LiveCursor): string {
  const safe = escapeHtml(c.display_name);
  return `
    <div class="live-cursor-arrow">
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z" fill="${c.color}" stroke="#000" stroke-width="0.8"/>
      </svg>
    </div>
    <span class="live-cursor-label" style="background:${c.color}">${safe}</span>
  `;
}

function buildAnnotPopup(a: MapAnnotation, currentUserId: string | null): string {
  const date = new Date(a.created_at).toLocaleString();
  const canEdit = currentUserId === a.created_by;
  const text = escapeHtml(a.text);
  return `
    <div class="annot-popup-body">
      <div class="meta">${date}${a.resolved ? " · ✅ resuelta" : ""}</div>
      <div class="text">${text}</div>
      <div class="actions">
        <button data-act="resolve">${a.resolved ? "Reabrir" : "✓ Resolver"}</button>
        ${canEdit ? `<button data-act="delete">🗑 Eliminar</button>` : ""}
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}
