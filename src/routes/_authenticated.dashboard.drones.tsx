import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plane, Image as ImageIcon, Trash2, Upload, Plus, FileImage, GitCompareArrows, Boxes } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import {
  useDroneFlights,
  createFlight,
  deleteFlight,
  createRaster,
  deleteRaster,
} from "@/hooks/useDroneFlights";
import { parseGeoFile } from "@/lib/geo/parseKml";
import { RasterUploader } from "@/components/drones/RasterUploader";
import { useDroneAnalysis, deleteDemDiff, deleteStockpile } from "@/hooks/useDroneAnalysis";
import { DemDiffDialog } from "@/components/drones/DemDiffDialog";
import { StockpileDialog } from "@/components/drones/StockpileDialog";
import { DiffTable, StockpileTable } from "@/components/drones/AnalysisTables";

export const Route = createFileRoute("/_authenticated/dashboard/drones")({
  head: () => ({
    meta: [
      { title: "Drones — Geocapitals" },
      { name: "description", content: "CRUD de vuelos de dron y rasters (orto, DEM, mag-grid) sobre el proyecto." },
    ],
  }),
  component: DronesPage,
});

const SENSORS = ["rgb", "mag", "lidar", "multispectral", "thermal"];
const RASTER_TYPES = ["ortho", "dem", "mag_grid", "ndvi", "thermal"];

function DronesPage() {
  const { active } = useProjects();
  const { user } = useAuth();
  const { flights, rasters, loading, refresh } = useDroneFlights(active?.id ?? null);
  const { diffs, stockpiles, loading: loadingAnalysis, refresh: refreshAnalysis } = useDroneAnalysis(active?.id ?? null);
  const [tab, setTab] = useState<"flights" | "rasters" | "diffs" | "stockpiles">("flights");
  const [showFlight, setShowFlight] = useState(false);
  const [showRaster, setShowRaster] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showStockpile, setShowStockpile] = useState(false);

  if (!active) {
    return <div className="p-6 text-sm font-mono text-muted-foreground">Selecciona un proyecto activo.</div>;
  }
  if (!user) return null;

  const onDeleteFlight = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar vuelo "${name}"?`)) return;
    const { error } = await deleteFlight(id);
    if (error) toast.error(error.message);
    else { toast.success("Vuelo eliminado"); refresh(); }
  };
  const onDeleteRaster = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar raster "${name}"?`)) return;
    const { error } = await deleteRaster(id);
    if (error) toast.error(error.message);
    else { toast.success("Raster eliminado"); refresh(); }
  };
  const onDeleteDiff = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar análisis "${name}"?`)) return;
    const { error } = await deleteDemDiff(id);
    if (error) toast.error(error.message); else { toast.success("Eliminado"); refreshAnalysis(); }
  };
  const onDeleteStockpile = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar stockpile "${name}"?`)) return;
    const { error } = await deleteStockpile(id);
    if (error) toast.error(error.message); else { toast.success("Eliminado"); refreshAnalysis(); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Geocapitals · {active.name}</div>
          <h1 className="text-xl font-mono font-semibold flex items-center gap-2"><Plane className="w-5 h-5 text-info" /> Drones</h1>
        </div>
        <div className="flex items-center gap-2">
          {tab === "rasters" && (
            <button
              onClick={() => setShowUploader(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold text-gold text-xs font-mono font-semibold hover:bg-gold/10"
              title="Subir GeoTIFF, ortofoto o DSM directamente al proyecto"
            >
              <FileImage className="w-3.5 h-3.5" /> Subir GeoTIFF
            </button>
          )}
          {(tab === "flights" || tab === "rasters") && (
            <button
              onClick={() => (tab === "flights" ? setShowFlight(true) : setShowRaster(true))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold-light"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo {tab === "flights" ? "vuelo" : "raster (URL)"}
            </button>
          )}
          {tab === "diffs" && (
            <button onClick={() => setShowDiff(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold-light">
              <GitCompareArrows className="w-3.5 h-3.5" /> Comparar DSM
            </button>
          )}
          {tab === "stockpiles" && (
            <button onClick={() => setShowStockpile(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold-light">
              <Boxes className="w-3.5 h-3.5" /> Calcular volumen
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {(["flights", "rasters", "diffs", "stockpiles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-mono border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "flights" ? `Vuelos (${flights.length})`
              : t === "rasters" ? `Rasters (${rasters.length})`
              : t === "diffs" ? `Cut/Fill (${diffs.length})`
              : `Stockpiles (${stockpiles.length})`}
          </button>
        ))}
      </div>

      {(loading || loadingAnalysis) ? (
        <div className="text-sm font-mono text-muted-foreground p-6 text-center">Cargando…</div>
      ) : tab === "flights" ? (
        <FlightsTable flights={flights} onDelete={onDeleteFlight} />
      ) : tab === "rasters" ? (
        <RastersTable rasters={rasters} onDelete={onDeleteRaster} />
      ) : tab === "diffs" ? (
        <DiffTable diffs={diffs} rasters={rasters} onDelete={onDeleteDiff} />
      ) : (
        <StockpileTable stockpiles={stockpiles} rasters={rasters} onDelete={onDeleteStockpile} />
      )}

      {showFlight && (
        <FlightDialog
          projectId={active.id}
          userId={user.id}
          onClose={() => setShowFlight(false)}
          onSaved={() => { setShowFlight(false); refresh(); }}
        />
      )}
      {showRaster && (
        <RasterDialog
          projectId={active.id}
          userId={user.id}
          flights={flights}
          onClose={() => setShowRaster(false)}
          onSaved={() => { setShowRaster(false); refresh(); }}
        />
      )}
      {showUploader && (
        <RasterUploader
          projectId={active.id}
          userId={user.id}
          flights={flights}
          onClose={() => setShowUploader(false)}
          onSaved={() => { setShowUploader(false); refresh(); }}
        />
      )}
      {showDiff && (
        <DemDiffDialog
          projectId={active.id} userId={user.id} rasters={rasters}
          onClose={() => setShowDiff(false)}
          onSaved={() => { setShowDiff(false); refreshAnalysis(); }}
        />
      )}
      {showStockpile && (
        <StockpileDialog
          projectId={active.id} userId={user.id} rasters={rasters}
          onClose={() => setShowStockpile(false)}
          onSaved={() => { setShowStockpile(false); refreshAnalysis(); }}
        />
      )}
    </div>
  );
}

function FlightsTable({
  flights,
  onDelete,
}: {
  flights: ReturnType<typeof useDroneFlights>["flights"];
  onDelete: (id: string, name: string) => void;
}) {
  if (flights.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-8 text-center text-sm font-mono text-muted-foreground">
        Aún no hay vuelos. Sube un GeoJSON o KML del path para empezar.
      </div>
    );
  }
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-muted-foreground uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Nombre</th>
            <th className="text-left px-3 py-2">Sensor</th>
            <th className="text-left px-3 py-2">Piloto</th>
            <th className="text-left px-3 py-2">Fecha</th>
            <th className="text-right px-3 py-2">Altura</th>
            <th className="text-right px-3 py-2">Área</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => (
            <tr key={f.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 font-semibold text-foreground">{f.name}</td>
              <td className="px-3 py-2 uppercase">{f.sensor}</td>
              <td className="px-3 py-2 text-muted-foreground">{f.pilot ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{f.flown_at ?? "—"}</td>
              <td className="px-3 py-2 text-right">{f.altitude_m ?? "—"}</td>
              <td className="px-3 py-2 text-right">{f.area_ha ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onDelete(f.id, f.name)} className="text-destructive hover:bg-destructive/10 p-1 rounded" aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RastersTable({
  rasters,
  onDelete,
}: {
  rasters: ReturnType<typeof useDroneFlights>["rasters"];
  onDelete: (id: string, name: string) => void;
}) {
  if (rasters.length === 0) {
    return (
      <div className="border border-dashed border-border rounded p-8 text-center text-sm font-mono text-muted-foreground">
        Aún no hay rasters. Agrega una URL pública (GeoTIFF, PNG georef) con sus bounds.
      </div>
    );
  }
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead className="bg-bg-secondary text-muted-foreground uppercase text-[10px]">
          <tr>
            <th className="text-left px-3 py-2">Nombre</th>
            <th className="text-left px-3 py-2">Tipo</th>
            <th className="text-left px-3 py-2">Capturado</th>
            <th className="text-left px-3 py-2">CRS</th>
            <th className="text-right px-3 py-2">Tamaño</th>
            <th className="text-left px-3 py-2">Origen</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rasters.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 font-semibold text-foreground">
                <div className="inline-flex items-center gap-1.5"><ImageIcon className="w-3 h-3 text-gold" /> {r.name}</div>
                {r.processing && <div className="text-[9px] text-warning">⏳ procesando metadata…</div>}
                {r.width_px && r.height_px && (
                  <div className="text-[9px] text-muted-foreground">{r.width_px}×{r.height_px}px {r.pixel_size_m ? `· ${r.pixel_size_m.toFixed(2)} m/px` : ""}</div>
                )}
              </td>
              <td className="px-3 py-2 uppercase">{r.raster_type}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.captured_at ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground text-[10px]">{r.crs ?? "—"}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{r.file_size_bytes ? `${(r.file_size_bytes / 1024 / 1024).toFixed(1)} MB` : "—"}</td>
              <td className="px-3 py-2">
                {r.storage_path ? (
                  <span className="px-1.5 py-0.5 rounded bg-gold/10 text-gold text-[9px] uppercase">Storage</span>
                ) : (
                  <a href={r.url} target="_blank" rel="noopener" className="text-gold hover:underline truncate inline-block max-w-[150px] text-[10px]">URL ext ↗</a>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onDelete(r.id, r.name)} className="text-destructive hover:bg-destructive/10 p-1 rounded" aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightDialog({
  projectId,
  userId,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [sensor, setSensor] = useState("rgb");
  const [pilot, setPilot] = useState("");
  const [flownAt, setFlownAt] = useState("");
  const [altitude, setAltitude] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [geometry, setGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const geom = parseGeoFile(text);
    if (!geom) {
      toast.error("No se pudo leer geometría del archivo (KML o GeoJSON).");
      return;
    }
    setGeometry(geom);
    setFileLabel(`${file.name} · ${geom.type}`);
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!geometry) return toast.error("Carga un archivo GeoJSON o KML con la geometría");
    setSaving(true);
    const { error } = await createFlight(
      {
        project_id: projectId,
        name: name.trim(),
        sensor,
        pilot: pilot.trim() || null,
        flown_at: flownAt || null,
        altitude_m: altitude ? Number(altitude) : null,
        area_ha: area ? Number(area) : null,
        geometry_geojson: geometry,
        notes: notes.trim() || null,
      },
      userId,
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Vuelo creado");
    onSaved();
  };

  return (
    <Modal title="Nuevo vuelo de dron" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3 text-xs font-mono">
        <Field label="Nombre" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sensor">
            <select value={sensor} onChange={(e) => setSensor(e.target.value)} className="input">
              {SENSORS.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </Field>
          <Field label="Fecha de vuelo">
            <input type="date" value={flownAt} onChange={(e) => setFlownAt(e.target.value)} className="input" />
          </Field>
          <Field label="Piloto">
            <input value={pilot} onChange={(e) => setPilot(e.target.value)} className="input" />
          </Field>
          <Field label="Altura (m)">
            <input type="number" value={altitude} onChange={(e) => setAltitude(e.target.value)} className="input" />
          </Field>
          <Field label="Área (ha)">
            <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </Field>
        <Field label="Path / AOI (GeoJSON o KML)" required>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed border-border bg-bg-secondary hover:bg-accent transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> {fileLabel || "Subir archivo .geojson o .kml"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".geojson,.json,.kml,application/json,application/vnd.google-earth.kml+xml,text/xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {geometry && (
              <div className="text-[10px] text-teal">✓ Geometría {geometry.type} cargada</div>
            )}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-gold text-bg-primary font-semibold hover:bg-gold-light disabled:opacity-50">
            {saving ? "Guardando…" : "Crear vuelo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RasterDialog({
  projectId,
  userId,
  flights,
  onClose,
  onSaved,
}: {
  projectId: string;
  userId: string;
  flights: ReturnType<typeof useDroneFlights>["flights"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("ortho");
  const [url, setUrl] = useState("");
  const [flightId, setFlightId] = useState<string>("");
  const [capturedAt, setCapturedAt] = useState("");
  const [minLng, setMinLng] = useState("");
  const [minLat, setMinLat] = useState("");
  const [maxLng, setMaxLng] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nombre obligatorio");
    if (!url.trim()) return toast.error("URL obligatoria");
    const bbox = [minLng, minLat, maxLng, maxLat].map(Number);
    if (bbox.some(Number.isNaN)) return toast.error("Bounds inválidos (4 números)");
    setSaving(true);
    const { error } = await createRaster(
      {
        project_id: projectId,
        flight_id: flightId || null,
        name: name.trim(),
        raster_type: type,
        url: url.trim(),
        bounds_geojson: { bbox },
        captured_at: capturedAt || null,
      },
      userId,
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Raster creado");
    onSaved();
  };

  return (
    <Modal title="Nuevo raster" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3 text-xs font-mono">
        <Field label="Nombre" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {RASTER_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </Field>
          <Field label="Capturado">
            <input type="date" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="URL pública (PNG/JPG georef o tile)" required>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/ortho.png" className="input" />
        </Field>
        <Field label="Vuelo asociado (opcional)">
          <select value={flightId} onChange={(e) => setFlightId(e.target.value)} className="input">
            <option value="">— Ninguno —</option>
            {flights.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Bounds (lng/lat)</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={minLng} onChange={(e) => setMinLng(e.target.value)} placeholder="minLng" className="input" />
            <input value={minLat} onChange={(e) => setMinLat(e.target.value)} placeholder="minLat" className="input" />
            <input value={maxLng} onChange={(e) => setMaxLng(e.target.value)} placeholder="maxLng" className="input" />
            <input value={maxLat} onChange={(e) => setMaxLat(e.target.value)} placeholder="maxLat" className="input" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-gold text-bg-primary font-semibold hover:bg-gold-light disabled:opacity-50">
            {saving ? "Guardando…" : "Crear raster"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-mono font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase text-muted-foreground mb-1 inline-block">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {children}
      <style>{`.input{width:100%;padding:6px 8px;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:4px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:hsl(var(--foreground))}`}</style>
    </label>
  );
}
