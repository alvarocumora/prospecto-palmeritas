import {
  X,
  ExternalLink,
  FlaskConical,
  Drill,
  Map as MapIcon,
  Activity,
  Plane,
  Image as ImageIcon,
  Target as TargetIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { SamplingResult } from "@/hooks/useSamplingResults";
import type { DrillHole } from "@/hooks/useDrilling";
import type { MiningConcession } from "@/hooks/useMiningConcessions";
import type { GeophysicsStation } from "@/hooks/useGeophysicsData";
import type { DroneFlight, DroneRaster } from "@/hooks/useDroneFlights";
import type { ExplorationTarget } from "@/hooks/useExplorationTargets";
import { auColor } from "./sampleColors";

export type InspectedFeature =
  | { kind: "sample"; data: SamplingResult }
  | { kind: "drill"; data: DrillHole }
  | { kind: "concession"; data: MiningConcession }
  | { kind: "station"; data: GeophysicsStation }
  | { kind: "drone_flight"; data: DroneFlight }
  | { kind: "drone_raster"; data: DroneRaster }
  | { kind: "target"; data: ExplorationTarget };

interface Props {
  feature: InspectedFeature | null;
  onClose: () => void;
}

export function FeatureInspectorPanel({ feature, onClose }: Props) {
  if (!feature) return null;
  return (
    <aside
      className="
        absolute z-[600] bg-bg-secondary border-border shadow-2xl overflow-y-auto
        max-md:left-0 max-md:right-0 max-md:bottom-0 max-md:max-h-[50vh] max-md:border-t max-md:rounded-t-lg
        md:top-3 md:right-16 md:bottom-3 md:w-80 md:rounded-lg md:border
      "
    >
      <div className="sticky top-0 z-10 px-3 py-2 border-b border-border bg-bg-secondary flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          {iconFor(feature.kind)}
          <span>{labelFor(feature.kind)}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 text-xs font-mono">
        {feature.kind === "sample" && <SampleBody s={feature.data} />}
        {feature.kind === "drill" && <DrillBody h={feature.data} />}
        {feature.kind === "concession" && <ConcessionBody c={feature.data} />}
        {feature.kind === "station" && <StationBody s={feature.data} />}
        {feature.kind === "drone_flight" && <FlightBody f={feature.data} />}
        {feature.kind === "drone_raster" && <RasterBody r={feature.data} />}
        {feature.kind === "target" && <TargetBody t={feature.data} />}
      </div>
    </aside>
  );
}

function iconFor(k: InspectedFeature["kind"]) {
  if (k === "sample") return <FlaskConical className="w-3 h-3 text-teal" />;
  if (k === "drill") return <Drill className="w-3 h-3 text-copper" />;
  if (k === "concession") return <MapIcon className="w-3 h-3 text-gold" />;
  if (k === "drone_flight") return <Plane className="w-3 h-3 text-info" />;
  if (k === "drone_raster") return <ImageIcon className="w-3 h-3 text-gold" />;
  if (k === "target") return <TargetIcon className="w-3 h-3 text-gold" />;
  return <Activity className="w-3 h-3 text-info" />;
}
function labelFor(k: InspectedFeature["kind"]) {
  return {
    sample: "Muestra",
    drill: "Sondaje",
    concession: "Concesión",
    station: "Estación geofísica",
    drone_flight: "Vuelo dron",
    drone_raster: "Raster dron",
    target: "Target exploración",
  }[k];
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-1 border-b border-border/40">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}

function SampleBody({ s }: { s: SamplingResult }) {
  return (
    <>
      <div className="text-base font-bold text-gold mb-2">{s.sample_code}</div>
      <div className="text-[10px] uppercase text-muted-foreground mb-3">{s.sample_type}</div>
      <Row
        label="Au"
        value={
          <span style={{ color: auColor(s.au_gpt) }}>
            {s.au_gpt != null ? `${Number(s.au_gpt).toFixed(3)} g/t` : "—"}
          </span>
        }
      />
      <Row label="Ag" value={s.ag_gpt != null ? `${Number(s.ag_gpt).toFixed(2)} g/t` : "—"} />
      <Row label="Cu" value={s.cu_pct != null ? `${Number(s.cu_pct).toFixed(3)} %` : "—"} />
      <Row label="As" value={s.as_ppm != null ? `${s.as_ppm} ppm` : "—"} />
      <Row label="Sb" value={s.sb_ppm != null ? `${s.sb_ppm} ppm` : "—"} />
      <Row label="Hg" value={s.hg_ppm != null ? `${s.hg_ppm} ppm` : "—"} />
      <Row label="Lab" value={s.lab ?? "—"} />
      <Row label="Certificado" value={s.certificate ?? "—"} />
      <Row label="Fecha" value={s.sampled_at ?? "—"} />
      <Link
        to="/dashboard/sampling"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Muestreo <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function DrillBody({ h }: { h: DrillHole }) {
  return (
    <>
      <div className="text-base font-bold text-copper mb-2">{h.hole_id}</div>
      <Row label="Estado" value={h.status} />
      <Row label="Zona" value={h.target_zone ?? "—"} />
      <Row label="Az / Dip" value={`${h.azimuth ?? "—"}° / ${h.dip ?? "—"}°`} />
      <Row label="Plan" value={h.planned_depth != null ? `${h.planned_depth} m` : "—"} />
      <Row label="Real" value={h.actual_depth != null ? `${h.actual_depth} m` : "—"} />
      <Link
        to="/dashboard/drilling"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Sondajes <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function ConcessionBody({ c }: { c: MiningConcession }) {
  return (
    <>
      <div className="text-base font-bold text-gold mb-2">{c.name}</div>
      <Row label="Código" value={c.code} />
      <Row label="Tipo" value={c.concession_type} />
      <Row label="Estado" value={c.status} />
      <Row label="Titular" value={c.holder ?? "—"} />
      <Row label="Comuna" value={c.commune ?? "—"} />
      <Row label="Hectáreas" value={c.area_ha != null ? `${c.area_ha} ha` : "—"} />
      <Row label="Vence" value={c.expires_at ?? "—"} />
      <Link
        to="/catastro/mapa"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Catastro <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function StationBody({ s }: { s: GeophysicsStation }) {
  return (
    <>
      <div className="text-base font-bold text-info mb-2">{s.station_id}</div>
      <Row label="Lat / Lng" value={`${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`} />
      <Row label="MAG" value={s.mag_nt != null ? `${Number(s.mag_nt).toFixed(1)} nT` : "—"} />
      <Row
        label="IP charg."
        value={s.ip_chargeability_mvv != null ? `${s.ip_chargeability_mvv} mV/V` : "—"}
      />
      <Row
        label="Resistividad"
        value={s.ip_resistivity_ohmm != null ? `${s.ip_resistivity_ohmm} Ω·m` : "—"}
      />
      <Link
        to="/dashboard/geophysics"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Geofísica <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function FlightBody({ f }: { f: DroneFlight }) {
  return (
    <>
      <div className="text-base font-bold text-info mb-2">{f.name}</div>
      <div className="text-[10px] uppercase text-muted-foreground mb-3">{f.sensor} · drone</div>
      <Row label="Piloto" value={f.pilot ?? "—"} />
      <Row label="Fecha" value={f.flown_at ?? "—"} />
      <Row label="Altura" value={f.altitude_m != null ? `${f.altitude_m} m` : "—"} />
      <Row label="Área" value={f.area_ha != null ? `${f.area_ha} ha` : "—"} />
      {f.notes && <Row label="Notas" value={f.notes} />}
      <Link
        to="/dashboard/drones"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Drones <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function RasterBody({ r }: { r: DroneRaster }) {
  return (
    <>
      <div className="text-base font-bold text-gold mb-2">{r.name}</div>
      <div className="text-[10px] uppercase text-muted-foreground mb-3">{r.raster_type}</div>
      <Row label="Capturado" value={r.captured_at ?? "—"} />
      <Row
        label="URL"
        value={
          <a
            href={r.url}
            target="_blank"
            rel="noopener"
            className="text-gold hover:underline truncate inline-block max-w-[140px]"
          >
            abrir ↗
          </a>
        }
      />
      <Link
        to="/dashboard/drones"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Drones <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}

function TargetBody({ t }: { t: ExplorationTarget }) {
  return (
    <>
      <div className="text-base font-bold text-gold mb-1">{t.code}</div>
      <div className="text-foreground mb-2">{t.name}</div>
      <div className="text-[10px] uppercase text-muted-foreground mb-3">
        {t.target_type}
        {t.commodity ? ` · ${t.commodity}` : ""}
      </div>
      <Row label="Etapa" value={t.stage} />
      <Row label="Prioridad" value={t.priority} />
      <Row label="Score" value={t.score != null ? `${t.score}` : "—"} />
      <Row label="Confianza" value={t.confidence_pct != null ? `${t.confidence_pct}%` : "—"} />
      <Row
        label="Lat / Lng"
        value={
          t.lat != null && t.lng != null
            ? `${Number(t.lat).toFixed(5)}, ${Number(t.lng).toFixed(5)}`
            : "—"
        }
      />
      <Row label="Elevación" value={t.elevation_m != null ? `${t.elevation_m} m` : "—"} />
      <Row label="m planeados" value={t.planned_meters != null ? `${t.planned_meters} m` : "—"} />
      <Row
        label="Costo USD"
        value={
          t.estimated_cost_usd != null ? `$${Number(t.estimated_cost_usd).toLocaleString()}` : "—"
        }
      />
      {t.rationale && (
        <div className="mt-3 p-2 rounded bg-muted/30 text-foreground/80 italic text-[10.5px]">
          {t.rationale}
        </div>
      )}
      <Link
        to="/dashboard/targets"
        className="mt-3 inline-flex items-center gap-1 text-gold hover:underline"
      >
        Ir a Targets <ExternalLink className="w-3 h-3" />
      </Link>
    </>
  );
}
