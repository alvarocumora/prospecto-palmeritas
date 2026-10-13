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

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>Tenencia y evidencia · Los Verdes</Eyebrow>
          <h3 className="mt-2 font-display text-xl text-content">Cartera integrada declarada</h3>
        </div>
        <span className="font-mono text-xs text-content-subtle">
          Fuente cartográfica: SERNAGEOMIN
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Pertenencias del paquete" value={counts?.projectPackage ?? "—"} />
        <Metric
          label="Superficie mapeada (ha)"
          value={counts?.projectPackageHa?.toLocaleString("es-CL") ?? "—"}
        />
        <Metric label="Arranque (ha)" value={counts?.arranqueHa?.toLocaleString("es-CL") ?? "—"} />
        <Metric label="Anexos (ha)" value={counts?.annexHa?.toLocaleString("es-CL") ?? "—"} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Anexos en trámite (ha)"
          value={counts?.annexPendingHa?.toLocaleString("es-CL") ?? "—"}
        />
        <Metric
          label="Objetivo distrital (ha)"
          value={counts?.objectiveHa?.toLocaleString("es-CL") ?? "—"}
        />
        <Metric
          label="Saldo por confirmar (ha)"
          value={counts?.unconfirmedHa?.toLocaleString("es-CL") ?? "—"}
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Metric label="Targets con ubicación" value={counts?.targets ?? "—"} />
        <Metric label="Anomalías satelitales con ubicación" value={counts?.satAnomalies ?? "—"} />
        <Metric label="Muestras con ubicación" value={counts?.samples ?? "—"} />
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
