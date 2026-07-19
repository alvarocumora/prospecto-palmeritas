import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, Map as MapIcon, CheckCircle2, XCircle } from "lucide-react";
import {
  getProjectConcessions,
  saveProjectConcessions,
  type Concession,
} from "@/lib/concessions.functions";
import {
  CONCESSION_TYPES,
  CONCESSION_TYPE_LABELS,
  CONCESSION_STATUSES,
  CONCESSION_STATUS_LABELS,
  validateGeoJsonPolygon,
  totalAreaHa,
  type ConcessionType,
  type ConcessionStatus,
} from "@/lib/concessions";

type Draft = Omit<Concession, "id" | "geometry"> & { geoText: string };

const NEW: Draft = {
  code: "",
  name: "",
  type: "cateo",
  status: "vigente",
  holder: "",
  areaHa: null,
  region: "",
  commune: "",
  grantedAt: null,
  expiresAt: null,
  parcelIds: "",
  notes: "",
  geoText: "",
};

const toDraft = (c: Concession): Draft => ({
  code: c.code,
  name: c.name,
  type: c.type,
  status: c.status,
  holder: c.holder,
  areaHa: c.areaHa,
  region: c.region,
  commune: c.commune,
  grantedAt: c.grantedAt,
  expiresAt: c.expiresAt,
  parcelIds: c.parcelIds,
  notes: c.notes,
  geoText: c.geometry ? JSON.stringify(c.geometry) : "",
});

export function ProjectConcessions({ projectId }: { projectId: string }) {
  const getFn = useServerFn(getProjectConcessions);
  const saveFn = useServerFn(saveProjectConcessions);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["project-concessions", projectId],
    queryFn: () => getFn({ data: { projectId } }),
    staleTime: 30_000,
  });

  const [rows, setRows] = useState<Draft[]>([]);
  useEffect(() => {
    if (data) setRows(data.concessions.map(toDraft));
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      // Valida polígonos antes de enviar.
      const payload = rows
        .filter((r) => r.code.trim() && r.name.trim())
        .map((r) => {
          const geo = validateGeoJsonPolygon(r.geoText);
          if (!geo.ok) throw new Error(`Polígono inválido en "${r.code || r.name}": ${geo.error}`);
          return {
            code: r.code.trim(),
            name: r.name.trim(),
            type: r.type,
            status: r.status,
            holder: r.holder?.trim() || null,
            areaHa: r.areaHa,
            region: r.region?.trim() || null,
            commune: r.commune?.trim() || null,
            grantedAt: r.grantedAt || null,
            expiresAt: r.expiresAt || null,
            parcelIds: r.parcelIds?.trim() || null,
            notes: r.notes?.trim() || null,
            geometry: geo.geometry,
          };
        });
      return saveFn({ data: { projectId, concessions: payload } });
    },
    onSuccess: (res) => {
      toast.success(`Catastro guardado (${res.count} concesiones).`);
      void qc.invalidateQueries({ queryKey: ["project-concessions", projectId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar."),
  });

  const canEdit = data?.canEdit ?? false;
  const totalHa = totalAreaHa(rows.map((r) => ({ area_ha: r.areaHa })));

  const setRow = (i: number, patch: Partial<Draft>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...NEW }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  if (isLoading) return <div className="h-40 rounded bg-muted/20 animate-pulse" />;

  return (
    <section className="rounded-md border border-border bg-bg-secondary/20 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Catastro · concesiones</h2>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {rows.length} concesión{rows.length === 1 ? "" : "es"} · {totalHa.toLocaleString("es-CL")}{" "}
          ha
        </span>
      </div>

      {data?.pending && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
          El catastro estará disponible cuando se aplique la migración de{" "}
          <code>mining_concessions</code>.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">
          Sin concesiones. Agrega el expediente, superficie, titular, matrículas y el polígono.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <ConcessionRow
              key={i}
              row={r}
              canEdit={canEdit}
              onChange={(patch) => setRow(i, patch)}
              onRemove={() => removeRow(i)}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={addRow}
            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar concesión
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "Guardando…" : "Guardar catastro"}
          </button>
        </div>
      )}
    </section>
  );
}

function ConcessionRow({
  row,
  canEdit,
  onChange,
  onRemove,
}: {
  row: Draft;
  canEdit: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const geo = validateGeoJsonPolygon(row.geoText);
  const inputCls =
    "px-2 py-1.5 rounded border border-border bg-background text-xs disabled:opacity-60";
  return (
    <div className="rounded border border-border bg-background/40 p-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Labeled label="Expediente / código">
          <input
            value={row.code}
            disabled={!canEdit}
            placeholder="19.514"
            onChange={(e) => onChange({ code: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Nombre">
          <input
            value={row.name}
            disabled={!canEdit}
            placeholder="Los Toldos"
            onChange={(e) => onChange({ name: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Tipo">
          <select
            value={row.type}
            disabled={!canEdit}
            onChange={(e) => onChange({ type: e.target.value as ConcessionType })}
            className={`w-full ${inputCls}`}
          >
            {CONCESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONCESSION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Estado">
          <select
            value={row.status}
            disabled={!canEdit}
            onChange={(e) => onChange({ status: e.target.value as ConcessionStatus })}
            className={`w-full ${inputCls}`}
          >
            {CONCESSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONCESSION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Superficie (ha)">
          <input
            type="number"
            value={row.areaHa ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              onChange({ areaHa: e.target.value === "" ? null : Number(e.target.value) })
            }
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Titular">
          <input
            value={row.holder ?? ""}
            disabled={!canEdit}
            placeholder="Argencampo S.A."
            onChange={(e) => onChange({ holder: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Matrículas">
          <input
            value={row.parcelIds ?? ""}
            disabled={!canEdit}
            placeholder="224, 461"
            onChange={(e) => onChange({ parcelIds: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Región / provincia">
          <input
            value={row.region ?? ""}
            disabled={!canEdit}
            placeholder="Salta"
            onChange={(e) => onChange({ region: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Labeled label="Comuna / depto">
          <input
            value={row.commune ?? ""}
            disabled={!canEdit}
            placeholder="Santa Victoria Oeste"
            onChange={(e) => onChange({ commune: e.target.value })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Otorgado">
          <input
            type="date"
            value={row.grantedAt ?? ""}
            disabled={!canEdit}
            onChange={(e) => onChange({ grantedAt: e.target.value || null })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
        <Labeled label="Vence">
          <input
            type="date"
            value={row.expiresAt ?? ""}
            disabled={!canEdit}
            onChange={(e) => onChange({ expiresAt: e.target.value || null })}
            className={`w-full ${inputCls}`}
          />
        </Labeled>
      </div>

      <Labeled label="Polígono GeoJSON (WGS84 lng/lat) — Polygon o Feature">
        <textarea
          value={row.geoText}
          disabled={!canEdit}
          rows={2}
          placeholder='{"type":"Polygon","coordinates":[[[lng,lat],…]]}'
          onChange={(e) => onChange({ geoText: e.target.value })}
          className={`w-full font-mono ${inputCls}`}
        />
      </Labeled>
      <div className="flex items-center justify-between">
        {row.geoText.trim() === "" ? (
          <span className="text-[11px] text-muted-foreground">Sin polígono.</span>
        ) : geo.ok ? (
          <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {geo.vertexCount} vértices
          </span>
        ) : (
          <span className="text-[11px] text-red-600 inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> {geo.error}
          </span>
        )}
        {canEdit && (
          <button
            onClick={onRemove}
            className="text-[11px] text-red-500 hover:underline inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs block">
      <span className="block text-muted-foreground mb-1 text-[10px]">{label}</span>
      {children}
    </label>
  );
}
