import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Wifi,
  WifiOff,
  Crosshair,
  AlertCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useSurvey, useGeophysicsMutations } from "@/hooks/useGeophysicsCRUD";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation, haversineMeters } from "@/hooks/useGeolocation";
import { useOfflineQueue, type QueuedStation } from "@/hooks/useOfflineQueue";
import { FieldCaptureMap } from "@/components/geophysics/FieldCaptureMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/geophysics/$surveyId/field")({
  head: () => ({ meta: [{ title: "Modo terreno — Geocapitals" }] }),
  component: FieldMode,
});

function FieldMode() {
  const { surveyId } = Route.useParams();
  const { active } = useProjects();
  const { user } = useAuth();
  const { survey, lines, stations, loading, refresh } = useSurvey(surveyId);
  const { createStation } = useGeophysicsMutations();
  const { position, status, error: gpsError } = useGeolocation(true);
  const { queue, online, enqueue, remove } = useOfflineQueue();

  const [mag, setMag] = useState("");
  const [ipC, setIpC] = useState("");
  const [ipR, setIpR] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(true);

  const projectCenter = useMemo(
    () =>
      active?.center_lat != null && active?.center_lng != null
        ? { lat: Number(active.center_lat), lng: Number(active.center_lng) }
        : null,
    [active],
  );

  const distFromCenter = useMemo(() => {
    if (!position || !projectCenter) return null;
    return haversineMeters(position, projectCenter);
  }, [position, projectCenter]);

  const nextStationId = useMemo(() => {
    const nums = stations
      .map((s) => /(\d+)$/.exec(s.station_id)?.[1])
      .filter((x): x is string => !!x)
      .map((x) => parseInt(x, 10));
    const max = nums.length ? Math.max(...nums) : 0;
    return `ST-${String(max + 1).padStart(3, "0")}`;
  }, [stations]);

  // Auto-flush queue when back online
  useEffect(() => {
    if (!online || queue.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const q of queue) {
        if (cancelled) break;
        const { error } = await supabase.from("geophysics_stations").insert({
          project_id: q.projectId,
          survey_id: q.surveyId,
          created_by: q.created_by,
          station_id: q.station_id,
          lat: q.lat,
          lng: q.lng,
          mag_nt: q.mag_nt,
          ip_chargeability_mvv: q.ip_chargeability_mvv,
          ip_resistivity_ohmm: q.ip_resistivity_ohmm,
          notes: q.notes,
          is_synthetic: false,
        });
        if (!error) {
          remove(q.id);
        } else {
          break;
        }
      }
      refresh();
      if (!cancelled) toast.success("Cola sincronizada");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!survey || !active || !user) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Cargando proyecto y sesión…
      </div>
    );
  }

  if (survey.project_id !== active.id) {
    return <div className="p-6 text-sm">La campaña no pertenece al proyecto seleccionado.</div>;
  }

  const accuracy = position?.accuracy ?? null;
  const accColor =
    accuracy == null
      ? "bg-muted text-muted-foreground"
      : accuracy < 10
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
        : accuracy < 30
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "bg-red-500/15 text-red-400 border-red-500/30";

  const handleCapture = async () => {
    if (!position) {
      toast.error("Sin señal GPS todavía");
      return;
    }
    setSaving(true);
    const payload = {
      station_id: nextStationId,
      lat: position.lat,
      lng: position.lng,
      mag_nt: mag === "" ? null : Number(mag),
      ip_chargeability_mvv: ipC === "" ? null : Number(ipC),
      ip_resistivity_ohmm: ipR === "" ? null : Number(ipR),
      notes: notes || null,
      is_synthetic: false,
    };
    try {
      if (!online) throw new Error("offline");
      await createStation(active.id, survey.id, payload);
      toast.success(`Estación ${nextStationId} guardada`);
      setMag("");
      setIpC("");
      setIpR("");
      setNotes("");
      refresh();
    } catch (_e) {
      // queue
      enqueue({
        projectId: active.id,
        surveyId: survey.id,
        created_by: user.id,
        station_id: payload.station_id,
        lat: payload.lat,
        lng: payload.lng,
        mag_nt: payload.mag_nt,
        ip_chargeability_mvv: payload.ip_chargeability_mvv,
        ip_resistivity_ohmm: payload.ip_resistivity_ohmm,
        notes: payload.notes,
      });
      toast.warning(`Sin conexión — ${nextStationId} encolada`);
      setMag("");
      setIpC("");
      setIpR("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  };

  const recent = [...stations].sort((a, b) => (a.station_id < b.station_id ? 1 : -1)).slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[200px]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/dashboard/geophysics/$surveyId"
            search={{ project: active.id }}
            params={{ surveyId: survey.id }}
            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-gold"
          >
            <ArrowLeft className="w-3 h-3" /> Salir
          </Link>
          <div className="text-[10px] uppercase font-mono text-muted-foreground truncate">
            {survey.name}
          </div>
          <div
            className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${online ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10"}`}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </header>

      {/* GPS status panel */}
      <section className="px-4 py-3 grid grid-cols-2 gap-2">
        <div className={`rounded border px-3 py-2 ${accColor}`}>
          <div className="text-[10px] uppercase font-mono opacity-70">Precisión GPS</div>
          <div className="text-lg font-bold font-mono">
            {accuracy != null ? `±${accuracy.toFixed(0)} m` : "—"}
          </div>
        </div>
        <div className="rounded border border-border bg-card px-3 py-2">
          <div className="text-[10px] uppercase font-mono text-muted-foreground">
            Distancia centro
          </div>
          <div className="text-lg font-bold font-mono">
            {distFromCenter != null
              ? distFromCenter < 1000
                ? `${distFromCenter.toFixed(0)} m`
                : `${(distFromCenter / 1000).toFixed(2)} km`
              : "—"}
          </div>
        </div>
        <div className="col-span-2 rounded border border-border bg-card px-3 py-2 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Posición</span>
            <span className="text-[9px] uppercase opacity-60">{status}</span>
          </div>
          <div className="text-foreground">
            {position
              ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}${position.altitude != null ? ` · ${position.altitude.toFixed(0)} m` : ""}`
              : (gpsError ?? "Esperando señal…")}
          </div>
        </div>
        {gpsError && (
          <div className="col-span-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400 inline-flex items-center gap-2">
            <AlertCircle className="w-3 h-3" /> {gpsError}
          </div>
        )}
      </section>

      {/* Map */}
      <section className="px-4">
        <button
          onClick={() => setShowMap((v) => !v)}
          className="text-[10px] uppercase font-mono text-muted-foreground hover:text-gold mb-1"
        >
          {showMap ? "Ocultar mapa" : "Mostrar mapa"}
        </button>
        {showMap && (
          <div className="h-[240px] mb-3">
            <FieldCaptureMap
              userLat={position?.lat ?? null}
              userLng={position?.lng ?? null}
              accuracy={accuracy}
              projectCenter={projectCenter}
              stations={stations}
              lines={lines}
            />
          </div>
        )}
      </section>

      {/* Capture form */}
      <section className="px-4 space-y-3">
        <div className="rounded border border-border bg-card px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase font-mono text-muted-foreground">
              Próxima estación
            </div>
            <div className="text-sm font-bold text-gold font-mono">{nextStationId}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FieldInput label="Mag (nT)" value={mag} onChange={setMag} />
            <FieldInput label="IP Carg" value={ipC} onChange={setIpC} />
            <FieldInput label="IP Resist" value={ipR} onChange={setIpR} />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas de campo…"
            rows={2}
            className="input mt-2 w-full text-sm"
          />
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="rounded border border-border bg-card">
            <div className="px-3 py-2 border-b border-border text-[10px] uppercase font-mono text-muted-foreground">
              Últimas {recent.length} estaciones
            </div>
            <ul className="divide-y divide-border">
              {recent.map((s) => (
                <li key={s.id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono font-semibold">{s.station_id}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                      {s.mag_nt != null && ` · ${s.mag_nt} nT`}
                    </div>
                  </div>
                  <MapPin className="w-3 h-3 text-gold" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Queue */}
        {queue.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5">
            <div className="px-3 py-2 border-b border-amber-500/20 text-[10px] uppercase font-mono text-amber-400 flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Cola offline ({queue.length})
              </span>
            </div>
            <ul className="divide-y divide-amber-500/10 max-h-32 overflow-auto">
              {queue.map((q: QueuedStation) => (
                <li key={q.id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <div className="font-mono">
                    {q.station_id}{" "}
                    <span className="text-muted-foreground">
                      {q.lat.toFixed(4)}, {q.lng.toFixed(4)}
                    </span>
                  </div>
                  <button
                    onClick={() => remove(q.id)}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Sticky capture button */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur border-t border-border p-3">
        <button
          onClick={handleCapture}
          disabled={saving || !position}
          className="w-full inline-flex items-center justify-center gap-2 bg-gold text-background font-bold rounded-lg py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Crosshair className="w-5 h-5" />
          )}
          {saving ? "Guardando…" : `Capturar ${nextStationId}`}
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase font-mono text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input w-full text-sm mt-0.5"
      />
    </label>
  );
}
