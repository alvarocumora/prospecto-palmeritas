// Renders persistent map annotations as Leaflet markers + manages a panel
// for listing, editing, resolving and deleting them.
// Click "Add note" → next click on the map drops a pin and opens an editor.

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Layer, LayerGroup, LeafletMouseEvent } from "leaflet";
import { StickyNote, Plus, Trash2, Check, X, MapPin, Pencil } from "lucide-react";
import {
  useMapAnnotations,
  ANNOTATION_COLORS,
  colorHex,
  type MapAnnotation,
} from "@/hooks/useMapAnnotations";
import type { LeafletNS } from "./types";

interface Props {
  projectId: string | null;
  map: LeafletMap | null;
  L: LeafletNS | null;
}

type DraftPin = { lat: number; lng: number } | null;

export function AnnotationsLayer({ projectId, map, L }: Props) {
  const { annotations, createAnnotation, updateAnnotation, deleteAnnotation } = useMapAnnotations(projectId);
  const [open, setOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [draft, setDraft] = useState<DraftPin>(null);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState("gold");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const groupRef = useRef<LayerGroup | null>(null);
  const draftMarkerRef = useRef<Layer | null>(null);

  // Render markers for stored annotations.
  useEffect(() => {
    if (!map || !L) return;
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map);
    const group = groupRef.current;
    group.clearLayers();
    const list = showResolved ? annotations : annotations.filter((a) => !a.resolved);
    for (const a of list) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${colorHex(a.color)};border:2px solid #0A0A0A;box-shadow:0 0 0 2px ${colorHex(a.color)}55;display:flex;align-items:center;justify-content:center;color:#0A0A0A;font-size:10px;font-weight:700;${a.resolved ? "opacity:0.45;" : ""}">${a.resolved ? "✓" : "•"}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([Number(a.lat), Number(a.lng)], { icon }).addTo(group);
      const safeText = a.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      m.bindPopup(
        `<div style="font-family:ui-monospace,monospace;max-width:240px;">
          <div style="color:${colorHex(a.color)};font-size:10px;text-transform:uppercase;margin-bottom:4px;">
            ${ANNOTATION_COLORS.find((c) => c.value === a.color)?.label ?? "Nota"}${a.resolved ? " · resuelta" : ""}
          </div>
          <div style="color:#F5F5F5;font-size:12px;line-height:1.4;white-space:pre-wrap;">${safeText}</div>
          <div style="color:#888;font-size:10px;margin-top:6px;">${new Date(a.created_at).toLocaleString("es-CL")}</div>
        </div>`,
      );
    }
    return () => {
      group.clearLayers();
    };
  }, [map, L, annotations, showResolved]);

  // Click-to-place handler when in placing mode.
  useEffect(() => {
    if (!map || !L || !placingMode) return;
    const onClick = (e: LeafletMouseEvent) => {
      setDraft({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPlacingMode(false);
      setOpen(true);
    };
    map.on("click", onClick);
    const container = map.getContainer();
    container.style.cursor = "crosshair";
    return () => {
      map.off("click", onClick);
      container.style.cursor = "";
    };
  }, [map, L, placingMode]);

  // Render the draft pin on the map while editing.
  useEffect(() => {
    if (!map || !L) return;
    if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }
    if (draft) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${colorHex(draftColor)};border:2px dashed #FFFFFF;box-shadow:0 0 12px ${colorHex(draftColor)};animation:pulse 1.2s infinite;"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      draftMarkerRef.current = L.marker([draft.lat, draft.lng], { icon }).addTo(map);
    }
    return () => {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove();
        draftMarkerRef.current = null;
      }
    };
  }, [draft, draftColor, map, L]);

  if (!projectId) return null;

  const startPlacing = () => {
    setDraft(null);
    setDraftText("");
    setPlacingMode(true);
  };

  const cancelDraft = () => {
    setDraft(null);
    setDraftText("");
    setPlacingMode(false);
  };

  const saveDraft = async () => {
    if (!draft || !draftText.trim()) return;
    await createAnnotation({ lat: draft.lat, lng: draft.lng, text: draftText.trim(), color: draftColor });
    setDraft(null);
    setDraftText("");
  };

  const visible = showResolved ? annotations : annotations.filter((a) => !a.resolved);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-24 right-3 z-[500] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-bg-secondary/95 backdrop-blur text-[11px] font-mono text-foreground hover:bg-accent shadow-md"
        title="Notas y anotaciones"
      >
        <StickyNote className="w-3.5 h-3.5 text-gold" />
        <span>Notas{visible.length > 0 ? ` (${visible.length})` : ""}</span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-24 right-3 z-[500] w-72 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl flex flex-col max-h-[60vh]">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-gold" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Notas ({visible.length})
          </span>
        </div>
        <button
          onClick={() => {
            setOpen(false);
            cancelDraft();
          }}
          className="text-muted-foreground hover:text-foreground"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Draft editor */}
      {draft ? (
        <div className="p-2 border-b border-border bg-accent/30 space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <MapPin className="w-3 h-3 text-gold" />
            {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Describe la observación (≤500 char)"
            rows={3}
            maxLength={500}
            autoFocus
            className="w-full px-2 py-1 text-[11px] font-mono rounded border border-border bg-background outline-none focus:border-gold resize-none"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setDraftColor(c.value)}
                className={`w-5 h-5 rounded-full border-2 ${draftColor === c.value ? "border-foreground" : "border-transparent"}`}
                style={{ background: c.hex }}
                title={c.label}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={saveDraft}
              disabled={!draftText.trim()}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-gold text-bg-primary text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-40"
            >
              <Check className="w-3 h-3" /> Guardar
            </button>
            <button
              onClick={cancelDraft}
              className="px-2 py-1 rounded border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-b border-border flex items-center gap-1.5">
          <button
            onClick={startPlacing}
            disabled={placingMode || !map}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-gold text-bg-primary text-[11px] font-mono font-semibold hover:bg-gold/90 disabled:opacity-50"
            title="Hacer clic en el mapa para fijar la nota"
          >
            <Plus className="w-3 h-3" />
            {placingMode ? "Click en el mapa…" : "Nueva nota"}
          </button>
          <label className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="accent-gold"
            />
            Resueltas
          </label>
        </div>
      )}

      <div className="overflow-y-auto flex-1 p-1">
        {visible.length === 0 ? (
          <div className="px-2 py-4 text-center text-[10px] font-mono text-muted-foreground">
            Sin notas. Crea pines con observaciones estructurales, targets o tareas pendientes.
          </div>
        ) : (
          visible.map((a) => (
            <AnnotationRow
              key={a.id}
              a={a}
              editing={editingId === a.id}
              editText={editText}
              onStartEdit={() => {
                setEditingId(a.id);
                setEditText(a.text);
              }}
              onChangeText={setEditText}
              onSaveEdit={async () => {
                if (editText.trim() && editText.trim() !== a.text) {
                  await updateAnnotation(a.id, { text: editText.trim().slice(0, 500) });
                }
                setEditingId(null);
              }}
              onCancelEdit={() => setEditingId(null)}
              onToggleResolved={() => updateAnnotation(a.id, { resolved: !a.resolved })}
              onDelete={() => deleteAnnotation(a.id)}
              onZoom={() => map?.setView([Number(a.lat), Number(a.lng)], Math.max(map.getZoom(), 16))}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  a: MapAnnotation;
  editing: boolean;
  editText: string;
  onStartEdit: () => void;
  onChangeText: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleResolved: () => void;
  onDelete: () => void;
  onZoom: () => void;
}

function AnnotationRow({
  a,
  editing,
  editText,
  onStartEdit,
  onChangeText,
  onSaveEdit,
  onCancelEdit,
  onToggleResolved,
  onDelete,
  onZoom,
}: RowProps) {
  return (
    <div className={`group px-2 py-1.5 rounded hover:bg-accent ${a.resolved ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
          style={{ background: colorHex(a.color) }}
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => onChangeText(e.target.value)}
              rows={2}
              maxLength={500}
              autoFocus
              className="w-full px-1.5 py-1 text-[11px] font-mono rounded border border-border bg-background outline-none focus:border-gold resize-none"
            />
          ) : (
            <button
              onClick={onZoom}
              className="text-left w-full"
              title="Centrar mapa"
            >
              <div className={`text-[11px] font-mono text-foreground line-clamp-3 ${a.resolved ? "line-through" : ""}`}>
                {a.text}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
                {Number(a.lat).toFixed(4)},{Number(a.lng).toFixed(4)} ·{" "}
                {new Date(a.created_at).toLocaleDateString("es-CL")}
              </div>
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <button onClick={onSaveEdit} className="p-1 text-gold hover:text-foreground" title="Guardar">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={onCancelEdit} className="p-1 text-muted-foreground hover:text-foreground" title="Cancelar">
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <button onClick={onToggleResolved} className="p-1 text-muted-foreground hover:text-gold" title={a.resolved ? "Reabrir" : "Marcar resuelta"}>
                <Check className="w-3 h-3" />
              </button>
              <button onClick={onStartEdit} className="p-1 text-muted-foreground hover:text-foreground" title="Editar">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
