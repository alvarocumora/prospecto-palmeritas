import { Radio } from "lucide-react";
import { useGeophysicsData } from "@/hooks/useGeophysicsData";

const METHOD_SIGNATURES = [
  {
    method: "Magnetometría terrestre",
    target: "Alteración argílica avanzada",
    response: "Bajo magnético (destrucción de magnetita)",
    expected: "−100 a −200 nT sobre traza de veta",
  },
  {
    method: "Magnetometría terrestre",
    target: "Roca caja preservada",
    response: "Background regional",
    expected: "+0 a +120 nT en flancos",
  },
  {
    method: "IP — Cargabilidad",
    target: "Sulfuros diseminados (py/cpy)",
    response: "Alta cargabilidad",
    expected: "20–80 mV/V > background 10",
  },
  {
    method: "IP — Resistividad",
    target: "Vetas silicificadas + stockwork",
    response: "Alta resistividad",
    expected: "1.000–10.000 Ω·m vs 200 background",
  },
  {
    method: "CSAMT",
    target: "Raíz de veta / feeder",
    response: "Conductor profundo subvertical",
    expected: "Profundidad 400–800 m",
  },
];

const REFERENCES = [
  {
    cite: "Hedenquist, Arribas & Gonzalez-Urien (2000)",
    work: "Exploration for Epithermal Gold Deposits — Reviews in Economic Geology, vol. 13.",
    url: "https://www.segweb.org",
  },
  {
    cite: "Sillitoe (2010)",
    work: "Porphyry Copper Systems — Economic Geology 105 (1), 3–41.",
    url: "https://doi.org/10.2113/gsecongeo.105.1.3",
  },
  {
    cite: "Corbett & Leach (1998)",
    work: "Southwest Pacific Rim Gold–Copper Systems: Structure, Alteration, and Mineralization. SEG Special Pub. 6.",
    url: "https://www.segweb.org",
  },
  {
    cite: "Irvine & Smith (1990)",
    work: "Geophysical Response of Epithermal Systems — Journal of Geochemical Exploration 36 (1–3), 375–412.",
    url: "https://doi.org/10.1016/0375-6742(90)90064-G",
  },
];

export function GeophysicsModule({
  Card,
  SectionTitle,
  Badge,
}: {
  Card: React.ComponentType<{
    children: React.ReactNode;
    className?: string;
    accent?: "gold" | "copper" | "muted";
    delay?: number;
  }>;
  SectionTitle: React.ComponentType<{ icon?: any; children: React.ReactNode; sub?: string }>;
  Badge: React.ComponentType<{
    children: React.ReactNode;
    tone?: "gold" | "copper" | "teal" | "info" | "alert" | "muted";
  }>;
}) {
  const { data, loading, error } = useGeophysicsData();

  const totalCost = data?.surveys.reduce((s, x) => s + (x.cost_usd ?? 0), 0) ?? 0;
  const totalKm = data?.surveys.reduce((s, x) => s + (x.planned_km ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <SectionTitle icon={Radio} sub="Adquisición · interpretación · datos">
        Geofísica
      </SectionTitle>

      {/* Plan de adquisición */}
      <Card accent="gold">
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">
              Plan de adquisición — epitermal Au–Cu baja sulfuración
            </h3>
            <div className="flex gap-2">
              <Badge tone="gold">USD {totalCost.toLocaleString("es-CL")}</Badge>
              <Badge tone="copper">{totalKm} km lineales</Badge>
            </div>
          </div>

          {loading && <p className="text-xs text-muted-foreground font-mono">Cargando campañas…</p>}
          {error && <p className="text-xs text-alert font-mono">Error: {error}</p>}

          {data && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pr-3">Campaña</th>
                    <th className="text-left py-2 pr-3">Método</th>
                    <th className="text-right py-2 pr-3">Km</th>
                    <th className="text-right py-2 pr-3">Espac. (m)</th>
                    <th className="text-right py-2 pr-3">Prof. (m)</th>
                    <th className="text-right py-2 pr-3">Costo USD</th>
                    <th className="text-left py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.surveys.map((s) => (
                    <tr key={s.id} className="border-b border-border/40">
                      <td className="py-2 pr-3 text-foreground">{s.name}</td>
                      <td className="py-2 pr-3 text-gold">{s.method}</td>
                      <td className="py-2 pr-3 text-right">{s.planned_km ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{s.station_spacing_m ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{s.expected_depth_m ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">
                        {s.cost_usd?.toLocaleString("es-CL") ?? "—"}
                      </td>
                      <td className="py-2">
                        <Badge tone="info">{s.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Firma esperada por método */}
      <Card>
        <div className="p-5 space-y-3">
          <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">
            Respuesta esperada — vetas N20°W subverticales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3">Método</th>
                  <th className="text-left py-2 pr-3">Blanco geológico</th>
                  <th className="text-left py-2 pr-3">Firma esperada</th>
                  <th className="text-left py-2">Magnitud típica</th>
                </tr>
              </thead>
              <tbody>
                {METHOD_SIGNATURES.map((row, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-2 pr-3 text-gold">{row.method}</td>
                    <td className="py-2 pr-3 text-foreground">{row.target}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.response}</td>
                    <td className="py-2 text-foreground">{row.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Estaciones simuladas */}
      {data && data.stations.length > 0 && (
        <Card>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">
                Estaciones magnéticas — datos sintéticos
              </h3>
              <Badge tone="alert">SIMULADO ({data.stations.length} pts)</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Modelo coherente: anomalías bajas (~−100 a −200 nT) sobre la traza de vetas argílicas;
              valores altos (+50 a +120 nT) en flancos con magnetita preservada. Visibles como
              círculos en la pestaña Overview.
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded border border-border bg-bg-secondary">
                <div className="text-muted-foreground uppercase text-[10px]">Mín nT</div>
                <div className="text-foreground text-base">
                  {Math.min(...data.stations.map((s) => s.mag_nt ?? 0)).toFixed(0)}
                </div>
              </div>
              <div className="p-3 rounded border border-border bg-bg-secondary">
                <div className="text-muted-foreground uppercase text-[10px]">Promedio</div>
                <div className="text-foreground text-base">
                  {(
                    data.stations.reduce((s, x) => s + (x.mag_nt ?? 0), 0) / data.stations.length
                  ).toFixed(0)}
                </div>
              </div>
              <div className="p-3 rounded border border-border bg-bg-secondary">
                <div className="text-muted-foreground uppercase text-[10px]">Máx nT</div>
                <div className="text-foreground text-base">
                  {Math.max(...data.stations.map((s) => s.mag_nt ?? 0)).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Bibliografía */}
      <Card accent="muted">
        <div className="p-5 space-y-3">
          <h3 className="font-mono text-sm uppercase tracking-wider text-foreground">
            Bibliografía — geofísica epitermal
          </h3>
          <ul className="space-y-2 text-xs font-mono">
            {REFERENCES.map((r, i) => (
              <li key={i} className="border-l-2 border-gold/40 pl-3">
                <div className="text-foreground">{r.cite}</div>
                <div className="text-muted-foreground">{r.work}</div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info text-[10px]"
                  >
                    {r.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground/70 mt-3">
            Overlays WMS regionales disponibles en el mapa: EMAG2 v3 (NOAA NCEI, anomalía magnética
            global ~3.7 km) y WGM2012 (BGI/CGMW, gravimetría Bouguer). Ver toggle de capas arriba a
            la derecha del mapa.
          </p>
        </div>
      </Card>
    </div>
  );
}
