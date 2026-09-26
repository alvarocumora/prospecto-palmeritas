import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  ArrowLeft,
  Landmark,
  Gem,
  LineChart,
  Lock,
  Cpu,
  Download,
  PlayCircle,
  Clock,
  CheckCircle2,
  Circle,
  GraduationCap,
  PackageOpen,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow, SectionHeading } from "@/components/brand";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Curso Geocapitals — Recursos y material descargable" },
      {
        name: "description",
        content:
          "Curso Geocapitals ejecutable en la app: 4 módulos con lecciones interactivas, progreso guardado y PDFs descargables sin login.",
      },
      { property: "og:title", content: "Curso Geocapitals — Recursos" },
      {
        property: "og:description",
        content:
          "Aprende cómo funciona Geocapitals con lecciones ejecutables in-app y PDFs institucionales de descarga directa.",
      },
    ],
  }),
  component: RecursosPage,
});

const GOLD = "oklch(0.78 0.14 82)";

/* ————————————————————————————————————————————————
   Descarga directa cross-browser (Chrome / Safari / móviles)
   - Same-origin: anchor con atributo `download` → funciona en
     Chrome, Firefox, Edge, Safari iOS/macOS y Android WebView.
   - Sin fetch → sin problemas de CORS ni de blob en Safari.
——————————————————————————————————————————————— */
function triggerDownload(url: string, filename: string) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    // Safari iOS: necesita estar en el DOM para el click sintético
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Descargando ${filename}`);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    toast.message("Abrimos el PDF en pestaña nueva");
  }
}

/* ————————————————————————————————————————————————
   Curso Geocapitals — contenido ejecutable in-app
——————————————————————————————————————————————— */
type Lesson = {
  title: string;
  body: string[]; // párrafos
  key?: string[]; // bullets clave
};

type CourseModule = {
  n: number;
  tag: string;
  title: string;
  duration: string;
  summary: string;
  lessons: Lesson[];
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
    pdf: "/recursos/geocapitals-m01-overview.pdf",
    file: "geocapitals-m01-overview.pdf",
    pdfSize: "82 KB · A4",
    icon: GraduationCap,
    lessons: [
      {
        title: "Una plataforma, cinco capas",
        body: [
          "Geocapitals unifica en un solo terminal lo que antes vivía en cinco herramientas distintas: catastro minero, teledetección satelital, motor 3D geológico, gestión de deal-flow y estándares NI 43-101.",
          "El resultado es un flujo continuo: descubres una concesión → cruzas anomalías satelitales → modelas en 3D → generas el reporte técnico → abres el deal a inversionistas cualificados.",
        ],
        key: [
          "Un solo login para exploración + capital",
          "Datos vivos (no snapshots estáticos)",
          "Trazabilidad de decisiones extremo a extremo",
        ],
      },
      {
        title: "Qué problema resolvemos",
        body: [
          "Los juniors mineros pierden 60–70% del tiempo consolidando datos entre sistemas incompatibles. Los family offices no tienen forma de comparar oportunidades bajo un estándar común.",
          "Geocapitals estandariza: mismo formato de reporte, misma capa de compliance, misma métrica de fusion-score entre proyectos.",
        ],
      },
      {
        title: "Los cinco pilares del stack",
        body: [
          "1) Catastro Chile vivo (SERNAGEOMIN + boletín + patentes). 2) Motor satelital (Sentinel-2, MPC, índices HYD/IOX/CLY/STR). 3) Motor 3D (DEM Copernicus + drillholes + block model). 4) NI 43-101 asistido con evidencia enlazada. 5) Deal-flow con cap-table digital.",
        ],
        key: ["Catastro", "Satelital", "3D Geológico", "NI 43-101", "Deal-flow"],
      },
      {
        title: "Para quién es",
        body: [
          "Juniors y exploradores necesitan velocidad para levantar capital sobre evidencia técnica.",
          "Family offices y RIA cualificados necesitan comparabilidad y trazabilidad.",
          "QP y consultores necesitan un workspace con auditoría y firma digital.",
          "Operadores necesitan monitoreo continuo de vencimientos, superposiciones y compliance.",
        ],
      },
    ],
  },
  {
    n: 2,
    tag: "Inversión",
    title: "Cómo invertir · crowdfunding y tokenización",
    duration: "12 min",
    summary:
      "Tres niveles de participación (Observer, Retail QI, Institucional) y el roadmap completo de tokenización de proyectos y commodities.",
    pdf: "/recursos/geocapitals-m02-inversion.pdf",
    file: "geocapitals-m02-inversion.pdf",
    pdfSize: "82 KB · A4",
    icon: Coins,
    lessons: [
      {
        title: "Tres puertas de entrada",
        body: [
          "Observer (gratis): acceso a deal-flow público, sin ticket. Retail QI (US$5K–US$50K): inversionista cualificado con KYC, ticket fraccionado sobre SPV. Institucional (>US$250K): acceso completo al data room, term-sheet negociable, seat en cap-table.",
        ],
        key: ["Observer · US$0", "Retail QI · desde US$5K", "Institucional · desde US$250K"],
      },
      {
        title: "Cap-table digital y suscripción fraccionada",
        body: [
          "Cada proyecto tiene un cap-table digital dentro de la plataforma. La suscripción es fraccionada: comprometes un ticket contra un target de levantamiento, y solo se ejecuta si se alcanza el mínimo (all-or-nothing).",
          "Todo respaldado por SPV con custodia regulada. Los reportes trimestrales llegan al mismo dashboard.",
        ],
      },
      {
        title: "El proceso paso a paso",
        body: [
          "1) KYC/AML (2 min con documento). 2) Acceso al data room del proyecto (NI 43-101 + modelo económico). 3) Comprometes ticket con firma digital. 4) Si se alcanza el mínimo, se ejecuta el vehículo SPV y recibes unidades en tu cap-table.",
        ],
        key: ["KYC ~2 min", "Data room seguro", "Firma digital", "SPV all-or-nothing"],
      },
      {
        title: "Roadmap de tokenización 2026 – 2027",
        body: [
          "Fase 1 (Live): cap-table digital. Fase 2 (Beta): suscripción fraccionada. Fase 3 (Q3 2026): tokenización de participación de proyecto sobre SPV. Fase 4 (2027): commodities certificados tokenizados (Cu, Au, críticos) con settlement institucional.",
        ],
      },
    ],
  },
  {
    n: 3,
    tag: "Datos",
    title: "Catastro y datos geoespaciales",
    duration: "10 min",
    summary:
      "Cómo convertimos concesiones SERNAGEOMIN, escenas Sentinel-2 y DEM Copernicus en inteligencia accionable para exploración.",
    pdf: "/recursos/geocapitals-m03-datos.pdf",
    file: "geocapitals-m03-datos.pdf",
    pdfSize: "80 KB · A4",
    icon: Database,
    lessons: [
      {
        title: "Catastro minero vivo",
        body: [
          "+800K concesiones sincronizadas con SERNAGEOMIN. Boletín minero diario, vencimientos y superposiciones detectadas automáticamente. Alertas por email cuando un titular renuncia o un vecino ingresa una nueva pertenencia.",
        ],
        key: ["800K+ concesiones", "Boletín diario", "Alertas de vencimiento"],
      },
      {
        title: "Índices satelitales",
        body: [
          "Procesamos escenas Sentinel-2 y HLS vía Microsoft Planetary Computer. Índices soportados: IOX (óxidos de hierro), CLY (arcillas), HYD (alteración hidrotermal), STR (lineamientos estructurales), NDVI (vegetación).",
          "Cada anomalía se guarda como polígono WGS84 con score, severidad y bbox — listo para exportar a QGIS/ArcGIS.",
        ],
      },
      {
        title: "Motor 3D geológico",
        body: [
          "DEM real Copernicus 30m + drape Sentinel + drillholes reales o sintéticos. Bloques, isosuperficies, secciones cross-cut, cámara auto-fit, exportación a glTF.",
          "Ideal para due diligence: en 30 segundos ves el proyecto en volumen, no en un PDF plano.",
        ],
      },
      {
        title: "Compliance, auditoría y firma QP",
        body: [
          "Todo cambio queda registrado en audit trail. Los QP firman digitalmente cada sección del NI 43-101 con envelope y timestamp. Roles con RLS estricta: analista ≠ operador ≠ inversionista.",
        ],
        key: ["Audit trail completo", "Firma QP digital", "RLS por rol"],
      },
    ],
  },
  {
    n: 4,
    tag: "Estándares",
    title: "NI 43-101 asistido y gaps frecuentes",
    duration: "10 min",
    summary:
      "El estándar canadiense explicado, cómo la plataforma lo estructura con evidencia trazable y qué gaps aparecen en el 80% de los reportes.",
    pdf: "/recursos/geocapitals-m04-ni43101.pdf",
    file: "geocapitals-m04-ni43101.pdf",
    pdfSize: "81 KB · A4",
    icon: FileText,
    lessons: [
      {
        title: "Los 25 ítems del reporte técnico",
        body: [
          "NI 43-101 exige 25 ítems: desde 1 (summary) hasta 25 (interpretation and conclusions). La plataforma los estructura como secciones editables con estado (draft → review → signed).",
        ],
      },
      {
        title: "Cache por sección y evidencia enlazada",
        body: [
          "Cada afirmación técnica se enlaza a su evidencia: muestra de laboratorio, sección de sondaje, capa satelital. Al firmar el QP, la evidencia queda inmutable con hash.",
        ],
        key: ["Trazabilidad total", "Hash de evidencia", "Historial de versiones"],
      },
      {
        title: "Los 5 gaps QAQC más frecuentes",
        body: [
          "1) Ausencia de blancos/estándares en cada batch. 2) Duplicados <5%. 3) Chain of custody incompleta. 4) Densidad muestral irregular. 5) Datum no declarado en coordenadas.",
          "Geocapitals detecta los 5 automáticamente y bloquea la firma hasta que se resuelvan.",
        ],
      },
      {
        title: "Mapeo a JORC, SAMREC y SEC S-K 1300",
        body: [
          "Los 25 ítems mapean a las secciones equivalentes de JORC (Australia), SAMREC (Sudáfrica) y SEC S-K 1300 (EEUU). Un mismo reporte se exporta a los cuatro formatos sin duplicar trabajo.",
        ],
      },
    ],
  },
];

/* ————————————————————————————————————————————————
   Progreso persistente (localStorage)
——————————————————————————————————————————————— */
const STORAGE_KEY = "geocap:course:v1";
type Progress = Record<string, boolean>; // key = `${modN}-${lessonIdx}`

function lessonKey(mod: number, idx: number) {
  return `${mod}-${idx}`;
}

function useCourseProgress() {
  const [progress, setProgress] = useState<Progress>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProgress(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  const persist = (next: Progress) => {
    setProgress(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const markDone = (mod: number, idx: number, done = true) => {
    persist({ ...progress, [lessonKey(mod, idx)]: done });
  };
  const reset = () => persist({});
  const isDone = (mod: number, idx: number) => !!progress[lessonKey(mod, idx)];

  const totalLessons = COURSE.reduce((s, m) => s + m.lessons.length, 0);
  const doneCount = Object.values(progress).filter(Boolean).length;
  const pct = totalLessons ? Math.round((doneCount / totalLessons) * 100) : 0;

  const moduleStats = (mod: CourseModule) => {
    const done = mod.lessons.filter((_, i) => isDone(mod.n, i)).length;
    return { done, total: mod.lessons.length, pct: Math.round((done / mod.lessons.length) * 100) };
  };

  return { progress, markDone, reset, isDone, pct, doneCount, totalLessons, moduleStats };
}

/* ————————————————————————————————————————————————
   Roadmap de tokenización
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
   Player del curso (lección por lección, in-app)
——————————————————————————————————————————————— */
function LessonPlayer({
  mod,
  lessonIdx,
  onNav,
  onDone,
  isDone,
}: {
  mod: CourseModule;
  lessonIdx: number;
  onNav: (nextMod: number, nextIdx: number) => void;
  onDone: (mod: number, idx: number, done?: boolean) => void;
  isDone: (mod: number, idx: number) => boolean;
}) {
  const lesson = mod.lessons[lessonIdx];
  const done = isDone(mod.n, lessonIdx);

  const flat = useMemo(
    () =>
      COURSE.flatMap((m) =>
        m.lessons.map((_, i) => ({ mod: m.n, idx: i, title: m.lessons[i].title })),
      ),
    [],
  );
  const pos = flat.findIndex((f) => f.mod === mod.n && f.idx === lessonIdx);
  const prev = pos > 0 ? flat[pos - 1] : null;
  const next = pos < flat.length - 1 ? flat[pos + 1] : null;

  const goPrev = () => prev && onNav(prev.mod, prev.idx);
  const goNext = () => {
    if (!done) onDone(mod.n, lessonIdx, true);
    if (next) onNav(next.mod, next.idx);
    else toast.success("¡Curso completado! 🎓");
  };

  return (
    <div className="rounded-2xl border border-hairline bg-white overflow-hidden shadow-[0_30px_60px_-40px_rgba(43,74,203,0.35)]">
      {/* Header lección */}
      <div className="p-5 lg:p-6 border-b border-hairline flex flex-wrap items-center gap-3">
        <span
          className="grid place-items-center w-10 h-10 rounded-lg shrink-0"
          style={{ background: "var(--accent-brand)", color: "#fff" }}
        >
          <span className="text-xs font-mono font-bold">
            {mod.n}.{lessonIdx + 1}
          </span>
        </span>
        <div className="flex-1 min-w-[240px]">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-content-subtle">
            Módulo {String(mod.n).padStart(2, "0")} · {mod.tag} · Lección {lessonIdx + 1} de{" "}
            {mod.lessons.length}
          </div>
          <h3 className="font-display text-lg lg:text-xl text-content leading-tight mt-0.5">
            {lesson.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onDone(mod.n, lessonIdx, !done)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
            done
              ? "border-emerald-500/50 bg-emerald-50 text-emerald-700"
              : "border-hairline text-content-subtle hover:border-accent-brand"
          }`}
          aria-pressed={done}
        >
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          {done ? "Completada" : "Marcar como leída"}
        </button>
      </div>

      {/* Contenido */}
      <div className="p-5 lg:p-6 grid lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="prose prose-sm max-w-none">
          {lesson.body.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-content/85">
              {p}
            </p>
          ))}
          {lesson.key && (
            <div className="mt-5 rounded-lg border border-hairline bg-accent-brand-subtle/40 p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent-brand mb-2">
                Puntos clave
              </div>
              <ul className="space-y-1.5">
                {lesson.key.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm text-content/85">
                    <span
                      className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: GOLD }}
                    />
                    {k}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sidebar de descarga contextual */}
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
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
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
              PDF del módulo
            </span>
            <span
              className="text-[10px] font-mono ml-auto"
              style={{ color: "oklch(0.7 0.02 260)" }}
            >
              {mod.pdfSize}
            </span>
          </div>
          <div className="mt-4 font-display text-base leading-snug text-white">{mod.title}</div>
          <div className="mt-1 text-[11px] font-mono" style={{ color: "oklch(0.7 0.02 260)" }}>
            Referencia offline · Geocapitals Academy
          </div>
          <div className="mt-auto pt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => triggerDownload(mod.pdf, mod.file)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-medium transition hover:brightness-110"
              style={{ background: GOLD, color: "#0f172a" }}
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </button>
            {/* Anchor nativo — máxima compatibilidad Safari iOS */}
            <a
              href={mod.pdf}
              download={mod.file}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition"
              style={{
                color: "oklch(0.85 0.02 260)",
                border: "1px solid oklch(1 0 0 / 0.15)",
              }}
            >
              Enlace directo (fallback)
            </a>
          </div>
        </aside>
      </div>

      {/* Nav prev/next */}
      <div className="p-4 lg:p-5 border-t border-hairline flex items-center gap-3 bg-accent-brand-subtle/30">
        <button
          type="button"
          onClick={goPrev}
          disabled={!prev}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-mono border border-hairline bg-white text-content disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent-brand transition"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>
        <div className="flex-1 text-center text-[11px] font-mono text-content-subtle truncate">
          {next ? `Siguiente: ${next.title}` : "Última lección del curso"}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono text-white transition hover:brightness-110"
          style={{ background: "var(--accent-brand)" }}
        >
          {next ? "Siguiente" : "Finalizar"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CourseSection() {
  const [activeMod, setActiveMod] = useState<number>(1);
  const [activeLesson, setActiveLesson] = useState<number>(0);
  const { markDone, reset, isDone, pct, doneCount, totalLessons, moduleStats } =
    useCourseProgress();

  const mod = COURSE.find((m) => m.n === activeMod) ?? COURSE[0];

  const goTo = (m: number, i: number) => {
    setActiveMod(m);
    setActiveLesson(i);
    // scroll suave al player
    setTimeout(() => {
      document
        .getElementById("course-player")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  };

  const downloadAll = () => {
    toast.message("Descargando los 4 módulos…");
    COURSE.forEach((m, i) => {
      setTimeout(() => triggerDownload(m.pdf, m.file), i * 500);
    });
  };

  return (
    <div>
      {/* Header + acciones */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <SectionHeading
          eyebrow="Curso Geocapitals · Ejecutable in-app · Sin login"
          title="Aprende cómo funciona la plataforma en 40 minutos"
          description="Cuatro módulos con lecciones interactivas, progreso guardado localmente y PDFs institucionales descargables. Puedes hacer el curso completo dentro de la app — el PDF es solo tu referencia offline."
          className="max-w-3xl"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-hairline bg-white text-content text-xs font-mono hover:border-accent-brand transition"
            title="Reiniciar progreso"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
          </button>
          <button
            type="button"
            onClick={downloadAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-accent-brand bg-accent-brand text-white text-sm font-mono hover:brightness-110 transition"
          >
            <PackageOpen className="w-4 h-4" /> Descargar los 4 PDFs
          </button>
        </div>
      </div>

      {/* Progreso global */}
      <div className="mb-6 rounded-xl border border-hairline bg-white p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-content-subtle">
            Progreso del curso
          </span>
          <span className="text-xs font-mono ml-auto text-content">
            {doneCount}/{totalLessons} lecciones · {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-accent-brand-subtle">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--accent-brand), ${GOLD})`,
            }}
          />
        </div>
      </div>

      {/* Rail de módulos */}
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {COURSE.map((m) => {
          const active = m.n === activeMod;
          const stats = moduleStats(m);
          return (
            <li key={m.n}>
              <button
                type="button"
                onClick={() => goTo(m.n, 0)}
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
                  <span className="ml-auto text-[10px] font-mono text-content-subtle">
                    {stats.done}/{stats.total}
                  </span>
                </div>
                <div className="mt-1.5 text-xs font-medium text-content line-clamp-2">
                  {m.title}
                </div>
                <div className="mt-2 h-1 rounded-full overflow-hidden bg-accent-brand-subtle/60">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${stats.pct}%`, background: GOLD }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5" id="course-player">
        {/* Índice de lecciones del módulo activo */}
        <nav className="rounded-2xl border border-hairline bg-white p-4 h-fit lg:sticky lg:top-4">
          <div className="flex items-center gap-2 mb-3">
            <mod.icon className="w-4 h-4 text-accent-brand" strokeWidth={1.5} />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-content-subtle">
              Módulo {String(mod.n).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-mono ml-auto text-content-subtle inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {mod.duration}
            </span>
          </div>
          <div className="font-display text-sm text-content leading-tight mb-3">{mod.title}</div>
          <ol className="space-y-1">
            {mod.lessons.map((l, i) => {
              const active = i === activeLesson;
              const done = isDone(mod.n, i);
              return (
                <li key={l.title}>
                  <button
                    type="button"
                    onClick={() => goTo(mod.n, i)}
                    className={`w-full flex items-start gap-2 text-left px-2.5 py-2 rounded-lg text-xs transition ${
                      active
                        ? "bg-accent-brand-subtle text-content"
                        : "text-content-subtle hover:bg-accent-brand-subtle/50"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : active ? (
                        <PlayCircle className="w-3.5 h-3.5 text-accent-brand" />
                      ) : (
                        <Circle className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <span className={active ? "font-medium" : ""}>
                      <span className="font-mono opacity-60 mr-1">
                        {mod.n}.{i + 1}
                      </span>
                      {l.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 pt-3 border-t border-hairline">
            <a
              href={mod.pdf}
              download={mod.file}
              onClick={(e) => {
                e.preventDefault();
                triggerDownload(mod.pdf, mod.file);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-accent-brand hover:brightness-110"
            >
              <Download className="w-3.5 h-3.5" /> PDF del módulo
            </a>
          </div>
        </nav>

        {/* Player */}
        <LessonPlayer
          mod={mod}
          lessonIdx={activeLesson}
          onNav={goTo}
          onDone={markDone}
          isDone={isDone}
        />
      </div>

      {/* Cierre */}
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-accent-brand-subtle/50 p-4">
        <CheckCircle2 className="w-5 h-5 text-accent-brand shrink-0" />
        <div className="text-sm text-content/85 flex-1 min-w-[240px]">
          Al terminar los 4 módulos operarás catastro, entenderás el motor 3D y evaluarás
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

/* ————————————————————————————————————————————————
   Sección: Documentos de transacción editables
———————————————————————————————————————————————— */
function DocumentTemplatesSection() {
  return (
    <section className="py-16 border-t border-hairline">
      <SectionHeading
        eyebrow="Documentos de transacción · Editables in-app"
        title="Plantillas editables con branding Geocapitals"
        description="Redacta NDAs, LOIs, term sheets, SPAs, JVs y royalties directamente en la plataforma. Personaliza cláusulas, previsualiza en vivo y descarga PDF listo para circular. Borradores editables — no reemplazan asesoría legal."
        className="mb-10"
      />
      <div className="rounded-2xl border border-hairline bg-white p-8 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[260px]">
          <div className="font-display text-xl text-content">Editor de documentos in-app</div>
          <p className="text-sm text-content-subtle mt-1.5 max-w-2xl">
            NDA, NCNDA, MoU, LOI, Term Sheet, SPA, JV, Royalty y Advisory: personaliza cláusulas,
            previsualiza en vivo y descarga PDF con branding Geocapitals. Los borradores se guardan
            en tu cuenta y se sincronizan entre dispositivos.
          </p>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-lg bg-content text-white px-4 py-2.5 text-sm font-medium hover:opacity-90"
        >
          Acceder al editor <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

function RecursosPage() {
  return (
    <MarketingPage
      eyebrow="Curso ejecutable · Material descargable · Guías"
      title="Aprende Geocapitals dentro de la app, sin login"
      intro="Curso interactivo con lecciones in-app, progreso guardado y PDFs institucionales de descarga directa. Todo el material es público — sin cuenta, sin fricción."
    >
      {/* ═══════════════ 1 · CURSO (protagonista) ═══════════════ */}
      <section className="-mt-8 lg:-mt-12">
        <CourseSection />
      </section>

      {/* ═══════════════ 2 · DOCUMENTOS EDITABLES ═══════════════ */}
      <DocumentTemplatesSection />

      {/* ═══════════════ 3 · GUÍAS ═══════════════ */}
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

      {/* ═══════════════ 3 · TOKENIZACIÓN ═══════════════ */}
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
                          background: isLive ? "oklch(0.78 0.14 82 / 0.15)" : "oklch(1 0 0 / 0.05)",
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
