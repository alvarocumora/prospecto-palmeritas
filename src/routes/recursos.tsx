import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  BookOpen,
  Compass,
  Database,
  Coins,
  Users,
  ShieldCheck,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
  Landmark,
  Gem,
  LineChart,
  Lock,
  Cpu,
  Download,
  PlayCircle,
  Clock,
  CheckCircle2,
  GraduationCap,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow, SectionHeading } from "@/components/brand";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos y curso — Geocapitals" },
      {
        name: "description",
        content:
          "Curso Geocapitals gratuito con 4 módulos en PDF descargable, guías operativas y roadmap de tokenización. Todo el material abierto, sin login.",
      },
      { property: "og:title", content: "Recursos y curso — Geocapitals" },
      {
        property: "og:description",
        content:
          "Material descargable: curso institucional en PDF, guías del terminal y roadmap de tokenización de proyectos y commodities.",
      },
    ],
  }),
  component: RecursosPage,
});

const GOLD = "oklch(0.78 0.14 82)";

/* ————————————————————————————————————————————————
   Descarga forzada vía blob (sin abrir el visor,
   sin requerir sesión — los PDF viven en /public)
——————————————————————————————————————————————— */
async function forceDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
    toast.success(`Descargando ${filename}`);
  } catch (e) {
    // Fallback: abrir en pestaña nueva si la descarga blob falla
    window.open(url, "_blank", "noopener,noreferrer");
    toast.message("Abrimos el PDF en pestaña nueva", {
      description: e instanceof Error ? e.message : "Descarga directa no disponible",
    });
  }
}

/* ————————————————————————————————————————————————
   Curso Geocapitals — 4 módulos con PDF descargable
——————————————————————————————————————————————— */
type CourseModule = {
  n: number;
  tag: string;
  title: string;
  duration: string;
  summary: string;
  lessons: string[];
  pdf: string;
  file: string;
  pdfSize: string;
  icon: typeof BookOpen;
};

const COURSE: CourseModule[] = [
  {
    n: 1,
    tag: "Overview",
    title: "¿Qué es Geocapitals?",
    duration: "8 min",
    summary:
      "El sistema operativo para exploración minera institucional: catastro, satélites, motor 3D, NI 43-101 y capital fraccionado.",
    lessons: [
      "Una plataforma, cinco capas",
      "Qué problema resolvemos",
      "Los cinco pilares del stack",
      "Para quién es (juniors, family offices, QP, operadores)",
    ],
    pdf: "/recursos/geocapitals-m01-overview.pdf",
    file: "geocapitals-m01-overview.pdf",
    pdfSize: "82 KB · A4",
    icon: GraduationCap,
  },
  {
    n: 2,
    tag: "Inversión",
    title: "Cómo invertir · crowdfunding y tokenización",
    duration: "12 min",
    summary:
      "Tres niveles de participación (Observer, Retail QI, Institucional) y el roadmap completo de tokenización de proyectos y commodities.",
    lessons: [
      "Tres puertas de entrada (retail QI vs institucional)",
      "Cap-table digital y suscripción fraccionada",
      "El proceso paso a paso: KYC → data room → ticket",
      "Roadmap de tokenización 2026 – 2027",
    ],
    pdf: "/recursos/geocapitals-m02-inversion.pdf",
    file: "geocapitals-m02-inversion.pdf",
    pdfSize: "82 KB · A4",
    icon: Coins,
  },
  {
    n: 3,
    tag: "Datos",
    title: "Catastro y datos geoespaciales",
    duration: "10 min",
    summary:
      "Cómo convertimos concesiones SERNAGEOMIN, escenas Sentinel-2 y DEM Copernicus en inteligencia accionable para exploración.",
    lessons: [
      "Catastro minero vivo (+800K concesiones)",
      "Índices satelitales: óxidos, arcillas, alteración, lineamientos",
      "Motor 3D geológico: DEM real + drape + drillholes",
      "Compliance, auditoría y firma QP",
    ],
    pdf: "/recursos/geocapitals-m03-datos.pdf",
    file: "geocapitals-m03-datos.pdf",
    pdfSize: "80 KB · A4",
    icon: Database,
  },
  {
    n: 4,
    tag: "Estándares",
    title: "NI 43-101 asistido y gaps frecuentes",
    duration: "10 min",
    summary:
      "El estándar canadiense explicado, cómo la plataforma lo estructura con evidencia trazable y qué gaps aparecen en el 80% de los reportes.",
    lessons: [
      "Los 25 ítems del reporte técnico",
      "Cache por sección y evidencia enlazada",
      "Los 5 gaps QAQC más frecuentes",
      "Mapeo a JORC, SAMREC y SEC S-K 1300",
    ],
    pdf: "/recursos/geocapitals-m04-ni43101.pdf",
    file: "geocapitals-m04-ni43101.pdf",
    pdfSize: "81 KB · A4",
    icon: FileText,
  },
];

/* ————————————————————————————————————————————————
   Roadmap de tokenización (contexto para el curso)
——————————————————————————————————————————————— */
const TOKEN_ROADMAP = [
  {
    phase: "Fase 01",
    status: "Live",
    title: "Cap-table digital",
    desc: "Registro de unidades por inversionista, KYC/AML y reporting periódico dentro de la plataforma.",
    icon: Users,
  },
  {
    phase: "Fase 02",
    status: "Beta",
    title: "Suscripción fraccionada",
    desc: "Compromisos parciales sobre un target de levantamiento con validación de mínimos y disponibilidad.",
    icon: Coins,
  },
  {
    phase: "Fase 03",
    status: "Q3 2026",
    title: "Tokenización de proyecto",
    desc: "Emisión de tokens de participación respaldados por vehículos SPV con custodia regulada.",
    icon: Gem,
  },
  {
    phase: "Fase 04",
    status: "2027",
    title: "Commodities tokenizados",
    desc: "Lotes certificados de cobre, oro y críticos con trazabilidad on-chain y settlement institucional.",
    icon: Layers,
  },
];

/* ————————————————————————————————————————————————
   Guías de uso de la plataforma
——————————————————————————————————————————————— */
const GUIDES = [
  {
    i: FileText,
    t: "NI 43-101 explicado",
    d: "Estructura del reporte técnico, gaps frecuentes y cómo Geocapitals los cubre.",
    to: "/contacto",
  },
  {
    i: Compass,
    t: "Catastro Chile en 10 min",
    d: "Cómo leer concesiones, boletín minero, vencimientos y superposiciones.",
    to: "/catastro",
  },
  {
    i: Database,
    t: "Capas satelitales",
    d: "Sentinel-2, MPC, índices HYD/IOX/CLY/STR/NDVI y su interpretación.",
    to: "/contacto",
  },
  {
    i: BookOpen,
    t: "Demo en vivo",
    d: "Recorrido guiado por el terminal: catastro, 3D, deals y data room.",
    to: "/contacto",
  },
  {
    i: Cpu,
    t: "Motor 3D geológico",
    d: "Bloques, drillholes, secciones y prospectividad IA a escala de proyecto.",
    to: "/contacto",
  },
  {
    i: LineChart,
    t: "Modelo económico",
    d: "NPV, IRR, sensibilidad de precios y escenarios listos para comité.",
    to: "/contacto",
  },
];

/* ————————————————————————————————————————————————
   Descarga completa (bundle de los 4 módulos)
——————————————————————————————————————————————— */
async function downloadAll() {
  toast.message("Descargando los 4 módulos…");
  for (const m of COURSE) {
    // pequeño delay para que el navegador procese cada descarga
    // eslint-disable-next-line no-await-in-loop
    await forceDownload(m.pdf, m.file);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
  }
}

function CourseSection() {
  const [openN, setOpenN] = useState<number>(1);

  return (
    <div>
      {/* Header + acciones globales */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <SectionHeading
          eyebrow="Curso Geocapitals · Gratuito · Sin login"
          title="Aprende cómo funciona la plataforma en 40 minutos"
          description="Cuatro módulos concentrados con PDF descargable. Del overview institucional al roadmap de tokenización — el mismo material que usamos con family offices. Todo abierto, sin autenticación."
          className="max-w-3xl"
        />
        <button
          type="button"
          onClick={downloadAll}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent-brand bg-accent-brand text-white text-sm font-mono hover:brightness-110 transition"
        >
          <PackageOpen className="w-4 h-4" /> Descargar los 4 módulos
        </button>
      </div>

      {/* Progress rail */}
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {COURSE.map((m) => {
          const active = m.n === openN;
          return (
            <li key={m.n}>
              <button
                type="button"
                onClick={() => setOpenN(m.n)}
                className={`w-full text-left rounded-lg border p-3 transition ${
                  active
                    ? "border-accent-brand bg-accent-brand-subtle"
                    : "border-hairline bg-white hover:border-accent-brand/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid place-items-center w-6 h-6 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      background: active ? "var(--accent-brand)" : "transparent",
                      color: active ? "#fff" : "var(--accent-brand)",
                      border: `1px solid var(--accent-brand)`,
                    }}
                  >
                    {String(m.n).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                    {m.tag}
                  </span>
                  {active && (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: GOLD }}
                    />
                  )}
                </div>
                <div className="mt-1.5 text-xs font-medium text-content line-clamp-2">
                  {m.title}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Módulos (acordeón) */}
      <div className="space-y-3">
        {COURSE.map((m) => {
          const open = m.n === openN;
          const Icon = m.icon;
          return (
            <article
              key={m.n}
              className={`rounded-2xl border transition-all ${
                open
                  ? "border-accent-brand bg-white shadow-[0_30px_60px_-40px_rgba(43,74,203,0.4)]"
                  : "border-hairline bg-white hover:border-accent-brand/40"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenN(open ? -1 : m.n)}
                className="w-full flex items-center gap-4 p-5 text-left"
                aria-expanded={open}
              >
                <div className="relative shrink-0">
                  <span
                    className="grid place-items-center w-14 h-14 rounded-xl"
                    style={{
                      background: open ? "var(--accent-brand)" : "var(--accent-brand-subtle)",
                      color: open ? "#fff" : "var(--accent-brand)",
                    }}
                  >
                    <Icon className="w-6 h-6" strokeWidth={1.5} />
                  </span>
                  {open && (
                    <span
                      className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full text-[9px] font-mono font-bold text-black"
                      style={{ background: GOLD }}
                    >
                      {m.n}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-content-subtle">
                      Módulo {String(m.n).padStart(2, "0")} · {m.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-content-subtle">
                      <Clock className="w-3 h-3" /> {m.duration}
                    </span>
                  </div>
                  <h3 className="font-display text-lg lg:text-xl text-content leading-tight">
                    {m.title}
                  </h3>
                  {!open && (
                    <p className="text-sm text-content-subtle mt-1.5 line-clamp-1">{m.summary}</p>
                  )}
                </div>

                {/* Descarga directa desde la cabecera (siempre visible) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void forceDownload(m.pdf, m.file);
                  }}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono shrink-0 border transition"
                  style={{ borderColor: GOLD, color: GOLD, background: "oklch(0.78 0.14 82 / 0.08)" }}
                  title="Descargar PDF"
                  aria-label={`Descargar ${m.file}`}
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>

                <span
                  className={`hidden lg:inline-flex items-center gap-1 text-xs font-mono text-content-subtle shrink-0 transition ${open ? "text-accent-brand" : ""}`}
                >
                  <PlayCircle className="w-4 h-4" />
                  {open ? "Cerrar" : "Ver lecciones"}
                </span>
              </button>

              {open && (
                <div className="px-5 pb-5 border-t border-hairline pt-5 grid md:grid-cols-[1.4fr_1fr] gap-6">
                  <div>
                    <p className="text-sm text-content/80 leading-relaxed">{m.summary}</p>
                    <ul className="mt-5 space-y-2.5">
                      {m.lessons.map((l, i) => (
                        <li key={l} className="flex items-start gap-2.5 text-sm">
                          <span
                            className="mt-0.5 grid place-items-center w-5 h-5 rounded-full shrink-0 text-[10px] font-mono font-bold"
                            style={{
                              background: "var(--accent-brand-subtle)",
                              color: "var(--accent-brand)",
                            }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-content/85">{l}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <aside
                    className="relative rounded-xl border p-5 flex flex-col overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(155deg, oklch(0.18 0.04 260) 0%, oklch(0.11 0.03 260) 100%)",
                      borderColor: "oklch(0.28 0.05 260)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-[0.2em]"
                        style={{
                          background: "oklch(0.78 0.14 82 / 0.15)",
                          color: GOLD,
                          border: "1px solid oklch(0.78 0.14 82 / 0.35)",
                        }}
                      >
                        PDF Institucional
                      </span>
                      <span
                        className="text-[10px] font-mono ml-auto"
                        style={{ color: "oklch(0.7 0.02 260)" }}
                      >
                        {m.pdfSize}
                      </span>
                    </div>
                    <div className="mt-4 font-display text-base leading-snug text-white">
                      {m.title}
                    </div>
                    <div
                      className="mt-1 text-[11px] font-mono"
                      style={{ color: "oklch(0.7 0.02 260)" }}
                    >
                      Módulo {String(m.n).padStart(2, "0")} · Geocapitals Academy
                    </div>

                    <div className="mt-auto pt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void forceDownload(m.pdf, m.file)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-medium transition hover:brightness-110"
                        style={{ background: GOLD, color: "#0f172a" }}
                      >
                        <Download className="w-4 h-4" /> Descargar PDF
                      </button>
                      <a
                        href={m.pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition"
                        style={{
                          color: "oklch(0.85 0.02 260)",
                          border: "1px solid oklch(1 0 0 / 0.15)",
                        }}
                      >
                        Abrir en pestaña nueva
                      </a>
                    </div>
                  </aside>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Certificado / cierre */}
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-accent-brand-subtle/50 p-4">
        <CheckCircle2 className="w-5 h-5 text-accent-brand shrink-0" />
        <div className="text-sm text-content/85 flex-1 min-w-[240px]">
          Al terminar los 4 módulos podrás operar catastro, entender el motor 3D y evaluar
          oportunidades del deal-flow como un analista institucional.
        </div>
        <BrandButton asChild variant="outline" className="shrink-0">
          <Link to="/contacto">
            Solicitar demo guiada <ArrowRight className="w-4 h-4" />
          </Link>
        </BrandButton>
      </div>
    </div>
  );
}

function RecursosPage() {
  return (
    <MarketingPage
      eyebrow="Curso · Material descargable · Guías"
      title="Aprende Geocapitals con material descargable, sin login"
      intro="Curso institucional en PDF, guías del terminal y roadmap de tokenización. Todo el material es público y se descarga directo — sin cuenta, sin fricción."
    >
      {/* ═══════════════ 1 · CURSO (protagonista) ═══════════════ */}
      <section className="-mt-8 lg:-mt-12">
        <CourseSection />
      </section>

      {/* ═══════════════ 2 · GUÍAS ═══════════════ */}
      <section className="py-16 border-t border-hairline">
        <SectionHeading
          eyebrow="Usa la plataforma"
          title="Guías, documentación y demos"
          description="Material práctico para entender cómo Geocapitals levanta capital, evalúa proyectos y cumple estándares globales."
          className="mb-10"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GUIDES.map(({ i: Icon, t, d, to }) => (
            <Link
              key={t}
              to={to}
              className="group relative rounded-2xl border border-hairline bg-white p-6 hover:border-accent-brand hover:shadow-[0_20px_40px_-30px_rgba(43,74,203,0.35)] transition-all flex gap-4"
            >
              <span className="grid place-items-center w-12 h-12 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0 group-hover:scale-105 transition-transform">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <div className="font-display text-lg text-content group-hover:text-accent-brand transition-colors">
                  {t}
                </div>
                <p className="text-sm text-content-subtle mt-1.5 leading-relaxed">{d}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-accent-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              <span
                className="absolute inset-x-6 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: GOLD }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · TOKENIZACIÓN (contexto) ═══════════════ */}
      <section className="py-16 border-t border-hairline">
        <div
          className="relative overflow-hidden rounded-3xl border p-8 lg:p-12"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.18 0.04 260) 0%, oklch(0.12 0.03 260) 60%, oklch(0.08 0.02 260) 100%)",
            borderColor: "oklch(0.28 0.05 260)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(0.78 0.14 82) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.14 82) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em]"
                style={{
                  background: "oklch(0.78 0.14 82 / 0.14)",
                  color: GOLD,
                  border: `1px solid oklch(0.78 0.14 82 / 0.35)`,
                }}
              >
                <Zap className="w-3 h-3" /> Roadmap disruptivo
              </span>
            </div>
            <h2
              className="brand-display text-3xl lg:text-4xl leading-tight max-w-3xl"
              style={{ color: "oklch(0.96 0.01 260)" }}
            >
              De la concesión al <span style={{ color: GOLD }}>token institucional</span>
            </h2>
            <p
              className="mt-3 max-w-2xl text-sm lg:text-base"
              style={{ color: "oklch(0.78 0.02 260)" }}
            >
              Estamos construyendo el puente entre exploración minera y capital fraccionado
              on-chain: mismo estándar NI 43-101, mismo custodio, liquidez programable.
            </p>

            <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TOKEN_ROADMAP.map(({ phase, status, title, desc, icon: Icon }, idx) => {
                const isLive = status === "Live" || status === "Beta";
                return (
                  <div
                    key={phase}
                    className="relative rounded-xl p-5 flex flex-col"
                    style={{
                      background: "oklch(1 0 0 / 0.03)",
                      border: `1px solid ${isLive ? "oklch(0.78 0.14 82 / 0.35)" : "oklch(1 0 0 / 0.08)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.2em]"
                        style={{ color: "oklch(0.6 0.02 260)" }}
                      >
                        {phase}
                      </span>
                      <span
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: isLive
                            ? "oklch(0.78 0.14 82 / 0.15)"
                            : "oklch(1 0 0 / 0.05)",
                          color: isLive ? GOLD : "oklch(0.7 0.02 260)",
                        }}
                      >
                        {status}
                      </span>
                    </div>
                    <Icon
                      className="w-6 h-6 mb-3"
                      style={{ color: isLive ? GOLD : "oklch(0.7 0.02 260)" }}
                      strokeWidth={1.5}
                    />
                    <div
                      className="font-display text-base leading-tight mb-2"
                      style={{ color: "oklch(0.96 0.01 260)" }}
                    >
                      {title}
                    </div>
                    <p
                      className="text-[12px] leading-relaxed"
                      style={{ color: "oklch(0.72 0.02 260)" }}
                    >
                      {desc}
                    </p>
                    {idx < TOKEN_ROADMAP.length - 1 && (
                      <div
                        aria-hidden
                        className="hidden lg:block absolute top-1/2 -right-2 w-4 h-px"
                        style={{ background: "oklch(0.78 0.14 82 / 0.4)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 text-[11px] font-mono">
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: "oklch(0.8 0.02 260)" }}
              >
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: GOLD }} /> KYC / AML
                institucional
              </span>
              <span style={{ color: "oklch(0.5 0.02 260)" }}>·</span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: "oklch(0.8 0.02 260)" }}
              >
                <Lock className="w-3.5 h-3.5" /> Cifrado AES-256
              </span>
              <span style={{ color: "oklch(0.5 0.02 260)" }}>·</span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: "oklch(0.8 0.02 260)" }}
              >
                <Landmark className="w-3.5 h-3.5" /> Vehículos SPV supervisados
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · CTA final ═══════════════ */}
      <section className="mt-8">
        <div className="relative rounded-3xl border border-hairline bg-accent-brand-subtle p-8 lg:p-12 text-center overflow-hidden">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
          />
          <Eyebrow className="mb-3">
            <Sparkles className="w-3 h-3 inline mr-1" /> ¿Buscas algo específico?
          </Eyebrow>
          <h3 className="brand-display text-2xl lg:text-3xl text-content">
            Whitepapers, onepagers y term-sheets bajo NDA
          </h3>
          <p className="text-content-subtle mt-3 max-w-xl mx-auto">
            Preparamos material personalizado por jurisdicción, commodity o etapa para tu comité de
            inversión.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <BrandButton asChild>
              <Link to="/contacto">Solicitar documento</Link>
            </BrandButton>
            <BrandButton asChild variant="outline">
              <Link to="/inversionistas">Ver deal-flow completo</Link>
            </BrandButton>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
