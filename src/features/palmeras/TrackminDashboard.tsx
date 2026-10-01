import { useState } from "react";
import { CanonicalProjectViewer } from "@/components/geo/CanonicalProjectViewer";
import { ProjectMap } from "@/components/ProjectMap";
import { GeophysicsModule } from "@/components/Geophysics";
import { useGeologyData } from "@/hooks/useGeologyData";

import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  FileText,
  Info,
  Layers,
  MapPin,
  Mountain,
  Pickaxe,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  TestTube2,
  Drill,
  Calendar,
  Building2,
  ScrollText,
  Radio,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Component is exported below as TrackminGeoIntel for reuse in routes.

/* ============================================================
   PROJECT DATA
   ============================================================ */

const PROJECT = {
  name: "Prospecto Palmeras",
  ref: "TRK-ALH-001",
  operator: "Inversiones Bioenergy SpA",
  coords: "-33.898438, -71.115471",
  location: "Comuna de Alhué, Provincia Melipilla, Región Metropolitana, Chile",
  status: "Exploración Activa",
  created: "Abril 2026",
};

type TabId = "overview" | "geology" | "geophysics" | "targets" | "sampling" | "drill" | "budget";

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "geology", label: "Geology", icon: Mountain },
  { id: "geophysics", label: "Geophysics", icon: Radio },
  { id: "targets", label: "Targets", icon: Target },
  { id: "sampling", label: "Sampling", icon: TestTube2 },
  { id: "drill", label: "Drill Program", icon: Drill },
  { id: "budget", label: "Budget", icon: Wallet },
];

/* ============================================================
   PRIMITIVES
   ============================================================ */

function Card({
  children,
  className = "",
  accent,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "gold" | "copper" | "muted";
  delay?: number;
}) {
  const accentClass =
    accent === "gold"
      ? "accent-bar-gold"
      : accent === "copper"
        ? "accent-bar-copper"
        : accent === "muted"
          ? "accent-bar-muted"
          : "";
  return (
    <div
      className={`bg-card border border-border rounded-lg card-hover animate-fade-up ${accentClass} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  sub,
}: {
  icon?: typeof Activity;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-gold" />}
        <h2 className="font-mono text-lg uppercase tracking-wider text-foreground">{children}</h2>
      </div>
      {sub && <span className="font-mono text-xs text-hint uppercase tracking-wider">{sub}</span>}
    </div>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "gold" | "copper" | "teal" | "info" | "alert" | "muted";
}) {
  const tones: Record<string, string> = {
    gold: "bg-gold/15 text-gold border-gold/30",
    copper: "bg-copper/15 text-copper border-copper/30",
    teal: "bg-teal/15 text-teal border-teal/30",
    info: "bg-info/20 text-foreground border-info/40",
    alert: "bg-alert/20 text-foreground border-alert/40",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusDot({ tone }: { tone: "teal" | "gold" | "alert" }) {
  const c = tone === "teal" ? "bg-teal" : tone === "gold" ? "bg-gold" : "bg-alert";
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />;
}

/* ============================================================
   NAV
   ============================================================ */

function TopNav({
  active,
  setActive,
  onExport,
  exporting,
}: {
  active: TabId;
  setActive: (t: TabId) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 bg-bg-secondary/95 backdrop-blur border-b border-border">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-8">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-gold tracking-tight">TRACKMIN</span>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            GeoIntel
          </span>
        </div>

        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {TABS.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? "text-gold border-gold"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-card">
            <span className="font-mono text-xs text-gold">{PROJECT.ref}</span>
            <span className="w-px h-4 bg-border" />
            <StatusDot tone="teal" />
            <span className="font-mono text-[11px] uppercase text-muted-foreground tracking-wider">
              {PROJECT.status}
            </span>
          </div>
          <button
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-wait"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? "Generando…" : "Exportar PDF"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   MODULE 1 — OVERVIEW
   ============================================================ */

function Overview({ publicMode = false }: { publicMode?: boolean }) {
  const metrics = [
    { label: "Tipo Depósito", value: "Epit–Meso", sub: "Au–Cu vetas" },
    { label: "Edad Roca Caja", value: "Cret. Sup.", sub: "Fm. Lo Valle" },
    { label: "Palmeras Proxy", value: "12+", sub: "J. chilensis marcadores" },
    { label: "Labores Antiguas", value: "3+", sub: "piques + socavones" },
    { label: "Presupuesto", value: "USD 211K", sub: "Programa 12 meses" },
  ];

  const phases = [
    {
      n: 1,
      range: "Meses 1–2",
      title: "Muestreo superficial",
      desc: "chip + canal + grab",
      active: true,
    },
    { n: 2, range: "Meses 3–4", title: "Geofísica IP", desc: "lineamientos + targets drill" },
    { n: 3, range: "Meses 5–8", title: "Sondajes DDH", desc: "4 perforaciones 1,030 m" },
    { n: 4, range: "Meses 9–12", title: "Análisis + reporte", desc: "estimación recursos 43-101" },
  ];

  const alerts = [
    {
      tone: "alert",
      level: "INMEDIATA",
      text: "Chip sampling veta aflorante — sin costo análisis aún",
    },
    {
      tone: "alert",
      level: "INMEDIATA",
      text: "Canal sampling labores antiguas — geometría pendiente",
    },
    { tone: "gold", level: "ALTA", text: "Verificar concesiones SERNAGEOMIN — Portal Geomin" },
    { tone: "gold", level: "ALTA", text: "Notificar CMN — labores prehispánicas en predio" },
    { tone: "teal", level: "MEDIA", text: "Contratar geólogo QP para supervisión DDH" },
    {
      tone: "teal",
      level: "MEDIA",
      text: "Cotizar laboratorio certificado ISO 17025 (ALS / Bureau Veritas)",
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative bg-card border border-border rounded-lg overflow-hidden animate-fade-up">
        <div className="absolute inset-0 diagonal-texture opacity-60 pointer-events-none" />
        <div className="relative p-8 md:p-10">
          <div className="flex items-center gap-2 mb-3">
            <Badge tone="teal">● {PROJECT.status}</Badge>
            <Badge tone="gold">{PROJECT.ref}</Badge>
          </div>
          <h1 className="font-mono text-3xl md:text-5xl font-bold text-foreground tracking-tight uppercase">
            {PROJECT.name}
          </h1>
          <p className="mt-3 font-mono text-sm text-gold-light">{PROJECT.coords} · WGS84</p>
          <p className="mt-4 text-sm text-muted-foreground max-w-3xl">
            {PROJECT.location} · Operador:{" "}
            <span className="text-foreground">{PROJECT.operator}</span> · Inicio: {PROJECT.created}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
          <Card key={m.label} delay={i * 100} className="p-4" accent="gold">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-2">
              {m.label}
            </div>
            <div className="font-mono text-2xl text-foreground font-semibold">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* Timeline + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card delay={100} className="p-6">
          <SectionTitle icon={Calendar} sub="Programa 12 meses">
            Timeline del Proyecto
          </SectionTitle>
          <ol className="relative border-l border-border ml-2 space-y-5 mt-2">
            {phases.map((p) => (
              <li key={p.n} className="pl-6 relative">
                <span
                  className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 ${
                    p.active ? "bg-gold border-gold animate-pulse-dot" : "bg-card border-hint"
                  }`}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-mono text-sm">
                    <span className={p.active ? "text-gold" : "text-foreground"}>FASE {p.n}</span>
                    <span className="text-hint mx-2">·</span>
                    <span className="text-muted-foreground">{p.range}</span>
                  </div>
                  {p.active && <Badge tone="gold">En curso</Badge>}
                </div>
                <div className="text-sm text-foreground mt-1">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </li>
            ))}
          </ol>
        </Card>

        <Card delay={200} className="p-6">
          <SectionTitle icon={AlertTriangle} sub="Acciones requeridas">
            Alertas Operativas
          </SectionTitle>
          <ul className="space-y-2 mt-2">
            {alerts.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-3 rounded border border-border bg-bg-secondary card-hover"
              >
                <StatusDot
                  tone={a.tone === "alert" ? "alert" : a.tone === "gold" ? "gold" : "teal"}
                />
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-hint">
                    {a.level}
                  </div>
                  <div className="text-sm text-foreground">{a.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Map / Cross-section */}
      <Card delay={300} className="p-6">
        <SectionTitle icon={MapPin} sub="Vetas · Palmeras · Collares DDH">
          Mapa Geológico Interactivo
        </SectionTitle>
        {publicMode ? (
          <ProjectMap initialPreset="public_live" legacyStaticProjectFeatures />
        ) : (
          <CanonicalProjectViewer profileKey="palmeras" heightClassName="h-[620px]" compactHeader />
        )}
      </Card>

      <Card delay={400} className="p-6">
        <SectionTitle icon={Layers} sub="Profundidad 0–300 m">
          Sección Esquemática Vertical
        </SectionTitle>
        <CrossSection />
      </Card>
    </div>
  );
}

function CrossSection() {
  const layers = [
    { y: 30, h: 40, color: "var(--gold)", label: "Cap supérgeno", depth: "0–15 m" },
    { y: 70, h: 60, color: "var(--copper)", label: "Zona oxidada", depth: "15–50 m" },
    { y: 130, h: 80, color: "var(--info)", label: "Sulfuros primarios", depth: "50–150 m" },
    { y: 210, h: 60, color: "var(--teal)", label: "Drill target", depth: "150–300 m" },
  ];
  return (
    <div className="relative h-72 rounded border border-border bg-bg-secondary overflow-hidden p-4">
      <svg viewBox="0 0 400 280" className="w-full h-full">
        {/* depth axis */}
        <line x1="40" y1="20" x2="40" y2="270" stroke="var(--border)" strokeWidth="1" />
        {[0, 75, 150, 225, 300].map((d, i) => (
          <g key={d}>
            <line x1="36" y1={30 + i * 60} x2="40" y2={30 + i * 60} stroke="var(--hint)" />
            <text
              x="32"
              y={34 + i * 60}
              fontSize="9"
              fill="var(--muted-foreground)"
              textAnchor="end"
              fontFamily="monospace"
            >
              {d}m
            </text>
          </g>
        ))}

        {/* layers */}
        {layers.map((l) => (
          <g key={l.label}>
            <rect
              x="50"
              y={l.y}
              width="220"
              height={l.h}
              fill={l.color}
              fillOpacity="0.25"
              stroke={l.color}
            />
            <text x="60" y={l.y + 16} fontSize="10" fill="var(--foreground)" fontFamily="monospace">
              {l.label}
            </text>
            <text
              x="60"
              y={l.y + 28}
              fontSize="9"
              fill="var(--muted-foreground)"
              fontFamily="monospace"
            >
              {l.depth}
            </text>
          </g>
        ))}

        {/* vein */}
        <line x1="140" y1="30" x2="180" y2="270" stroke="var(--gold-light)" strokeWidth="3" />
        <text x="190" y="50" fontSize="9" fill="var(--gold-light)" fontFamily="monospace">
          Veta Au–Cu
        </text>

        {/* drill hole */}
        <line
          x1="290"
          y1="30"
          x2="340"
          y2="240"
          stroke="var(--alert)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text x="300" y="25" fontSize="9" fill="var(--alert)" fontFamily="monospace">
          DDH-001
        </text>
      </svg>
    </div>
  );
}

/* ============================================================
   MODULE 2 — GEOLOGY
   ============================================================ */

function Geology() {
  const { data, loading, error } = useGeologyData();

  const districts = ["El Bronce de Petorca", "Chancón", "Las Palmas", "Minera Florida", "Alhué"];
  const history = [
    { era: "Prehispánico (~1000–1540)", text: "Pueblo Picunche — lavaderos Au — piques manuales" },
    { era: "Colonial (1540–1810)", text: "Sistema mita — palmeras como marcadores — socavones" },
    { era: "Republicano (1810+)", text: "Minería artesanal — distrito documentado Domeyko 1840s" },
    { era: "2026", text: "Expansión en estudio — programa exploración sistemático" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="font-mono text-xs text-hint uppercase tracking-widest">
            Cargando datos geológicos…
          </div>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Card className="p-6" accent="copper">
          <SectionTitle icon={Mountain}>Error al cargar geología</SectionTitle>
          <p className="text-sm text-muted-foreground">
            {error ?? "No se pudieron obtener los datos."}
          </p>
        </Card>
      </div>
    );
  }

  const stagePrimary = (m: { paragenetic_stage: string | null; category: string | null }) =>
    m.category === "ore" && (m.paragenetic_stage === "main" || m.paragenetic_stage === "early");
  const stageSupergene = (m: { paragenetic_stage: string | null }) =>
    m.paragenetic_stage === "supergene";

  const groupedMinerals: Record<string, typeof data.minerals> = {
    PRIMARIOS: data.minerals.filter(stagePrimary),
    SUPÉRGENOS: data.minerals.filter(stageSupergene),
    GANGA: data.minerals.filter((m) => m.category === "gangue" || m.category === "alteration"),
  };

  const veinFeature = data.features.find((f) => f.feature_type === "vein");
  const primaryRef = data.references[0];

  return (
    <div className="space-y-6">
      {/* Regional */}
      <Card delay={0} className="p-6" accent="gold">
        <SectionTitle icon={Mountain} sub="Sección 2.1">
          Geología Regional
        </SectionTitle>
        <p className="text-sm text-foreground/90 leading-relaxed max-w-4xl">
          La <span className="text-gold">Formación Lo Valle</span> (Cretácico Superior, ~90–75 Ma)
          constituye un metalotecto reconocido a lo largo de la Cordillera de la Costa entre los
          32–36°S, hospedando sistemas epitermales–mesotermales de Au–Cu de baja a intermedia
          sulfidación. La intersección con intrusivos granodioríticos del Cretácico tardío–Paleoceno
          define los principales distritos productivos.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-hint mr-2 self-center">
            Distritos análogos:
          </span>
          {districts.map((d) => (
            <Badge key={d} tone="gold">
              {d}
            </Badge>
          ))}
        </div>
        {primaryRef && (
          <div className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            Ref. clave: {primaryRef.authors} {primaryRef.year} · {primaryRef.publisher}
            {primaryRef.doi && <> · DOI {primaryRef.doi}</>}
          </div>
        )}
      </Card>

      {/* Lithology */}
      <Card delay={100} className="p-6">
        <SectionTitle icon={Layers} sub="Sección 2.2">
          Litología
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                {["Unidad", "Edad", "Litología", "Descripción"].map((h) => (
                  <th
                    key={h}
                    className="py-2 px-3 font-mono text-[11px] uppercase tracking-wider text-hint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.litho.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-bg-secondary">
                  <td className="py-3 px-3 font-mono text-foreground">
                    <span
                      className="inline-block w-2 h-2 rounded-sm mr-2 align-middle"
                      style={{ background: r.color_hex ?? "var(--gold)" }}
                    />
                    {r.name}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{r.age}</td>
                  <td className="py-3 px-3 text-foreground">{r.rock_type}</td>
                  <td className="py-3 px-3 text-muted-foreground">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Outcrop + Alteration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card delay={200} className="p-6" accent="gold">
          <SectionTitle icon={Pickaxe}>Veta Principal</SectionTitle>
          {veinFeature ? (
            <ul className="space-y-2 text-sm text-foreground/90">
              <li>• {veinFeature.name}</li>
              {veinFeature.width_m && (
                <li>
                  • Espesor estimado:{" "}
                  <span className="font-mono text-gold-light">
                    {(veinFeature.width_m * 100).toFixed(0)} cm
                  </span>
                </li>
              )}
              {veinFeature.length_m && (
                <li>
                  • Largo mapeado:{" "}
                  <span className="font-mono text-gold-light">{veinFeature.length_m} m</span>
                </li>
              )}
              <li>
                • Orientación:{" "}
                <span className="font-mono">
                  {veinFeature.strike} · {veinFeature.dip}
                </span>
              </li>
              {veinFeature.description && <li>• {veinFeature.description}</li>}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">Sin features mapeadas.</div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="gold">Núcleo brechado</Badge>
            <Badge tone="copper">Halo limonítico 20–60cm</Badge>
          </div>
        </Card>

        <Card delay={300} className="p-6" accent="copper">
          <SectionTitle icon={Sparkles}>Alteración Hidrotermal</SectionTitle>
          <ul className="space-y-2 text-sm text-foreground/90">
            {data.alteration.map((a) => (
              <li key={a.id}>
                • <span style={{ color: a.color_hex ?? "var(--gold)" }}>{a.name}</span>{" "}
                <span className="text-muted-foreground">
                  ({a.intensity?.toLowerCase()}) — {a.assemblage}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 p-3 rounded border border-border bg-bg-secondary text-xs text-muted-foreground">
            <span className="font-mono text-hint uppercase tracking-wider">Diagnóstico:</span>{" "}
            fluidos 150–300°C, origen magmático-meteórico.
          </div>
        </Card>
      </div>

      {/* Mineralogy */}
      <Card delay={400} className="p-6">
        <SectionTitle icon={Sparkles} sub="Sección 2.4">
          Mineralogía
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(groupedMinerals).map(([group, items]) => (
            <div key={group} className="rounded border border-border p-4 bg-bg-secondary">
              <div className="font-mono text-[11px] uppercase tracking-widest text-gold mb-3">
                {group} <span className="text-hint">({items.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((m) => (
                  <span
                    key={m.id}
                    title={m.formula ?? undefined}
                    className="px-2 py-1 rounded bg-card border border-border text-xs text-foreground font-mono"
                  >
                    {m.mineral}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] font-mono text-hint">
          {data.minerals.length} minerales catalogados · fuente Trackmin 2025
        </div>
      </Card>

      {/* History */}
      <Card delay={500} className="p-6">
        <SectionTitle icon={ScrollText} sub="Sección 2.5">
          Contexto Histórico
        </SectionTitle>
        <ol className="relative border-l border-border ml-2 space-y-4 mt-2">
          {history.map((h, i) => (
            <li key={i} className="pl-6 relative">
              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-gold/70" />
              <div className="font-mono text-xs uppercase tracking-wider text-gold">{h.era}</div>
              <div className="text-sm text-foreground/90 mt-1">{h.text}</div>
            </li>
          ))}
        </ol>
      </Card>

      {/* References */}
      {data.references.length > 0 && (
        <Card delay={600} className="p-6">
          <SectionTitle icon={ScrollText} sub="Sección 2.6">
            Referencias
          </SectionTitle>
          <ul className="space-y-2 text-sm">
            {data.references.map((r) => (
              <li key={r.id} className="text-foreground/90">
                <span className="font-mono text-gold-light">{r.authors}</span>{" "}
                {r.year && <span className="text-muted-foreground">({r.year})</span>} — {r.title}
                {r.publisher && <span className="text-muted-foreground"> · {r.publisher}</span>}
                {r.doi && <span className="text-hint font-mono text-xs"> · DOI {r.doi}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   MODULE 3 — TARGETS
   ============================================================ */

type Rank = "T1" | "T2" | "T3";
type TargetItem = {
  rank: Rank;
  name: string;
  desc: string;
  actions: string[];
  steps: string[];
};

const TARGETS: TargetItem[] = [
  {
    rank: "T1",
    name: "Veta Aflorante — Corte Principal",
    desc: "Veta oscura subvertical expuesta en corte. Núcleo brechado documentado. Extensión lateral >50m estimada. Acceso directo disponible.",
    actions: ["Au prioritario", "Cu secundario", "Muestreo inmediato"],
    steps: ["Chip sampling 1m", "Mapeo geológico 1:500", "Sección pulida"],
  },
  {
    rank: "T1",
    name: "Cluster Palmeras Ladera NW",
    desc: "6+ Jubaea chilensis en alineación N20°W. Proxy de continuidad lateral de la estructura principal. Labores antiguas confirmadas.",
    actions: ["Lineamiento estructural", "Alta prioridad"],
    steps: ["Canal sampling labores", "Perfil suelo 25m", "Mapeo GPS labores"],
  },
  {
    rank: "T2",
    name: "Eje Quebrada Principal",
    desc: "Control estructural lineal compatible con falla principal. Intersección con sistema de vetas = zona de máxima dilatación.",
    actions: ["Zona intersección", "Geofísica IP"],
    steps: ["Perfil IP 2D transversal", "Muestreo cauce", "DEM lineamientos"],
  },
  {
    rank: "T3",
    name: "Laderas E y SE",
    desc: "Palmeras aisladas en ladera árida. Extensión lateral hipotética. Requiere verificación satelital previa.",
    actions: ["Au inferido", "Verificación previa"],
    steps: ["NDVI análisis sat.", "Reconocimiento terreno", "Geofísica si T1/T2 OK"],
  },
];

function Targets() {
  const [filter, setFilter] = useState<"all" | Rank>("all");
  const filtered = filter === "all" ? TARGETS : TARGETS.filter((t) => t.rank === filter);

  const rankMeta = (r: Rank) =>
    r === "T1"
      ? { tone: "gold" as const, accent: "gold" as const }
      : r === "T2"
        ? { tone: "copper" as const, accent: "copper" as const }
        : { tone: "muted" as const, accent: "muted" as const };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-mono text-lg uppercase tracking-wider text-foreground">
          Zonas Prioritarias de Exploración
        </h2>
        <div className="flex gap-2">
          {(["all", "T1", "T2", "T3"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded border font-mono text-xs uppercase tracking-wider transition-colors ${
                filter === f
                  ? "bg-gold/15 border-gold text-gold"
                  : "border-border text-muted-foreground hover:border-gold/40 hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todas" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((t, i) => {
          const meta = rankMeta(t.rank);
          return (
            <Card key={t.name} delay={i * 100} className="p-6 flex gap-5" accent={meta.accent}>
              <div className="shrink-0">
                <div
                  className={`w-14 h-14 rounded flex items-center justify-center font-mono text-xl font-bold border ${
                    t.rank === "T1"
                      ? "bg-gold/15 text-gold border-gold/40"
                      : t.rank === "T2"
                        ? "bg-copper/15 text-copper border-copper/40"
                        : "bg-muted text-hint border-border"
                  }`}
                >
                  {t.rank}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-mono text-base text-foreground mb-2">{t.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {t.actions.map((a) => (
                    <Badge key={a} tone={meta.tone}>
                      {a}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-2">
                    Próximos pasos
                  </div>
                  <ul className="space-y-1.5">
                    {t.steps.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-sm text-foreground/90">
                        <span className="w-3.5 h-3.5 rounded-sm border border-hint inline-block" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   MODULE 4 — SAMPLING
   ============================================================ */

function Sampling() {
  const protocol = [
    ["Chip sampling", "Veta aflorante", "1 m", "Au FA + ICP-OES 33E", "INMEDIATA"],
    ["Canal sampling", "Labores antiguas", "2 m", "Au–Ag–Cu–Mo–Pb–Zn", "INMEDIATA"],
    ["Grab muestras", "Dumpings históricos", "Selectivo", "Cu–Pb–Zn–As ICP", "ALTA"],
    ["Perfil de suelo", "Proximal palmeras", "25 m", "Au–As–Sb–Hg pathfinders", "ALTA"],
    ["Roca total", "Halo alteración", "Selectivo", "Litoquímica 48E", "MEDIA"],
    ["Sección pulida", "Núcleo veta brechada", "Selectivo", "Microscopía reflexión", "MEDIA"],
  ];

  const tone = (p: string): "alert" | "gold" | "teal" =>
    p === "INMEDIATA" ? "alert" : p === "ALTA" ? "gold" : "teal";

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="border border-alert/40 bg-alert/15 rounded-lg p-4 flex items-center gap-3 animate-fade-up">
        <AlertTriangle className="w-5 h-5 text-alert" />
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-alert">Estado</div>
          <div className="text-sm text-foreground">
            Sin ensayes disponibles — Muestreo pendiente de inicio.
          </div>
        </div>
      </div>

      {/* Protocol table */}
      <Card delay={100} className="p-6">
        <SectionTitle icon={TestTube2} sub="6 protocolos definidos">
          Protocolo de Muestreo
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                {["Tipo", "Zona objetivo", "Espaciado", "Analítica", "Prioridad", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-2 px-3 font-mono text-[11px] uppercase tracking-wider text-hint"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {protocol.map((row) => (
                <tr key={row[0]} className="border-b border-border/50 hover:bg-bg-secondary">
                  <td className="py-3 px-3 font-mono text-foreground">{row[0]}</td>
                  <td className="py-3 px-3 text-muted-foreground">{row[1]}</td>
                  <td className="py-3 px-3 font-mono text-gold-light">{row[2]}</td>
                  <td className="py-3 px-3 text-foreground/90">{row[3]}</td>
                  <td className="py-3 px-3">
                    <Badge tone={tone(row[4])}>{row[4]}</Badge>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <span className="w-3 h-3 border border-hint inline-block" /> Pendiente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* QA/QC */}
      <Card delay={200} className="p-6" accent="gold">
        <SectionTitle icon={CheckCircle2}>QA / QC</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded border border-border bg-bg-secondary p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-1">
              Protocolo
            </div>
            <div className="text-sm text-foreground">
              1 blanco + 1 estándar certificado + 1 duplicado / cada 20 muestras
            </div>
          </div>
          <div className="rounded border border-border bg-bg-secondary p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-1">
              Laboratorio
            </div>
            <div className="text-sm text-foreground">
              ALS Geochemistry (Santiago) · Bureau Veritas Chile
            </div>
          </div>
          <div className="rounded border border-border bg-bg-secondary p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint mb-1">
              Certificación
            </div>
            <div className="text-sm text-foreground">ISO/IEC 17025</div>
          </div>
        </div>
      </Card>

      {/* Assay results placeholder */}
      <Card delay={300} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={TrendingUp}>Resultados de Ensayes</SectionTitle>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/40 text-gold hover:bg-gold/10 font-mono text-xs uppercase tracking-wider transition-colors">
            + Cargar resultados
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sin resultados disponibles. Los ensayes se cargarán aquí una vez completado el muestreo
          superficial.
        </p>
        <div className="h-64 rounded border border-dashed border-border bg-bg-secondary p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[
                { n: 1, au: 0 },
                { n: 2, au: 0 },
                { n: 3, au: 0 },
                { n: 4, au: 0 },
                { n: 5, au: 0 },
                { n: 6, au: 0 },
                { n: 7, au: 0 },
                { n: 8, au: 0 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="n"
                stroke="var(--hint)"
                fontSize={10}
                label={{
                  value: "Sample #",
                  position: "insideBottom",
                  offset: -2,
                  fill: "var(--hint)",
                  fontSize: 10,
                }}
              />
              <YAxis
                stroke="var(--hint)"
                fontSize={10}
                label={{
                  value: "Au g/t",
                  angle: -90,
                  position: "insideLeft",
                  fill: "var(--hint)",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="au"
                stroke="var(--gold)"
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   MODULE 5 — DRILL PROGRAM
   ============================================================ */

function DrillProgram() {
  const ddh = [
    ["ALH-DDH-001", "090°", "-60°", "250 m", "Veta aflorante → sulfuros prim."],
    ["ALH-DDH-002", "270°", "-55°", "300 m", "Extensión lateral NW palmeras"],
    ["ALH-DDH-003", "045°", "-70°", "200 m", "Eje quebrada / intersección fallas"],
    ["ALH-DDH-004", "135°", "-65°", "280 m", "Zona mesotermal profunda"],
  ];

  const lithoLog = [
    { name: "Andesita alterada", color: "var(--copper)", h: 30 },
    { name: "Zona veta", color: "var(--gold)", h: 12 },
    { name: "Breccia", color: "var(--gold-light)", h: 18 },
    { name: "Sulfuros", color: "var(--info)", h: 25 },
    { name: "Cuarzo", color: "var(--foreground)", h: 15 },
  ];

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Sondajes propuestos", value: "4", sub: "DDH conceptual" },
          { label: "Metros totales", value: "1,030 m", sub: "200–300 m c/u" },
          { label: "Estado del programa", value: "Conceptual", sub: "Pendiente Fase 3" },
        ].map((m, i) => (
          <Card key={m.label} delay={i * 100} className="p-4" accent="gold">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint">
              {m.label}
            </div>
            <div className="font-mono text-2xl text-foreground mt-1">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.sub}</div>
          </Card>
        ))}
      </div>

      {/* DDH Table */}
      <Card delay={200} className="p-6">
        <SectionTitle icon={Drill} sub="Programa propuesto">
          Sondajes DDH
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                {[
                  "Sondaje",
                  "Azimut",
                  "Inclinación",
                  "Prof. Total",
                  "Zona Objetivo",
                  "Estado",
                  "Log",
                ].map((h) => (
                  <th
                    key={h}
                    className="py-2 px-3 font-mono text-[11px] uppercase tracking-wider text-hint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ddh.map((r) => (
                <tr key={r[0]} className="border-b border-border/50 hover:bg-bg-secondary">
                  <td className="py-3 px-3 font-mono text-gold">{r[0]}</td>
                  <td className="py-3 px-3 font-mono text-foreground">{r[1]}</td>
                  <td className="py-3 px-3 font-mono text-foreground">{r[2]}</td>
                  <td className="py-3 px-3 font-mono text-gold-light">{r[3]}</td>
                  <td className="py-3 px-3 text-muted-foreground">{r[4]}</td>
                  <td className="py-3 px-3">
                    <Badge tone="muted">Propuesto</Badge>
                  </td>
                  <td className="py-3 px-3 text-hint">—</td>
                </tr>
              ))}
              <tr className="bg-bg-secondary border-t-2 border-gold/30">
                <td className="py-3 px-3 font-mono text-foreground font-bold">TOTAL</td>
                <td className="py-3 px-3 text-hint">—</td>
                <td className="py-3 px-3 text-hint">—</td>
                <td className="py-3 px-3 font-mono text-gold-light font-bold">1,030 m</td>
                <td className="py-3 px-3 text-hint">—</td>
                <td className="py-3 px-3 text-hint">—</td>
                <td className="py-3 px-3 text-hint">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tech specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card delay={300} className="p-6" accent="gold">
          <SectionTitle icon={Info}>Especificaciones — Recuperación</SectionTitle>
          <ul className="space-y-2 text-sm text-foreground/90">
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Diámetro:</span> NQ
              mínimo / HQ recomendado
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Recuperación:</span>{" "}
              &gt;85% por tramo 3m
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Orientación:</span>{" "}
              Reflex ACT III
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Preservación:</span> Foto
              + descripción antes de corte
            </li>
          </ul>
        </Card>
        <Card delay={400} className="p-6" accent="copper">
          <SectionTitle icon={Info}>Especificaciones — Análisis</SectionTitle>
          <ul className="space-y-2 text-sm text-foreground/90">
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Corte:</span> Sierra
              diamante, mitad análisis / mitad archivo
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Muestreo:</span> Tramos
              geológicos o 1m máx
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">QP supervisor:</span>{" "}
              Pendiente contratación
            </li>
            <li>
              <span className="text-hint font-mono text-xs uppercase mr-2">Análisis:</span> Fire
              Assay + ICP-OES 33E
            </li>
          </ul>
        </Card>
      </div>

      {/* Core log placeholder */}
      <Card delay={500} className="p-6">
        <SectionTitle icon={Layers}>Core Log — Placeholder</SectionTitle>
        <p className="text-sm text-muted-foreground mb-4">
          Sin testigos disponibles — Perforación no iniciada.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-6">
          {/* litho column */}
          <div className="flex flex-col w-24 border border-border rounded overflow-hidden">
            {lithoLog.map((l, i) => (
              <div
                key={i}
                style={{ height: `${l.h * 4}px`, backgroundColor: l.color, opacity: 0.55 }}
                className="border-b border-bg-secondary"
              />
            ))}
          </div>
          {/* legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 self-start">
            {lithoLog.map((l) => (
              <div
                key={l.name}
                className="flex items-center gap-3 p-2 rounded border border-border bg-bg-secondary"
              >
                <span
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: l.color, opacity: 0.7 }}
                />
                <span className="text-sm text-foreground">{l.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   MODULE 6 — BUDGET
   ============================================================ */

function Budget() {
  const items = [
    {
      label: "Sondaje DDH",
      detail: "1,030 m × $120/m",
      amount: 123600,
      pct: 58,
      color: "var(--gold)",
    },
    {
      label: "Geólogo terreno",
      detail: "60 días × $350/día",
      amount: 21000,
      pct: 10,
      color: "var(--copper)",
    },
    {
      label: "Muestreo + análisis",
      detail: "~400 muestras × $65",
      amount: 26000,
      pct: 12,
      color: "var(--teal)",
    },
    {
      label: "Geofísica IP",
      detail: "15 km × $1,200/km",
      amount: 18000,
      pct: 9,
      color: "var(--info)",
    },
    {
      label: "Cartografía UAV",
      detail: "1 vuelo",
      amount: 3500,
      pct: 2,
      color: "var(--muted-foreground)",
    },
    { label: "Imprevistos 10%", detail: "Buffer", amount: 19210, pct: 9, color: "var(--hint)" },
  ];
  const total = 211310;

  const sources = [
    "CORFO PTEC",
    "CORFO Capital Riesgo Minero",
    "ENAMI Innovación 2026",
    "Fundación Copec-UC",
    "Capital propio",
    "Joint Venture operador",
  ];

  const timeline = [
    {
      phase: "Fase 1",
      range: "Meses 1–2",
      title: "Muestreo superficial",
      start: 0,
      span: 2,
      color: "var(--gold)",
    },
    {
      phase: "Fase 2",
      range: "Meses 3–4",
      title: "Geofísica IP",
      start: 2,
      span: 2,
      color: "var(--info)",
    },
    {
      phase: "Fase 3",
      range: "Meses 5–8",
      title: "Sondajes DDH",
      start: 4,
      span: 4,
      color: "var(--copper)",
    },
    {
      phase: "Fase 4",
      range: "Meses 9–12",
      title: "Análisis + reporte",
      start: 8,
      span: 4,
      color: "var(--teal)",
    },
  ];

  const regulatory = [
    "Verificar concesiones SERNAGEOMIN (Portal Geomin)",
    "Consulta SIGEX campañas históricas",
    "Notificación CMN — labores prehispánicas",
    "Permiso exploración DS N°132 (si aplica sondajes)",
    "Verificar derechos agua DGA",
    "Contratar empresa contratista certificada SERNAGEOMIN",
  ];

  return (
    <div className="space-y-6">
      {/* Budget table + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card delay={0} className="p-6 lg:col-span-2">
          <SectionTitle icon={Wallet} sub="USD · 12 meses">
            Presupuesto · Desglose
          </SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                {["Ítem", "Detalle", "Monto", "%"].map((h) => (
                  <th
                    key={h}
                    className="py-2 px-3 font-mono text-[11px] uppercase tracking-wider text-hint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.label} className="border-b border-border/50 hover:bg-bg-secondary">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: it.color }}
                      />
                      <span className="text-foreground">{it.label}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{it.detail}</td>
                  <td className="py-3 px-3 font-mono text-gold-light">
                    ${it.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono text-foreground">{it.pct}%</td>
                </tr>
              ))}
              <tr className="bg-bg-secondary border-t-2 border-gold/30">
                <td className="py-3 px-3 font-mono text-foreground font-bold">TOTAL</td>
                <td className="py-3 px-3 text-hint">—</td>
                <td className="py-3 px-3 font-mono text-gold font-bold">
                  ${total.toLocaleString()}
                </td>
                <td className="py-3 px-3 font-mono text-foreground font-bold">100%</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card delay={100} className="p-6 flex flex-col">
          <SectionTitle icon={TrendingUp}>Distribución</SectionTitle>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {items.map((it) => (
                    <Cell key={it.label} fill={it.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={(v) => `$${Number(v).toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-hint">Total</div>
            <div className="font-mono text-2xl text-gold">${total.toLocaleString()}</div>
          </div>
        </Card>
      </div>

      {/* Funding sources */}
      <Card delay={200} className="p-6" accent="gold">
        <SectionTitle icon={Building2}>Fuentes de Financiamiento</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <Badge key={s} tone="gold">
              {s}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Gantt */}
      <Card delay={300} className="p-6">
        <SectionTitle icon={Calendar} sub="12 meses">
          Cronograma · Gantt
        </SectionTitle>
        <div className="space-y-3">
          {/* month axis */}
          <div className="grid grid-cols-12 gap-1 font-mono text-[10px] text-hint pl-40">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="text-center">
                M{i + 1}
              </div>
            ))}
          </div>
          {timeline.map((t) => (
            <div key={t.phase} className="grid grid-cols-[160px_1fr] items-center gap-3">
              <div className="font-mono text-xs">
                <div className="text-foreground">{t.phase}</div>
                <div className="text-hint">{t.range}</div>
              </div>
              <div className="relative grid grid-cols-12 gap-1 h-7">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="bg-bg-secondary rounded-sm border border-border/50" />
                ))}
                <div
                  className="absolute top-0 bottom-0 rounded-sm flex items-center px-3"
                  style={{
                    left: `${(t.start / 12) * 100}%`,
                    width: `${(t.span / 12) * 100}%`,
                    backgroundColor: t.color,
                    opacity: 0.85,
                  }}
                >
                  <span className="font-mono text-[11px] text-background font-semibold truncate">
                    {t.title}
                  </span>
                </div>
                {/* current month marker */}
                <div
                  className="absolute top-[-4px] bottom-[-4px] w-px bg-alert"
                  style={{ left: `${(0.5 / 12) * 100}%` }}
                >
                  <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-alert" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[11px] font-mono text-alert pl-40 mt-2">
            <span className="w-2 h-2 rounded-full bg-alert inline-block" />
            Mes actual · Inicio Fase 1
          </div>
        </div>
      </Card>

      {/* Regulatory */}
      <Card delay={400} className="p-6">
        <SectionTitle icon={FileText}>Checklist Regulatorio</SectionTitle>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {regulatory.map((r) => (
            <li
              key={r}
              className="flex items-start gap-3 p-3 rounded border border-border bg-bg-secondary card-hover"
            >
              <span className="w-4 h-4 rounded-sm border border-hint shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/90">{r}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ============================================================
   ROOT
   ============================================================ */

export function TrackminGeoIntel({ publicMode = false }: { publicMode?: boolean } = {}) {
  const [active, setActive] = useState<TabId>("overview");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    toast.info("Generando informe NI 43-101…");
    try {
      const { exportNI43101 } = await import("@/lib/export-ni43101-pdf");
      await exportNI43101({
        setActive: (id) => setActive(id as TabId),
        getCurrent: () => active,
      });
      toast.success("Informe NI 43-101 exportado correctamente");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el informe");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav active={active} setActive={setActive} onExport={handleExport} exporting={exporting} />

      <main className="max-w-[1400px] mx-auto px-6 py-8" data-export-root>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 font-mono text-xs text-hint">
          <span>{PROJECT.ref}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-muted-foreground capitalize">
            {TABS.find((t) => t.id === active)?.label}
          </span>
        </div>

        <div key={active} className="animate-fade-up">
          {active === "overview" && <Overview publicMode={publicMode} />}
          {active === "geology" && <Geology />}
          {active === "geophysics" && (
            <GeophysicsModule Card={Card} SectionTitle={SectionTitle} Badge={Badge} />
          )}
          {active === "targets" && <Targets />}
          {active === "sampling" && <Sampling />}
          {active === "drill" && <DrillProgram />}
          {active === "budget" && <Budget />}
        </div>
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-hint uppercase tracking-wider">
          <div>
            Geocapitals · {PROJECT.operator} · {PROJECT.ref} · Confidencial · © 2026
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-teal text-teal" />
            Sistema operativo
          </div>
        </div>
      </footer>
    </div>
  );
}
