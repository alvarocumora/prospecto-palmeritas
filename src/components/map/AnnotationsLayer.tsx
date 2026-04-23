// Renders persistent map annotations as Leaflet markers + manages a panel
// for listing, editing, resolving, filtering and deleting them.
// Annotations can be linked to an exploration target, a campaign, or a sampling phase.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Layer, LayerGroup, LeafletMouseEvent } from "leaflet";
import { StickyNote, Plus, Trash2, Check, X, MapPin, Pencil, Filter, Target as TargetIcon, Calendar, Download, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAnnotationHistory, summarizeDiff } from "@/hooks/useAnnotationHistory";
import {
  useMapAnnotations,
  ANNOTATION_COLORS,
  SAMPLING_PHASES,
  colorHex,
  type MapAnnotation,
} from "@/hooks/useMapAnnotations";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { useExplorationCampaigns } from "@/hooks/useExplorationCampaigns";
import { ExportAnnotationsPreview } from "./ExportAnnotationsPreview";
import type { LeafletNS } from "./types";

interface Props {
  projectId: string | null;
  projectName?: string | null;
  map: LeafletMap | null;
  L: LeafletNS | null;
}

type DraftPin = { lat: number; lng: number } | null;
type FilterKind = "all" | "target" | "campaign" | "phase";

export function AnnotationsLayer({ projectId, projectName, map, L }: Props) {
  const { annotations, createAnnotation, updateAnnotation, deleteAnnotation } = useMapAnnotations(projectId);
  const { targets } = useExplorationTargets(projectId);
  const { data: campaigns } = useExplorationCampaigns(projectId);

  const [open, setOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [draft, setDraft] = useState<DraftPin>(null);
  const [draftText, setDraftText] = useState("");
  const [draftColor, setDraftColor] = useState("gold");
  const [draftTarget, setDraftTarget] = useState<string>("");
  const [draftCampaign, setDraftCampaign] = useState<string>("");
  const [draftPhase, setDraftPhase] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [previewFormat, setPreviewFormat] = useState<"csv" | "pdf" | null>(null);

  // Filter state
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [filterValue, setFilterValue] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);

  const groupRef = useRef<LayerGroup | null>(null);
  const draftMarkerRef = useRef<Layer | null>(null);

  const targetMap = useMemo(() => new Map(targets.map((t) => [t.id, t])), [targets]);
  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  // Map de user_id → display_name (para creador / quien resolvió en el export)
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const ids = Array.from(new Set(
      annotations.flatMap((a) => [a.created_by, a.resolved_by]).filter(Boolean) as string[],
    ));
    if (ids.length === 0) { setUserMap(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", ids);
      if (cancelled) return;
      setUserMap(new Map((data ?? []).map((p) => [p.user_id, p.display_name || p.email || "—"])));
    })();
    return () => { cancelled = true; };
  }, [annotations]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = showResolved ? annotations : annotations.filter((a) => !a.resolved);
    if (filterKind === "target" && filterValue) list = list.filter((a) => a.target_id === filterValue);
    else if (filterKind === "campaign" && filterValue) list = list.filter((a) => a.campaign_id === filterValue);
    else if (filterKind === "phase" && filterValue) list = list.filter((a) => a.phase === filterValue);
    return list;
  }, [annotations, showResolved, filterKind, filterValue]);

  // Render markers for filtered annotations.
  useEffect(() => {
    if (!map || !L) return;
    if (!groupRef.current) groupRef.current = L.layerGroup().addTo(map);
    const group = groupRef.current;
    group.clearLayers();
    for (const a of filtered) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${colorHex(a.color)};border:2px solid #0A0A0A;box-shadow:0 0 0 2px ${colorHex(a.color)}55;display:flex;align-items:center;justify-content:center;color:#0A0A0A;font-size:10px;font-weight:700;${a.resolved ? "opacity:0.45;" : ""}">${a.resolved ? "✓" : "•"}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([Number(a.lat), Number(a.lng)], { icon }).addTo(group);
      const safeText = a.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const t = a.target_id ? targetMap.get(a.target_id) : null;
      const c = a.campaign_id ? campaignMap.get(a.campaign_id) : null;
      const linksHtml = [
        t ? `<span style="background:#3B82F622;color:#3B82F6;padding:1px 4px;border-radius:2px;">▸ ${t.code}</span>` : "",
        c ? `<span style="background:#A855F722;color:#A855F7;padding:1px 4px;border-radius:2px;">⊙ ${(c.name || "").slice(0, 18)}</span>` : "",
        a.phase ? `<span style="background:#10B98122;color:#10B981;padding:1px 4px;border-radius:2px;">⌬ ${a.phase}</span>` : "",
      ].filter(Boolean).join(" ");
      m.bindPopup(
        `<div style="font-family:ui-monospace,monospace;max-width:240px;">
          <div style="color:${colorHex(a.color)};font-size:10px;text-transform:uppercase;margin-bottom:4px;">
            ${ANNOTATION_COLORS.find((c) => c.value === a.color)?.label ?? "Nota"}${a.resolved ? " · resuelta" : ""}
          </div>
          <div style="color:#F5F5F5;font-size:12px;line-height:1.4;white-space:pre-wrap;">${safeText}</div>
          ${linksHtml ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;font-size:10px;">${linksHtml}</div>` : ""}
          <div style="color:#888;font-size:10px;margin-top:6px;">${new Date(a.created_at).toLocaleString("es-CL")}</div>
        </div>`,
      );
    }
    return () => {
      group.clearLayers();
    };
  }, [map, L, filtered, targetMap, campaignMap]);

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
    setDraftTarget("");
    setDraftCampaign("");
    setDraftPhase("");
    setPlacingMode(true);
  };

  const cancelDraft = () => {
    setDraft(null);
    setDraftText("");
    setDraftTarget("");
    setDraftCampaign("");
    setDraftPhase("");
    setPlacingMode(false);
  };

  const saveDraft = async () => {
    if (!draft || !draftText.trim()) return;
    await createAnnotation({
      lat: draft.lat,
      lng: draft.lng,
      text: draftText.trim(),
      color: draftColor,
      target_id: draftTarget || null,
      campaign_id: draftCampaign || null,
      phase: draftPhase || null,
    });
    cancelDraft();
  };

  const filterLabel = filterKind === "all"
    ? "Todas"
    : filterKind === "target"
      ? `Target: ${targetMap.get(filterValue)?.code ?? "—"}`
      : filterKind === "campaign"
        ? `Campaña: ${campaignMap.get(filterValue)?.name?.slice(0, 14) ?? "—"}`
        : `Fase: ${filterValue}`;

  if (!open) {
    return (
      <div className="absolute top-3 left-44 z-[500] pointer-events-none">
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-bg-secondary/95 backdrop-blur text-[11px] font-mono text-foreground hover:bg-accent shadow-md"
        title="Notas y anotaciones persistentes"
      >
        <StickyNote className="w-3.5 h-3.5 text-gold" />
        <span>Notas{filtered.length > 0 ? ` (${filtered.length})` : ""}</span>
      </button>
      </div>
    );
  }

  return (
    <>
    <div className="absolute top-3 left-44 z-[500] pointer-events-none">
    <div className="pointer-events-auto w-80 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl flex flex-col max-h-[68vh]">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-gold" />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            Notas ({filtered.length}/{annotations.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewFormat("csv")}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-gold disabled:opacity-40"
            title="Vista previa CSV"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
          <button
            onClick={() => setPreviewFormat("pdf")}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-gold disabled:opacity-40"
            title="Vista previa PDF"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
          <button
            onClick={() => { setOpen(false); cancelDraft(); }}
            className="text-muted-foreground hover:text-foreground ml-1"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-2 py-1.5 border-b border-border bg-accent/20">
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className={`w-full inline-flex items-center justify-between gap-1 px-2 py-1 rounded border text-[10px] font-mono ${filterKind !== "all" ? "border-gold/60 text-gold bg-gold/10" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          <span className="inline-flex items-center gap-1">
            <Filter className="w-3 h-3" /> {filterLabel}
          </span>
          {filterKind !== "all" && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setFilterKind("all"); setFilterValue(""); }}
              className="hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
        {filterOpen && (
          <div className="mt-1.5 space-y-1.5 p-1.5 rounded border border-border bg-background/80">
            <select
              value={`${filterKind}:${filterValue}`}
              onChange={(e) => {
                const [k, v] = e.target.value.split(":", 2);
                setFilterKind(k as FilterKind);
                setFilterValue(v ?? "");
                setFilterOpen(false);
              }}
              className="w-full px-1.5 py-1 text-[10px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
            >
              <option value="all:">Todas las notas</option>
              <optgroup label="Por target">
                {targets.map((t) => (
                  <option key={t.id} value={`target:${t.id}`}>▸ {t.code} — {t.name.slice(0, 30)}</option>
                ))}
              </optgroup>
              <optgroup label="Por campaña">
                {campaigns.map((c) => (
                  <option key={c.id} value={`campaign:${c.id}`}>⊙ {c.name.slice(0, 32)}</option>
                ))}
              </optgroup>
              <optgroup label="Por fase">
                {SAMPLING_PHASES.map((p) => (
                  <option key={p} value={`phase:${p}`}>⌬ {p}</option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
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
          <div className="grid grid-cols-1 gap-1">
            <select
              value={draftTarget}
              onChange={(e) => setDraftTarget(e.target.value)}
              className="w-full px-1.5 py-1 text-[10px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
            >
              <option value="">▸ Sin target asociado</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.code} — {t.name.slice(0, 28)}</option>
              ))}
            </select>
            <select
              value={draftCampaign}
              onChange={(e) => setDraftCampaign(e.target.value)}
              className="w-full px-1.5 py-1 text-[10px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
            >
              <option value="">⊙ Sin campaña</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name.slice(0, 32)}</option>
              ))}
            </select>
            <select
              value={draftPhase}
              onChange={(e) => setDraftPhase(e.target.value)}
              className="w-full px-1.5 py-1 text-[10px] font-mono rounded border border-border bg-background outline-none focus:border-gold"
            >
              <option value="">⌬ Sin fase de muestreo</option>
              {SAMPLING_PHASES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
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
        {filtered.length === 0 ? (
          <div className="px-2 py-4 text-center text-[10px] font-mono text-muted-foreground">
            {filterKind !== "all"
              ? "Sin notas para este filtro."
              : "Sin notas. Crea pines con observaciones estructurales, targets o tareas pendientes."}
          </div>
        ) : (
          filtered.map((a) => (
            <AnnotationRow
              key={a.id}
              a={a}
              targetCode={a.target_id ? targetMap.get(a.target_id)?.code ?? null : null}
              campaignName={a.campaign_id ? campaignMap.get(a.campaign_id)?.name ?? null : null}
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
    </div>
    <ExportAnnotationsPreview
      open={previewFormat !== null}
      format={previewFormat ?? "csv"}
      annotations={filtered}
      totalAnnotations={annotations.length}
      projectName={projectName ?? "proyecto"}
      targetMap={targetMap}
      campaignMap={campaignMap}
      userMap={userMap}
      filterSummary={filterLabel}
      showResolved={showResolved}
      onClose={() => setPreviewFormat(null)}
    />
    </>
  );
}

interface RowProps {
  a: MapAnnotation;
  targetCode: string | null;
  campaignName: string | null;
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
  targetCode,
  campaignName,
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
  const [historyOpen, setHistoryOpen] = useState(false);
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
              {(targetCode || campaignName || a.phase) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {targetCode && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-mono bg-blue-500/15 text-blue-400">
                      <TargetIcon className="w-2.5 h-2.5" /> {targetCode}
                    </span>
                  )}
                  {campaignName && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-mono bg-purple-500/15 text-purple-400">
                      <Calendar className="w-2.5 h-2.5" /> {campaignName.slice(0, 18)}
                    </span>
                  )}
                  {a.phase && (
                    <span className="px-1 py-0 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400">
                      ⌬ {a.phase}
                    </span>
                  )}
                </div>
              )}
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
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className={`p-1 hover:text-foreground ${historyOpen ? "text-gold" : "text-muted-foreground"}`}
                title="Historial de cambios"
              >
                <History className="w-3 h-3" />
              </button>
              <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {historyOpen && <AnnotationHistoryPanel annotationId={a.id} />}
    </div>
  );
}

function AnnotationHistoryPanel({ annotationId }: { annotationId: string }) {
  const { entries, loading } = useAnnotationHistory(annotationId);
  return (
    <div className="mt-1.5 ml-4 pl-2 border-l border-border space-y-1">
      {loading ? (
        <div className="text-[9px] font-mono text-muted-foreground">Cargando historial…</div>
      ) : entries.length === 0 ? (
        <div className="text-[9px] font-mono text-muted-foreground">Sin historial.</div>
      ) : (
        entries.map((e, i) => {
          const prev = entries[i + 1]?.payload ?? null;
          const diffs = e.action === "UPDATE" ? summarizeDiff(e.payload, prev) : [];
          const actionLabel =
            e.action === "INSERT" ? "creó" :
            e.action === "DELETE" ? "eliminó" :
            (e.payload as { resolved?: boolean } | null)?.resolved !== (prev as { resolved?: boolean } | null)?.resolved
              ? ((e.payload as { resolved?: boolean } | null)?.resolved ? "marcó resuelta" : "reabrió")
              : "editó";
          const tone =
            e.action === "INSERT" ? "text-emerald-400" :
            e.action === "DELETE" ? "text-destructive" :
            "text-blue-400";
          return (
            <div key={e.id} className="text-[9px] font-mono leading-tight">
              <div>
                <span className={tone}>{actionLabel}</span>{" "}
                <span className="text-foreground">{e.user_name ?? "—"}</span>
              </div>
              <div className="text-muted-foreground">
                {new Date(e.created_at).toLocaleString("es-CL")}
              </div>
              {diffs.length > 0 && (
                <div className="text-muted-foreground/80 italic">
                  {diffs.join(" · ")}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

