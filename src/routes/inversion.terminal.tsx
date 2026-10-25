import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, FileSearch, Landmark, LineChart, ShieldCheck } from "lucide-react";
import { getPublicRounds, type PublicRound } from "@/lib/wallet.functions";
import { MarketingHeader, MarketingFooter } from "@/features/marketing/MarketingShell";

const roundsQuery = queryOptions({
  queryKey: ["public-rounds"],
  queryFn: () => getPublicRounds(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/inversion/terminal")({
  head: () => ({
    meta: [
      { title: "Investor Terminal · GeoCapitals" },
      {
        name: "description",
        content:
          "Rondas de cobre chileno en explotación: Cholqui y Los Verdes–Tilama. Avance, ticket mínimo y documentos en una sola terminal.",
      },
      { property: "og:title", content: "GeoCapitals Investor Terminal" },
      {
        property: "og:description",
        content:
          "Invierte en minería chilena en explotación desde USD 15.000, con trazabilidad documental.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestorTerminal,
});

const usd = (n: number) =>
  n >= 1_000_000
    ? `USD ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} M`
    : `USD ${n.toLocaleString("es-CL")}`;

const META: Record<
  PublicRound["slug"],
  { place: string; metal: string; horizon: string; value: string }
> = {
  cholqui: {
    place: "Melipilla · Región Metropolitana",
    metal: "Cu",
    horizon: "4 años",
    value: "USD 4–6 M",
  },
  losverdes: {
    place: "Los Vilos · Choapa · Coquimbo",
    metal: "Cu-Mo",
    horizon: "5 años",
    value: "USD 8–12 M",
  },
};

function InvestorTerminal() {
  const { data: rounds = [] } = useQuery(roundsQuery);
  const target = rounds.reduce((a, r) => a + r.target, 0);
  const committed = rounds.reduce((a, r) => a + r.committed, 0);

  return (
    <div className="brand-light min-h-screen bg-surface text-content">
      <MarketingHeader />

      {/* Cabecera navy con textura mineral */}
      <section className="mineral-texture bg-surface-inverse text-accent-brand-contrast">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-12 sm:pt-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-im-gold">
            GeoCapitals · Investor Terminal
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.08] sm:text-5xl">
            De la roca al capital: cobre chileno en explotación, desde USD 15.000.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-80">
            Dos rondas abiertas en sociedades de propósito específico. Ves el avance, el ticket
            mínimo y la evidencia de cada faena antes de reservar.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-brand-md border border-im-gold/30 bg-im-gold/20 md:grid-cols-4">
            {[
              {
                l: "Rondas abiertas",
                v: String(rounds.filter((r) => r.open).length || rounds.length),
              },
              { l: "Meta conjunta", v: usd(target) },
              { l: "Colocado declarado", v: usd(committed) },
              { l: "Ticket mínimo", v: usd(rounds[0]?.minTicket ?? 15_000) },
            ].map((k) => (
              <div key={k.l} className="bg-surface-inverse px-4 py-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
                  {k.l}
                </div>
                <div className="mt-2 font-mono text-xl text-im-gold sm:text-2xl">{k.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-brand-contrast hover:bg-im-cobalt-deep"
            >
              Abrir mi wallet <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/inversion/deck"
              search={{ slide: 1, print: undefined }}
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-im-gold/60 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-im-gold hover:bg-im-gold/10"
            >
              Ver deck de inversión
            </Link>
          </div>
        </div>
      </section>

      {/* Oportunidades */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-brand">
          Oportunidades
        </p>
        <h2 className="mt-2 font-serif text-3xl">Rondas en curso</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {rounds.map((r) => {
            const m = META[r.slug];
            const pct = r.target ? Math.min(100, (r.committed / r.target) * 100) : 0;
            return (
              <article
                key={r.code}
                className="overflow-hidden rounded-brand-md border border-hairline bg-surface-3"
              >
                <div className="mineral-texture bg-surface-inverse px-6 py-5 text-accent-brand-contrast">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
                    <span className="text-im-gold">
                      {r.token} · {m.metal}
                    </span>
                    <span className="opacity-70">En explotación</span>
                  </div>
                  <h3 className="mt-3 font-serif text-2xl">{r.name}</h3>
                  <p className="text-xs opacity-75">{m.place}</p>
                </div>
                <div className="p-6">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-2xl">{usd(r.target)}</span>
                    <span className="font-mono text-sm text-accent-brand">
                      {pct.toFixed(0)}% colocado*
                    </span>
                  </div>
                  <div className="mt-3 h-1 w-full bg-surface-2">
                    <div className="h-1 bg-accent-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
                    {[
                      ["Precio por acción", usd(r.sharePrice)],
                      ["Ticket mínimo", usd(r.minTicket)],
                      ["Valuación ref.*", m.value],
                      ["Horizonte", m.horizon],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-content-subtle">
                          {k}
                        </dt>
                        <dd className="mt-0.5 font-mono">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link
                    to="/proyectos/ficha/$slug"
                    params={{ slug: r.slug }}
                    className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-brand hover:underline"
                  >
                    Explorar proyecto <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* De la roca al capital */}
      <section className="border-y border-hairline bg-surface-2">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-serif text-3xl">Cómo invertir</h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-brand-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                i: Compass,
                t: "Descubre el activo",
                d: "Ubicación, pertenencias y estado de cada faena.",
              },
              {
                i: FileSearch,
                t: "Analiza la evidencia",
                d: "Muestras, informes y fuentes citadas por dato.",
              },
              {
                i: Landmark,
                t: "Estructura la inversión",
                d: "Ticket, contrato con la SPV y firma en línea.",
              },
              {
                i: LineChart,
                t: "Sigue tu posición",
                d: "Wallet con acciones confirmadas y cartola PDF.",
              },
            ].map((s, n) => (
              <li key={s.t} className="bg-surface-3 p-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-im-gold">0{n + 1}</span>
                  <s.i className="h-5 w-5 text-accent-brand" />
                </div>
                <h3 className="mt-4 font-serif text-xl">{s.t}</h3>
                <p className="mt-1 text-sm text-content-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <p className="flex gap-2 text-[11px] leading-relaxed text-content-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent-brand" />* Colocación declarada por
          la emisora (Valle Escondido SpA), no equivale a efectivo recaudado. Valuaciones
          referenciales sin auditoría; capacidad productiva declarada por el titular, sin recursos
          certificados NI 43-101/JORC. Inversión ilíquida y de riesgo; no constituye oferta pública
          de valores.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
