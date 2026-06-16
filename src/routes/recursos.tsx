import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, BookOpen, Compass, Database } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { BrandButton, Eyebrow } from "@/components/brand";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos — Geocapitals" },
      {
        name: "description",
        content: "Guías, whitepapers y documentación pública de la plataforma Geocapitals.",
      },
      { property: "og:title", content: "Recursos — Geocapitals" },
      {
        property: "og:description",
        content: "Aprende a operar exploración minera bajo estándares institucionales.",
      },
    ],
  }),
  component: RecursosPage,
});

const RESOURCES = [
  {
    i: FileText,
    t: "NI 43-101 explicado",
    d: "Estructura del reporte técnico, gaps frecuentes y cómo Geocapitals los cubre.",
    to: "/contacto",
  },
  {
    i: Compass,
    t: "Catastro Chile en 10 minutos",
    d: "Cómo leer concesiones, boletín minero, vencimientos y superposiciones.",
    to: "/catastro",
  },
  {
    i: Database,
    t: "Capas satelitales que usamos",
    d: "Sentinel-2, MPC, índices HYD/IOX/CLY/STR/NDVI y cómo se interpretan.",
    to: "/contacto",
  },
  {
    i: BookOpen,
    t: "Demo en vivo",
    d: "Recorrido guiado por el terminal: catastro, 3D, deals y data room.",
    to: "/contacto",
  },
];

function RecursosPage() {
  return (
    <MarketingPage
      eyebrow="Recursos"
      title="Documentación, guías y demos"
      intro="Material práctico para entender cómo Geocapitals levanta capital, evalúa proyectos y cumple estándares globales."
    >
      <div className="grid md:grid-cols-2 gap-5">
        {RESOURCES.map(({ i: Icon, t, d, to }) => (
          <Link
            key={t}
            to={to}
            className="group rounded-2xl border border-[var(--brand-hair)] bg-white p-6 hover:border-[var(--brand-blue)] transition flex gap-4"
          >
            <span className="grid place-items-center w-12 h-12 rounded-lg bg-[var(--brand-blue-soft)] text-[var(--brand-blue)] shrink-0">
              <Icon className="w-6 h-6" strokeWidth={1.5} />
            </span>
            <div>
              <div className="font-display text-lg text-[var(--brand-navy-deep)] group-hover:text-[var(--brand-blue)]">
                {t}
              </div>
              <p className="text-sm text-[var(--brand-mute)] mt-1.5 leading-relaxed">{d}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-dashed border-[var(--brand-hair)] bg-[var(--brand-blue-soft)] p-8 text-center">
        <Eyebrow className="mb-2">¿Buscas algo específico?</Eyebrow>
        <h3 className="brand-display text-2xl text-[var(--brand-navy-deep)]">
          Pídelo a nuestro equipo
        </h3>
        <p className="text-[var(--brand-mute)] mt-2">
          Whitepapers personalizados, casos de uso por jurisdicción y onepagers institucionales bajo
          NDA.
        </p>
        <BrandButton asChild className="mt-5">
          <Link to="/contacto">Solicitar documento</Link>
        </BrandButton>
      </div>
    </MarketingPage>
  );
}
