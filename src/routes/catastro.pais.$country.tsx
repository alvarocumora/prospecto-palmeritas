import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Globe2, ArrowLeft } from "lucide-react";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { GlobalCadastreSearch } from "@/features/catastro-public/GlobalCadastreSearch";
import type { CadastreCountry } from "@/lib/cadastre/types";

// Fichas SEO por país de la Capa Catastral Universal: /catastro/pais/chile,
// /catastro/pais/peru, /catastro/pais/brasil. Cada una con metadatos propios
// (title/description por país) para posicionar en búsquedas del tipo
// "catastro minero perú" y canalizar tráfico orgánico al buscador.

type CountrySeo = {
  code: CadastreCountry;
  slug: string;
  name: string;
  flag: string;
  institution: string;
  title: string;
  description: string;
  blurb: string;
};

const COUNTRY_SEO: Record<string, CountrySeo> = {
  chile: {
    code: "CL",
    slug: "chile",
    name: "Chile",
    flag: "🇨🇱",
    institution: "SERNAGEOMIN",
    title: "Catastro minero de Chile · concesiones SERNAGEOMIN en vivo — Geocapitals",
    description:
      "Busca concesiones mineras chilenas por titular, nombre o rol. Datos SERNAGEOMIN en vivo: vigencia, hectáreas, comuna y estado legal. Más de 100.000 concesiones.",
    blurb:
      "Concesiones de exploración y explotación con su situación (constituida, en trámite, eliminada), titular con RUT y hectáreas, directo de SERNAGEOMIN.",
  },
  peru: {
    code: "PE",
    slug: "peru",
    name: "Perú",
    flag: "🇵🇪",
    institution: "INGEMMET",
    title: "Catastro minero de Perú · derechos mineros INGEMMET en vivo — Geocapitals",
    description:
      "Busca derechos mineros peruanos por titular, nombre o código único. Datos INGEMMET GEOCATMIN en vivo: estado (titulado, en trámite, extinguido) y hectáreas. ~65.000 derechos.",
    blurb:
      "Derechos mineros con su estado (titulado, en trámite, extinguido), titular y hectáreas, directo del GEOCATMIN de INGEMMET.",
  },
  brasil: {
    code: "BR",
    slug: "brasil",
    name: "Brasil",
    flag: "🇧🇷",
    institution: "ANM",
    title: "Catastro minero de Brasil · processos minerários ANM SIGMINE — Geocapitals",
    description:
      "Busca processos minerários brasileños por titular, sustancia o número de proceso. Datos ANM SIGMINE en vivo: fase (concessão de lavra, pesquisa…), sustancia, UF y hectáreas.",
    blurb:
      "Processos minerários activos con su fase (concessão de lavra, autorização de pesquisa, licenciamento…), sustancia y UF, directo del SIGMINE de la ANM.",
  },
  zambia: {
    code: "ZM",
    slug: "zambia",
    name: "Zambia",
    flag: "🇿🇲",
    institution: "Zambia Mining Cadastre",
    title: "Zambia mining cadastre · licences live from the official portal — Geocapitals",
    description:
      "Search Zambian mining licences by holder, licence code or commodity (copper, cobalt…). Live data from the official Landfolio cadastre: status, hectares, expiry and commodities.",
    blurb:
      "Licencias mineras con su estado (active, application, inactive), titular, commodity y vencimiento, directo del portal catastral oficial de Zambia (Landfolio).",
  },
  malawi: {
    code: "MW",
    slug: "malawi",
    name: "Malawi",
    flag: "🇲🇼",
    institution: "Malawi Mining Cadastre",
    title: "Malawi mining cadastre · licences live from the official portal — Geocapitals",
    description:
      "Search Malawian mining licences by holder or licence code. Live data from the official Landfolio cadastre portal: status, area and expiry dates.",
    blurb:
      "Licencias mineras con su estado, titular, superficie y vencimiento, directo del portal catastral oficial de Malawi (Landfolio).",
  },
};

export const Route = createFileRoute("/catastro/pais/$country")({
  loader: ({ params }) => {
    const seo = COUNTRY_SEO[params.country.toLowerCase()];
    if (!seo) throw notFound();
    return { seo };
  },
  head: ({ loaderData }) => {
    const seo = loaderData?.seo;
    if (!seo) return { meta: [{ title: "Catastro minero — Geocapitals" }] };
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
      ],
    };
  },
  component: CountryCadastrePage,
  notFoundComponent: () => (
    <PublicCatastroShell>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">País no disponible</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Por ahora cubrimos Chile, Perú, Brasil, Zambia y Malawi. Más países en camino.
        </p>
        <Link to="/catastro/global" className="text-primary underline text-sm">
          Ir al buscador multi-país
        </Link>
      </div>
    </PublicCatastroShell>
  ),
});

function CountryCadastrePage() {
  const { seo } = Route.useLoaderData();
  return (
    <PublicCatastroShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/catastro/global"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Buscador multi-país
        </Link>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            <Globe2 className="w-3.5 h-3.5" /> Capa Catastral Universal · {seo.institution}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {seo.flag} Catastro minero de {seo.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">{seo.blurb}</p>
        </div>

        <GlobalCadastreSearch initialCountry={seo.code} />

        <p className="mt-8 text-center text-[10px] font-mono text-muted-foreground max-w-lg mx-auto">
          Datos públicos oficiales de {seo.institution} consultados en vivo. Geocapitals normaliza
          los esquemas de cada país a una vista única.
        </p>
      </div>
    </PublicCatastroShell>
  );
}
