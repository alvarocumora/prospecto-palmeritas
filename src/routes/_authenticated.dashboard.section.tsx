// Cross-section viewer — Sprint 1
// Renderiza un corte vertical arbitrario sobre los sondajes desurveyados del
// proyecto activo. SVG ligero, sin dependencias extra.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useResourceModels } from "@/hooks/useResourceModels";
import { sectionProject } from "@/lib/miningEngine.functions";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Scissors, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/section")({
  head: () => ({
    meta: [
      { title: "Cross-section 3D — Geocapitals" },
      {
        name: "description",
        content:
          "Corte vertical arbitrario sobre sondajes desurveyados. Sprint 1 de la suite de planificación minera.",
      },
    ],
  }),
  component: SectionPage,
});

function SectionPage() {
  const { active } = useProjects();
  const sectionFn = useServerFn(sectionProject);
  const { models } = useResourceModels();
  const completeModels = useMemo(() => models.filter((m) => m.status === "complete"), [models]);

  const defaultX = Number(active?.center_lng ?? 0);
  const defaultY = Number(active?.center_lat ?? 0);

  const [originX, setOriginX] = useState<number>(defaultX);
  const [originY, setOriginY] = useState<number>(defaultY);
  const [originZ, setOriginZ] = useState<number>(0);
  const [azimuth, setAzimuth] = useState<number>(90);
  const [bandM, setBandM] = useState<number>(100);
  const [modelId, setModelId] = useState<string>("none");

  const params = active
    ? {
        projectId: active.id,
        origin_x: originX,
        origin_y: originY,
        origin_z: originZ,
        azimuth_deg: azimuth,
        band_m: bandM,
        modelId: modelId === "none" ? null : modelId,
      }
    : null;

  const query = useQuery({
    queryKey: ["section", params],
    queryFn: () => sectionFn({ data: params! }),
    enabled: !!params,
    staleTime: 30_000,
  });

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-[320px_1fr]">
      <aside className="border-r border-border bg-card p-4 space-y-4 overflow-y-auto">
        <header className="flex items-center gap-2 text-sm font-mono">
          <Scissors className="w-4 h-4 text-signal-cyan" />
          Plano de sección
        </header>

        {!active && (
          <p className="text-xs text-muted-foreground">
            Selecciona un proyecto activo para generar la sección.
          </p>
        )}

        <ControlField label="Origin X (easting / lng)">
          <Input
            type="number"
            value={originX}
            step="any"
            onChange={(e) => setOriginX(Number(e.target.value))}
          />
        </ControlField>

        <ControlField label="Origin Y (northing / lat)">
          <Input
            type="number"
            value={originY}
            step="any"
            onChange={(e) => setOriginY(Number(e.target.value))}
          />
        </ControlField>

        <ControlField label="Origin Z (m, referencia 0)">
          <Input
            type="number"
            value={originZ}
            step="any"
            onChange={(e) => setOriginZ(Number(e.target.value))}
          />
        </ControlField>

        <ControlField label={`Azimut · ${azimuth.toFixed(0)}°`}>
          <Slider
            min={0}
            max={360}
            step={1}
            value={[azimuth]}
            onValueChange={(v) => setAzimuth(v[0])}
          />
        </ControlField>

        <ControlField label={`Banda · ±${(bandM / 2).toFixed(0)} m`}>
          <Slider
            min={10}
            max={1000}
            step={10}
            value={[bandM]}
            onValueChange={(v) => setBandM(v[0])}
          />
        </ControlField>

        <ControlField label="Modelo de bloques (opcional)">
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Sin modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin modelo</SelectItem>
              {completeModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ControlField>

        <Button
          onClick={() => query.refetch()}
          disabled={!params || query.isFetching}
          size="sm"
          className="w-full"
        >
          {query.isFetching ? (
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-2" />
          )}
          Recalcular
        </Button>

        {query.data && (
          <div className="text-[10px] font-mono text-muted-foreground space-y-1 pt-2 border-t border-border">
            <div>
              Sondajes proyectados: <b>{query.data.trajectories.length}</b>
            </div>
            <div>
              s ∈ [{query.data.bounds.s_min.toFixed(0)}, {query.data.bounds.s_max.toFixed(0)}] m
            </div>
            <div>
              h ∈ [{query.data.bounds.h_min.toFixed(0)}, {query.data.bounds.h_max.toFixed(0)}] m
            </div>
          </div>
        )}

        {query.error instanceof Error && (
          <p className="text-xs text-destructive">{query.error.message}</p>
        )}
      </aside>

      <div className="relative bg-bg-panel">
        {query.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-gold" />
          </div>
        )}
        {query.data && <SectionCanvas data={query.data} />}
      </div>
    </div>
  );
}

function ControlField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-mono text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type SectionData = Awaited<ReturnType<typeof sectionProject>>;

function SectionCanvas({ data }: { data: SectionData }) {
  const W = 1200;
  const H = 700;
  const padding = 50;

  const { bounds, trajectories } = data;
  const sSpan = Math.max(bounds.s_max - bounds.s_min, 1);
  const hSpan = Math.max(bounds.h_max - bounds.h_min, 1);

  // Mantener proporción real (1:1) para no distorsionar geología.
  const usableW = W - 2 * padding;
  const usableH = H - 2 * padding;
  const scale = Math.min(usableW / sSpan, usableH / hSpan);

  const sx = (s: number) => padding + (s - bounds.s_min) * scale;
  // h positivo hacia arriba → en SVG y invertido
  const sy = (h: number) => H - padding - (h - bounds.h_min) * scale;

  const visibleHoles = useMemo(
    () => trajectories.filter((t) => t.points.some((p) => p.in_band)),
    [trajectories],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ background: "linear-gradient(180deg,#0a1224 0%,#080a14 100%)" }}
    >
      {/* Grid */}
      <GridLines bounds={bounds} sx={sx} sy={sy} W={W} H={H} padding={padding} />

      {/* Trayectorias */}
      {visibleHoles.map((t) => {
        const path = t.points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.s).toFixed(1)} ${sy(p.h).toFixed(1)}`)
          .join(" ");
        return (
          <g key={t.hole_id}>
            <path d={path} stroke="#3ed5ff" strokeWidth={1.5} fill="none" opacity={0.85} />
            {/* Collar */}
            {t.points[0] && (
              <>
                <circle
                  cx={sx(t.points[0].s)}
                  cy={sy(t.points[0].h)}
                  r={3}
                  fill="#3ed5ff"
                />
                <text
                  x={sx(t.points[0].s) + 6}
                  y={sy(t.points[0].h) - 4}
                  fill="#9ca3b4"
                  fontSize="9"
                  fontFamily="ui-monospace,monospace"
                >
                  {t.hole_code ?? t.hole_id.slice(0, 6)}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Línea de plano (origen 0) */}
      <line
        x1={sx(0)}
        y1={padding}
        x2={sx(0)}
        y2={H - padding}
        stroke="#facc15"
        strokeDasharray="4 4"
        strokeWidth={1}
        opacity={0.5}
      />

      {visibleHoles.length === 0 && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fill="#6b7080"
          fontFamily="ui-monospace,monospace"
          fontSize="14"
        >
          Sin sondajes dentro de la banda · ajusta origen, azimut o ancho
        </text>
      )}
    </svg>
  );
}

function GridLines({
  bounds,
  sx,
  sy,
  W,
  H,
  padding,
}: {
  bounds: SectionData["bounds"];
  sx: (s: number) => number;
  sy: (h: number) => number;
  W: number;
  H: number;
  padding: number;
}) {
  // Grids cada 100 m
  const step = 100;
  const sStart = Math.ceil(bounds.s_min / step) * step;
  const sEnd = Math.floor(bounds.s_max / step) * step;
  const hStart = Math.ceil(bounds.h_min / step) * step;
  const hEnd = Math.floor(bounds.h_max / step) * step;
  const lines: React.ReactNode[] = [];
  for (let s = sStart; s <= sEnd; s += step) {
    lines.push(
      <line
        key={`v${s}`}
        x1={sx(s)}
        y1={padding}
        x2={sx(s)}
        y2={H - padding}
        stroke="#1f2937"
        strokeWidth={0.5}
      />,
      <text
        key={`vt${s}`}
        x={sx(s)}
        y={H - padding + 12}
        textAnchor="middle"
        fill="#6b7080"
        fontSize="9"
        fontFamily="ui-monospace,monospace"
      >
        {s}
      </text>,
    );
  }
  for (let h = hStart; h <= hEnd; h += step) {
    lines.push(
      <line
        key={`h${h}`}
        x1={padding}
        y1={sy(h)}
        x2={W - padding}
        y2={sy(h)}
        stroke="#1f2937"
        strokeWidth={0.5}
      />,
      <text
        key={`ht${h}`}
        x={padding - 6}
        y={sy(h) + 3}
        textAnchor="end"
        fill="#6b7080"
        fontSize="9"
        fontFamily="ui-monospace,monospace"
      >
        {h}
      </text>,
    );
  }
  return <g>{lines}</g>;
}
