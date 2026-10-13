import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Mountain, Activity, Satellite, FileText, Box as BoxIcon } from "lucide-react";
import { PublicRouteEntry } from "@/components/navigation/PublicRouteEntry";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";
import { getPublicListings } from "@/lib/publicListings.functions";
import { ListingsMap } from "@/features/proyectos/ListingsMap";
import { QueryError } from "@/components/ui/QueryError";
import palmerasImg from "@/assets/project-palmeras.jpg.asset.json";
import losverdesImg from "@/assets/project-losverdes.jpg.asset.json";
import cholquiImg from "@/assets/project-gianfranco.jpg.asset.json";
import colateralImg from "@/assets/colateral/hualane-satelite.jpg";
import nahuelbutaImg from "@/assets/project-nahuelbuta.jpg";

export const Route = createFileRoute("/proyectos")({
  head: () => ({
    meta: [
      { title: "Proyectos — Geocapitals" },
      {
        name: "description",
        content:
          "Proyectos mineros gestionados sobre Geocapitals. Catastro, sondajes, satélite y NI 43-101 en una sola vista.",
      },
      { property: "og:title", content: "Proyectos mineros — Geocapitals" },
      { property: "og:description", content: "Activos reales operando en la plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <PublicRouteEntry path="/proyectos">
      <ProyectosPage />
    </PublicRouteEntry>
  ),
});

// Las cards aterrizan directo en el TERMINAL del activo (mapa, tesis,
// simulador y data room en una sola pantalla, sin saltos intermedios).
const SHOWCASE = [
  {
    code: "PALMERAS",
    slug: "palmeras" as const,
    name: "Prospecto Las Palmeras",
    region: "Illapel · Coquimbo",
    commodity: "Au-Ag",
    image: palmerasImg.url,
    stage: "Exploración avanzada",
    stats: [
      ["74", "concesiones"],
      ["12.807", "hectáreas"],
      ["16", "sondajes"],
    ],
    bullets: ["74 concesiones · 12.807 ha", "16 sondajes · 4.426 m", "12 anomalías satelitales"],
  },
  {
    code: "LOSVERDES",
    slug: "losverdes" as const,
    name: "Los Verdes",
    region: "Los Vilos · Choapa · Coquimbo",
    commodity: "Cu-Mo",
    image: losverdesImg.url,
    stage: "Pre NI 43-101",
    stats: [
      ["17", "pertenencias mapeadas"],
      ["1.963", "ha en paquete"],
      ["637", "ha por confirmar"],
    ],
    bullets: [
      "AOI 3D + satélite multi-índice",
      "Targets generados por IA",
      "Asociación declarada; tenencia multi-titular pendiente de verificación contractual",
    ],
  },
  {
    code: "CHOLQUI",
    slug: "cholqui" as const,
    name: "Proyecto Cholqui",
    region: "Melipilla · R. Metropolitana",
    commodity: "Cu-Au-Ag",
    image: cholquiImg.url,
    stage: "Ronda de capital",
    stats: [
      ["14", "concesiones"],
      ["7", "ensayes"],
      ["15", "anomalías"],
    ],
    bullets: [
      "Cu-Au-Ag con buenas leyes",
      "~5.000 ha rodeando a Mina Las Minitas en producción",
      "Colinda con pertenencias de Yamana Gold",
    ],
  },
  {
    code: "NHB-REE",
    slug: "nahuelbuta" as const,
    name: "Nahuelbuta REE",
    region: "Arauco · Biobío / Malleco",
    commodity: "REE",
    image: nahuelbutaImg,
    stage: "Prospección (TRL 1-2)",
    stats: [
      ["34", "paños"],
      ["10.200", "hectáreas"],
      ["US$ 380k", "Fase 1"],
    ],
    bullets: [
      "Arcillas iónicas sobre el Complejo Metamórfico Nahuelbuta",
      "Pedimentos en solicitud ante SERNAGEOMIN",
      "Sin muestras de laboratorio aún: tesis exploratoria",
    ],
  },
];

function ProyectosPage() {
  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
  });
  const listings = data?.listings ?? [];

  return (
    <MarketingPage
      eyebrow="Proyectos"
      title="Activos reales operando sobre Geocapitals"
      intro="Una muestra de los proyectos mineros que usan la plataforma para integrar catastro, exploración, monitoreo satelital y documentación técnica."
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" id="publicar">
        {SHOWCASE.map((p) => (
          <article
            key={p.code}
            className="group rounded-2xl border border-hairline bg-white overflow-hidden flex flex-col hover:border-accent-brand hover:shadow-[0_24px_48px_-28px_rgba(11,42,91,0.4)] transition"
          >
            <Link
              to="/terminal/$slug"
              params={{ slug: p.slug }}
              search={{ tab: "mapa" as const }}
              className="relative block aspect-[16/10] overflow-hidden bg-surface"
            >
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-mono uppercase tracking-wider text-content">
                  {p.commodity}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-accent-brand text-[10px] font-mono uppercase tracking-wider text-white">
                  {p.stage}
                </span>
              </div>
              <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded bg-black/50 text-[9px] font-mono uppercase tracking-wider text-white/80">
                Imagen referencial
              </span>
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] opacity-80">
                  {p.region}
                </div>
                <div className="font-display text-2xl leading-tight mt-0.5">{p.name}</div>
              </div>
            </Link>
            <div className="grid grid-cols-3 border-b border-hairline">
              {p.stats.map(([v, l], i) => (
                <div key={l} className={`px-4 py-3 ${i ? "border-l border-hairline" : ""}`}>
                  <div className="font-display text-xl text-content">{v}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                    {l}
                  </div>
                </div>
              ))}
            </div>
            <ul className="px-5 pt-4 space-y-1.5 text-[13px] text-content flex-1">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-2 w-1 h-1 rounded-full bg-accent-brand shrink-0" /> {b}
                </li>
              ))}
            </ul>
            <div className="p-5 pt-4 grid grid-cols-2 gap-2">
              <Link
                to="/terminal/$slug"
                params={{ slug: p.slug }}
                search={{ tab: "mapa" as const }}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent-brand text-white text-sm py-2.5 hover:opacity-90"
              >
                Abrir terminal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/terminal/$slug"
                params={{ slug: p.slug }}
                search={{ tab: "simulador" as const }}
                className="inline-flex items-center justify-center rounded-md border border-hairline text-sm py-2.5 text-content hover:border-accent-brand hover:text-accent-brand"
              >
                Simular inversión
              </Link>
            </div>
          </article>
        ))}
      </div>

      <Link
        to="/inversion-colateral"
        className="group mt-6 grid md:grid-cols-[280px_1fr_auto] items-center gap-6 rounded-2xl border border-hairline bg-white overflow-hidden hover:border-accent-brand transition"
      >
        <img
          src={colateralImg}
          alt="Valle de Hualañé, imagen satelital"
          className="h-full w-full object-cover aspect-[16/10] md:aspect-auto"
          loading="lazy"
        />
        <div className="p-5 md:p-0">
          <Eyebrow className="mb-1">Inversión con colateral inmobiliario</Eyebrow>
          <div className="font-display text-2xl text-content">
            Hualañé y Licantén · Región del Maule
          </div>
          <p className="text-sm text-content-subtle mt-1 max-w-xl">
            Desde $25 MM CLP, 12% anual en UF, respaldado por parcela con rol SII individual.
          </p>
        </div>
        <span className="mx-5 mb-5 md:mb-0 inline-flex items-center gap-1.5 text-sm text-accent-brand">
          Ver programa <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </span>
      </Link>

      {/* Herramientas de inteligencia geológica */}
      <section className="mt-14 grid sm:grid-cols-2 gap-4">
        <Link
          to="/satelital"
          className="group rounded-xl border border-hairline bg-white p-5 flex items-center gap-4 hover:border-accent-brand transition"
        >
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0">
            <Satellite className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="font-display text-[15px] text-content">Monitoreo satelital</div>
            <div className="text-xs text-content-subtle mt-0.5">
              Anomalías multiespectrales e InSAR sobre los proyectos de la cartera
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
        </Link>
        <Link
          to="/visor-3d"
          className="group rounded-xl border border-hairline bg-white p-5 flex items-center gap-4 hover:border-accent-brand transition"
        >
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-accent-brand-subtle text-accent-brand shrink-0">
            <BoxIcon className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <div className="font-display text-[15px] text-content">Visor 3D geocientífico</div>
            <div className="text-xs text-content-subtle mt-0.5">
              Terreno, sondajes y anomalías georreferenciadas en 3D
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-content-subtle group-hover:text-accent-brand group-hover:translate-x-0.5 transition" />
        </Link>
      </section>

      {/* Mapa de proyectos publicados (coordenadas WGS84 reales) */}
      <section className="mt-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <Eyebrow className="mb-2">Mapa de proyectos</Eyebrow>
            <h2 className="brand-display text-2xl md:text-3xl text-content">
              Todos los activos en un solo mapa
            </h2>
            <p className="text-sm text-content-subtle mt-2 max-w-xl">
              Coordenadas reales WGS84 de cada proyecto publicado. Los pines se colorean por estado
              de avance; los destacados llevan un anillo.
            </p>
          </div>
        </div>
        {isError ? (
          <QueryError message="No pudimos cargar los proyectos." onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="h-[460px] rounded-2xl border border-hairline bg-slate-100 animate-pulse" />
        ) : listings.filter((l) => l.centroid).length === 0 ? (
          <p className="text-sm text-content-subtle italic">
            Aún no hay proyectos georreferenciados publicados.
          </p>
        ) : (
          <ListingsMap listings={listings} />
        )}
      </section>

      {/* El deal flow vive en /inversionistas — aquí solo el puente, sin duplicar */}
      <section className="mt-20 rounded-2xl border border-hairline bg-accent-brand-subtle p-8 flex flex-wrap items-center justify-between gap-5">
        <div>
          <Eyebrow className="mb-2">¿Buscas invertir?</Eyebrow>
          <h2 className="brand-display text-2xl text-content">
            El flujo completo de inversión está en el portal de inversionistas
          </h2>
          <p className="text-sm text-content-subtle mt-2 max-w-xl">
            Fichas con ticket de entrada y simulador de ROI, deal flow activo, NDA y data room — un
            solo camino, sin vueltas.
          </p>
        </div>
        <BrandButton asChild>
          <Link to="/inversionistas">
            Ir a invertir <ArrowRight className="w-4 h-4" />
          </Link>
        </BrandButton>
      </section>

      <section className="mt-20 rounded-2xl bg-surface-inverse text-white p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <Eyebrow className="mb-2 text-white/60">Publica tu proyecto</Eyebrow>
          <h2 className="brand-display text-2xl md:text-3xl">
            Eleva tu activo al estándar institucional
          </h2>
          <p className="mt-3 text-white/70 max-w-xl">
            Crea un perfil profesional, conecta tu catastro, sube tu data room y recibe interés de
            inversionistas calificados. Onboarding asistido por nuestro equipo.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-white/60">
            <span className="flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5 text-accent-brand-subtle" /> Catastro
            </span>
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-accent-brand-subtle" /> Geofísica
            </span>
            <span className="flex items-center gap-2">
              <Satellite className="w-3.5 h-3.5 text-accent-brand-subtle" /> Satélite
            </span>
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-accent-brand-subtle" /> NI 43-101
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <BrandButton asChild>
            <Link to="/auth">
              Crear cuenta <ArrowRight className="w-4 h-4" />
            </Link>
          </BrandButton>
          <Link
            to="/contacto"
            className="inline-flex items-center justify-center gap-2 border border-white/30 text-white px-5 py-3 rounded-md text-sm hover:bg-white/10"
          >
            Habla con nosotros
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}
