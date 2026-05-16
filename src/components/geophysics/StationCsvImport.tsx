import { useMemo, useState } from "react";
import { Upload, X, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ParsedRow = {
  rowNum: number;
  station_id: string;
  lat: number | null;
  lng: number | null;
  mag_nt: number | null;
  ip_chargeability_mvv: number | null;
  ip_resistivity_ohmm: number | null;
  notes: string | null;
  errors: string[];
};

const REQUIRED = ["station_id", "lat", "lng"] as const;
const OPTIONAL = ["mag_nt", "ip_chargeability_mvv", "ip_resistivity_ohmm", "notes"] as const;
const ALL_FIELDS = [...REQUIRED, ...OPTIONAL];

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const c of candidates) {
    const n = line.split(c).length;
    if (n > bestCount) {
      bestCount = n;
      best = c;
    }
  }
  return best;
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function toNum(s: string): number | null {
  if (s === "" || s == null) return null;
  // accept comma decimal
  const norm = s.replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : (NaN as unknown as number);
}

function parseCsv(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], headerError: "Archivo vacío" };
  const delim = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delim).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((r) => !headers.includes(r));
  if (missing.length) {
    return { rows: [], headerError: `Faltan columnas obligatorias: ${missing.join(", ")}` };
  }
  const idx: Record<string, number> = {};
  ALL_FIELDS.forEach((f) => {
    idx[f] = headers.indexOf(f);
  });

  const seen = new Set<string>();
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delim);
    const errors: string[] = [];

    const station_id = (cells[idx.station_id] ?? "").trim();
    if (!station_id) errors.push("station_id vacío");
    else if (seen.has(station_id)) errors.push("station_id duplicado en archivo");
    else seen.add(station_id);

    const latRaw = cells[idx.lat] ?? "";
    const lngRaw = cells[idx.lng] ?? "";
    const lat = toNum(latRaw);
    const lng = toNum(lngRaw);
    if (lat === null || Number.isNaN(lat)) errors.push("lat inválida");
    else if (lat < -90 || lat > 90) errors.push("lat fuera de rango");
    if (lng === null || Number.isNaN(lng)) errors.push("lng inválida");
    else if (lng < -180 || lng > 180) errors.push("lng fuera de rango");

    const optNum = (key: (typeof OPTIONAL)[number]) => {
      if (idx[key] < 0) return null;
      const raw = cells[idx[key]] ?? "";
      if (raw === "") return null;
      const n = toNum(raw);
      if (n === null || Number.isNaN(n)) {
        errors.push(`${key} inválida`);
        return null;
      }
      return n;
    };
    const mag_nt = optNum("mag_nt");
    const ip_chargeability_mvv = optNum("ip_chargeability_mvv");
    const ip_resistivity_ohmm = optNum("ip_resistivity_ohmm");
    const notes = idx.notes >= 0 ? (cells[idx.notes] ?? "").trim() || null : null;

    rows.push({
      rowNum: i + 1,
      station_id,
      lat: Number.isNaN(lat as number) ? null : lat,
      lng: Number.isNaN(lng as number) ? null : lng,
      mag_nt,
      ip_chargeability_mvv,
      ip_resistivity_ohmm,
      notes,
      errors,
    });
  }
  return { rows, headerError: null };
}

const TEMPLATE = `station_id,lat,lng,mag_nt,ip_chargeability_mvv,ip_resistivity_ohmm,notes
ST-001,-33.4569,-70.6483,45200,12.5,350,Estación ejemplo
ST-002,-33.4571,-70.6480,45180,11.8,420,
ST-003,-33.4573,-70.6477,45350,15.2,280,Anomalía moderada`;

export function StationCsvImport({
  projectId,
  surveyId,
  onClose,
  onSaved,
}: {
  projectId: string;
  surveyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const parsed = useMemo(() => (text ? parseCsv(text) : { rows: [], headerError: null }), [text]);
  const validRows = parsed.rows.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.rows.filter((r) => r.errors.length > 0);

  const handleFile = async (file: File) => {
    const t = await file.text();
    setText(t);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "estaciones_plantilla.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!user) {
      toast.error("Sin sesión");
      return;
    }
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setImporting(true);
    try {
      const payload = validRows.map((r) => ({
        project_id: projectId,
        survey_id: surveyId,
        created_by: user.id,
        station_id: r.station_id,
        lat: r.lat as number,
        lng: r.lng as number,
        mag_nt: r.mag_nt,
        ip_chargeability_mvv: r.ip_chargeability_mvv,
        ip_resistivity_ohmm: r.ip_resistivity_ohmm,
        is_synthetic: false,
        notes: r.notes,
      }));
      const CHUNK = 200;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const { error } = await supabase.from("geophysics_stations").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      toast.success(`${inserted} estaciones importadas`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const preview = parsed.rows.slice(0, 50);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-lg w-full max-w-4xl my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-mono uppercase tracking-wide flex items-center gap-2">
            <Upload className="w-4 h-4 text-gold" /> Importar estaciones desde CSV
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Source */}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                Archivo CSV
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gold file:text-bg-primary file:font-mono file:cursor-pointer"
              />
              <button
                onClick={downloadTemplate}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-info hover:underline"
              >
                <FileText className="w-3 h-3" /> Descargar plantilla
              </button>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                o pegar contenido
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="station_id,lat,lng,mag_nt,..."
                rows={4}
                className="w-full text-[11px] font-mono bg-bg-secondary border border-border rounded p-2 resize-y"
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-muted-foreground">
            <strong className="text-foreground">Columnas requeridas:</strong> station_id, lat, lng ·
            <strong className="text-foreground"> opcionales:</strong> mag_nt, ip_chargeability_mvv,
            ip_resistivity_ohmm, notes · separadores: <code>, ; \t</code>
          </div>

          {/* Status */}
          {parsed.headerError && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive">
              {parsed.headerError}
            </div>
          )}
          {parsed.rows.length > 0 && (
            <div className="flex flex-wrap gap-3 text-xs font-mono">
              <span className="inline-flex items-center gap-1 text-teal">
                <CheckCircle2 className="w-3 h-3" /> {validRows.length} válidas
              </span>
              <span className="inline-flex items-center gap-1 text-alert">
                <AlertTriangle className="w-3 h-3" /> {invalidRows.length} con errores
              </span>
              <span className="text-muted-foreground">Total filas: {parsed.rows.length}</span>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="rounded border border-border overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="bg-bg-secondary text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-1.5 px-2 w-10">#</th>
                    <th className="text-left py-1.5 px-2">station_id</th>
                    <th className="text-right py-1.5 px-2">lat</th>
                    <th className="text-right py-1.5 px-2">lng</th>
                    <th className="text-right py-1.5 px-2">mag_nt</th>
                    <th className="text-right py-1.5 px-2">ip_c</th>
                    <th className="text-right py-1.5 px-2">ip_r</th>
                    <th className="text-left py-1.5 px-2">estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr
                      key={r.rowNum}
                      className={`border-b border-border/40 ${r.errors.length ? "bg-destructive/5" : ""}`}
                    >
                      <td className="py-1 px-2 text-muted-foreground">{r.rowNum}</td>
                      <td className="py-1 px-2">
                        {r.station_id || <span className="text-destructive">∅</span>}
                      </td>
                      <td className="py-1 px-2 text-right">{r.lat ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.lng ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.mag_nt ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.ip_chargeability_mvv ?? "—"}</td>
                      <td className="py-1 px-2 text-right">{r.ip_resistivity_ohmm ?? "—"}</td>
                      <td className="py-1 px-2">
                        {r.errors.length === 0 ? (
                          <span className="text-teal">OK</span>
                        ) : (
                          <span className="text-destructive" title={r.errors.join("; ")}>
                            {r.errors[0]}
                            {r.errors.length > 1 ? ` +${r.errors.length - 1}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > preview.length && (
                <div className="text-[10px] font-mono text-muted-foreground p-2 text-center border-t border-border">
                  Mostrando {preview.length} de {parsed.rows.length} filas
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border bg-bg-secondary/50">
          <button
            onClick={onClose}
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gold text-bg-primary text-xs font-mono font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Importar {validRows.length} estaciones
          </button>
        </div>
      </div>
    </div>
  );
}
