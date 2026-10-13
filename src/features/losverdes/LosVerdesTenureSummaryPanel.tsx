import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLosVerdesMapData } from "@/lib/losverdes-map.functions";
import { Eyebrow } from "@/components/brand";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-subtle p-4">
      <div className="font-mono text-xl tabular-nums text-content">{value}</div>
      <div className="mt-1 text-xs text-content-subtle">{label}</div>
    </div>
  );
}

export function LosVerdesTenureSummaryPanel() {
  const fetchMapData = useServerFn(getLosVerdesMapData);
  const { data } = useQuery({ queryKey: ["losverdes-map-data"], queryFn: () => fetchMapData() });
  const counts = data?.counts;
  const tenure = data?.tenure;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>Evidencia geocientífica · Los Verdes</Eyebrow>
          <h3 className="mt-2 font-display text-xl text-content">Inventario disponible</h3>
        </div>
        <span className="font-mono text-xs text-content-subtle">
          Fuente cartográfica: SERNAGEOMIN
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Targets interpretados" value={counts?.targets ?? "—"} />
        <Metric label="Anomalías Sentinel-2 derivadas" value={counts?.satAnomalies ?? "—"} />
        <Metric label="Muestras georreferenciadas" value={counts?.samples ?? "—"} />
      </div>
      <div className="mt-4 rounded-xl border border-hairline bg-surface-subtle p-4 text-xs leading-relaxed text-content-subtle">
        Tenencia declarada: {tenure?.ownCount ?? "—"} concesiones propias registradas (
        {tenure?.ownHa.toLocaleString("es-CL") ?? "—"} ha); vecinos mayores:{" "}
        {tenure?.neighborCount ?? "—"} ({tenure?.neighborHa.toLocaleString("es-CL") ?? "—"} ha). La
        asociación no acredita propiedad, opción ni contrato vigente.
      </div>
      <p className="mt-4 border-t border-hairline pt-3 text-xs leading-relaxed text-content-subtle">
        La asociación al proyecto es declarada y multi-titular; no acredita propiedad, opción ni
        contrato vigente. Las 300 ha en trámite y el saldo distrital requieren verificación
        documental. Proyecto en fase de exploración pre-NI 43-101 / pre-JORC, sin recursos ni
        reservas certificados. Conteos de targets, anomalías y muestras se consultan en el visor y
        corresponden a registros georreferenciados disponibles.
      </p>
    </section>
  );
}
