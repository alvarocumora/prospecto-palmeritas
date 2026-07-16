import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Globe2, ShieldCheck, Banknote, Handshake, ArrowRight, MapPin } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";
import { BrandButton, Eyebrow } from "@/components/brand";
import { GlobalCadastreSearch } from "@/features/catastro-public/GlobalCadastreSearch";
import { useLocale } from "@/features/marketing/i18n";

// Landing internacional (inglés) — puerta de entrada para inversionistas y
// traders de US/mercados globales. Fija el locale en EN al montar.

export const Route = createFileRoute("/en")({
  head: () => ({
    meta: [
      {
        title: "Geocapitals — Mining intelligence & trading platform for emerging markets",
      },
      {
        name: "description",
        content:
          "One platform for mining cadastres, verified deal-flow and commodity trading across Latin America. Live official data from Chile, Peru and Brazil. US-ready, Miami-based vision.",
      },
      {
        property: "og:title",
        content: "Geocapitals — Mining intelligence for emerging markets",
      },
      {
        property: "og:description",
        content:
          "Unified mining cadastre (Chile · Peru · Brazil), Know-Your-Mine verification, commodity marketplace and financing rails.",
      },
    ],
  }),
  component: EnglishLanding,
});

const PILLARS = [
  {
    icon: Globe2,
    title: "Universal Cadastre Layer",
    text: "Search the official mining cadastres of Chile, Peru, Brazil and Zambia in one place — live, normalized, cross-country. First Africa connector live; ~15 more Landfolio countries to come.",
    to: "/catastro/global",
    cta: "Open the cadastre",
  },
  {
    icon: ShieldCheck,
    title: "Know-Your-Mine verification",
    text: "Every lot and counterparty is scored against cadastral title, legal status, auction lists and official bulletins. Trust built on government data, not promises.",
    to: "/marketplace",
    cta: "See verified lots",
  },
  {
    icon: Handshake,
    title: "Commodity marketplace & trade desk",
    text: "Certified physical lots (concentrates, cathodes, doré) with KYC'd buyers, document pipeline (ICPO → SPA), messaging and e-signature.",
    to: "/marketplace",
    cta: "Browse the marketplace",
  },
  {
    icon: Banknote,
    title: "Financing rails",
    text: "Underwriting engine that pre-approves seller advances against verified lots — asset trust, payable value and counterparty reputation combined into one credit signal.",
    to: "/inversionistas",
    cta: "For investors",
  },
];

function EnglishLanding() {
  const { setLocale } = useLocale();
  // La landing /en fija el idioma de la sesión en inglés.
  useEffect(() => setLocale("en"), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="brand-light min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-hairline bg-gradient-to-b from-accent-brand-subtle/60 to-white">
          <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24 text-center">
            <Eyebrow className="justify-center mb-4">
              LatAm · Africa · Emerging markets — US-ready
            </Eyebrow>
            <h1 className="font-display text-4xl sm:text-6xl text-content tracking-tight max-w-3xl mx-auto">
              The mining intelligence platform for emerging markets.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-content-subtle max-w-2xl mx-auto">
              Unified official cadastres, verified counterparties, physical commodity trading and
              financing rails — from exploration data to closed deals, in one operating system.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <BrandButton asChild>
                <Link to="/catastro/global">
                  Search 4 national cadastres <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </BrandButton>
              <BrandButton asChild variant="outline">
                <Link to="/marketplace">Commodity marketplace</Link>
              </BrandButton>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[11px] font-mono uppercase tracking-wider text-content-subtle">
              <span>🇨🇱 Chile · SERNAGEOMIN</span>
              <span>🇵🇪 Peru · INGEMMET</span>
              <span>🇧🇷 Brazil · ANM</span>
              <span>🇿🇲 Zambia · Landfolio</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Miami, USA
              </span>
            </div>
          </div>
        </section>

        {/* Pilares */}
        <section className="max-w-6xl mx-auto px-5 py-14">
          <div className="grid sm:grid-cols-2 gap-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-xl border border-hairline bg-white p-6">
                <p.icon className="w-5 h-5 text-accent-brand mb-3" strokeWidth={1.8} />
                <h2 className="text-base font-semibold text-content">{p.title}</h2>
                <p className="mt-1.5 text-sm text-content-subtle leading-relaxed">{p.text}</p>
                <Link
                  to={p.to}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
                >
                  {p.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Buscador embebido */}
        <section className="border-t border-hairline bg-slate-50/60">
          <div className="max-w-5xl mx-auto px-5 py-14">
            <div className="text-center mb-6">
              <Eyebrow className="justify-center mb-2">Try it now — no signup</Eyebrow>
              <h2 className="font-display text-2xl sm:text-3xl text-content">
                One search. Four national cadastres — three continents.
              </h2>
            </div>
            <GlobalCadastreSearch />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
