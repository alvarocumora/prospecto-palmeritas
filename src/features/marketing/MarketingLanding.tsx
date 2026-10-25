import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Search, Building2, ShieldCheck, Map, FileText, Check } from "lucide-react";
import { searchConcessions } from "@/lib/catastroPublic.functions";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";
import { Eyebrow } from "@/components/brand";
import colateralCover from "@/assets/colateral/cover-maule.jpg";
import hualaneSat from "@/assets/colateral/hualane-satelite.jpg";
import velValle from "@/assets/colateral/vel-valle.jpg";
import { HeroGeospatial } from "@/features/marketing/HeroGeospatial";
import { MiningInvestShowcase } from "@/features/marketing/MiningInvestShowcase";
import featureCatastro from "@/assets/feature-catastro.jpg";
import { CollateralDownloadButtons } from "@/features/investor/CollateralDownloadButtons";
import { InvestorDeckEntry } from "@/features/marketing/deck/InvestorDeckEntry";

/**
 * Portada = embudo de captura con dos puertas:
 *  A) Inversionistas → programa con colateral inmobiliario (simular + memorándum + lead).
 *  B) Clientes de catastro → búsqueda directa de concesiones → ficha → plan.
 * Todo lo técnico (visores, 3D, terminal) vive dentro de GeoTerminal, no en la portada.
 */
export function MarketingLanding() {
  return (
    <div className="brand-light min-h-screen bg-surface text-content">
      <MarketingHeader />

      <HeroGeospatial />

      {/* Franja de rigor */}
      <section className="border-b border-hairline bg-surface-2">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-4 px-5 py-5 font-mono text-[10px] leading-relaxed uppercase tracking-[0.1em] text-content-muted md:grid-cols-4 md:tracking-[0.16em]">
          {[
            "Fuentes oficiales y declaradas",
            "Estado de evidencia por proyecto",
            "Informes y riesgos identificados",
            "Documentos con trazabilidad",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-accent-brand" /> {t}
            </div>
          ))}
        </div>
      </section>

      <section className="mineral-texture bg-surface-inverse text-accent-brand-contrast">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-im-gold">
              Investor Terminal
            </p>
            <h2 className="mt-2 font-serif text-2xl md:text-3xl">
              Rondas de cobre en explotación, desde USD 15.000.
            </h2>
          </div>
          <Link
            to="/inversion/terminal"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-sm bg-accent-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-brand-contrast hover:bg-im-cobalt-deep"
          >
            Abrir Investor Terminal <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MiningInvestShowcase />
      <InvestorDeckEntry />

      {/* 2. INVERSIONISTAS */}
      <section id="colateral" className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <Eyebrow className="mb-3">Inversionistas</Eyebrow>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight">
              Tu inversión, garantizada por una parcela inscrita.
            </h2>
            <ol className="mt-6 space-y-3 text-sm">
              {[
                "Simula el monto y plazo: ves tu interés mensual al instante.",
                "Descarga el memorándum ejecutivo con las condiciones.",
                "Deja tus datos: un asesor te contacta y abre la sala de documentos.",
              ].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="font-mono text-accent-brand">0{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid grid-cols-3 gap-px bg-hairline border border-hairline">
              {[
                { v: "UF + 12 %", l: "Tasa anual" },
                { v: "$150.000", l: "Interés/mes por $15 MM" },
                { v: "Maule", l: "Hualañé · Licantén" },
              ].map((k) => (
                <div key={k.l} className="bg-surface px-4 py-4">
                  <div className="font-mono text-lg">{k.v}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-content-muted mt-1">
                    {k.l}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                to="/inversion-colateral"
                className="inline-flex items-center gap-2 h-11 px-5 bg-content text-surface text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
              >
                Simular y solicitar contacto <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <CollateralDownloadButtons className="mt-3" />
            <p className="mt-4 text-[11px] text-content-muted">
              Tasa pactada por contrato, no proyección minera. No constituye oferta pública de
              valores.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <figure className="col-span-2 relative">
              <img
                src={hualaneSat}
                alt="Vista satelital Hualañé"
                loading="lazy"
                className="w-full h-64 object-cover border border-hairline"
              />
              <figcaption className="absolute left-2 top-2 bg-surface/90 px-2 py-1 font-mono text-[9px] uppercase tracking-widest">
                Imagen real · satelital
              </figcaption>
            </figure>
            {[
              { s: velValle, l: "Valle · referencial" },
              { s: colateralCover, l: "Maule · ilustrativa" },
            ].map((x) => (
              <figure key={x.l} className="relative">
                <img
                  src={x.s}
                  alt={x.l}
                  loading="lazy"
                  className="w-full h-36 object-cover border border-hairline"
                />
                <figcaption className="absolute left-2 top-2 bg-surface/90 px-2 py-1 font-mono text-[9px] uppercase tracking-widest">
                  {x.l}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CATASTRO */}
      <section id="catastro" className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
          <Eyebrow className="mb-3">Catastro</Eyebrow>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight max-w-3xl">
            Pruébalo ahora: busca por titular, RUT, nombre o comuna.
          </h2>
          <CatastroQuickSearch />

          <div className="mt-12 grid md:grid-cols-3 gap-px bg-hairline border border-hairline">
            {[
              {
                n: "Gratis",
                d: "Búsqueda y ficha básica",
                f: ["Titular y estado", "Mapa nacional", "Superficie y comuna"],
              },
              {
                n: "Pro",
                d: "Para operadores y abogados",
                f: ["Alertas de vencimiento", "Fichas PDF", "Capas satelitales"],
              },
              {
                n: "Empresa",
                d: "Due diligence y equipos",
                f: ["Terreno 3D y geofísica", "Informes técnicos", "Usuarios múltiples"],
              },
            ].map((p) => (
              <div key={p.n} className="bg-surface p-6">
                <div className="font-serif text-2xl">{p.n}</div>
                <div className="text-xs text-content-muted mt-1">{p.d}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.f.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check className="w-4 h-4 text-accent-brand mt-0.5" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/catastro/precios"
              className="inline-flex items-center gap-2 h-11 px-5 bg-content text-surface text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors"
            >
              Ver planes <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/contacto"
              className="inline-flex items-center gap-2 h-11 px-5 border border-hairline text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:border-accent-brand"
            >
              Solicitar demo
            </Link>
          </div>
        </div>
      </section>

      {/* 4. CIERRE */}
      <section className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-5 py-14 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl">¿Ya eres cliente?</h2>
            <p className="text-content-muted text-sm mt-1">
              Entra a tu terminal: proyectos, catastro, documentos y reportes en un solo lugar.
            </p>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 h-11 px-5 border border-content text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-content hover:text-surface transition-colors"
          >
            <FileText className="w-4 h-4" /> Acceso clientes
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function DoorCard(props: {
  image: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  body: string;
  cta: string;
  to?: "/inversion-colateral";
  href?: string;
}) {
  const inner = (
    <>
      <div className="h-36 -mx-6 -mt-6 mb-5 overflow-hidden">
        <img
          src={props.image}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex items-center gap-2 text-accent-brand">
        {props.icon}
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]">{props.tag}</span>
      </div>
      <h3 className="mt-3 font-serif text-2xl">{props.title}</h3>
      <p className="mt-2 text-sm text-content-muted">{props.body}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] group-hover:text-accent-brand">
        {props.cta}{" "}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </>
  );
  const cls =
    "group block overflow-hidden bg-surface text-content p-6 border border-hairline hover:border-accent-brand transition-colors";
  return props.to ? (
    <Link to={props.to} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={props.href} className={cls}>
      {inner}
    </a>
  );
}

function CatastroQuickSearch() {
  const [q, setQ] = useState("");
  const search = useServerFn(searchConcessions);
  const m = useMutation({ mutationFn: (term: string) => search({ data: { q: term, limit: 6 } }) });

  return (
    <div className="mt-6 max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) m.mutate(q.trim());
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: Esperanza, Codelco, Illapel…"
            aria-label="Buscar concesión"
            className="w-full h-12 pl-10 pr-4 border border-hairline bg-surface text-sm focus:outline-none focus:border-accent-brand"
          />
        </div>
        <button
          type="submit"
          disabled={m.isPending || q.trim().length < 2}
          className="h-12 px-6 bg-content text-surface text-[11px] font-semibold uppercase tracking-[0.2em] disabled:opacity-50"
        >
          {m.isPending ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {m.isError && (
        <p className="mt-3 text-xs text-content-muted">
          No pudimos consultar ahora. Intenta de nuevo.
        </p>
      )}
      {m.data && (
        <div className="mt-4 border border-hairline">
          {m.data.results.length === 0 ? (
            <div className="p-4 text-sm text-content-muted">
              Sin resultados. Prueba en el{" "}
              <Link to="/catastro/mapa" className="underline text-accent-brand">
                mapa nacional
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {m.data.results.map((r) => (
                <li key={r.code}>
                  <Link
                    to="/catastro/c/$code"
                    params={{ code: r.code }}
                    className="flex items-start gap-3 p-3 hover:bg-surface-2 text-sm"
                  >
                    <Building2 className="w-4 h-4 mt-0.5 text-accent-brand shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.name ?? r.code}</div>
                      <div className="text-xs text-content-muted truncate">
                        {r.holder ?? "—"} · {r.commune ?? r.region ?? ""}
                        {r.area_ha ? ` · ${r.area_ha.toLocaleString("es-CL")} ha` : ""}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-content-muted mt-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
