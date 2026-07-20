import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  FileSignature,
  Package,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/shell/AppShell";

// Landing pública del portal de proveedores: explica el flujo y dirige a
// registro/login. El hub real está en /dashboard/proveedor (autenticado).

export const Route = createFileRoute("/portal-proveedor")({
  head: () => ({
    meta: [
      { title: "Portal de proveedores — Geocapitals" },
      {
        name: "description",
        content:
          "Registra tu empresa, sube certificados y títulos mineros, publica lotes de commodities y firma tus acuerdos con compradores desde un solo panel.",
      },
      { property: "og:title", content: "Portal de proveedores — Geocapitals" },
      {
        property: "og:description",
        content:
          "Onboarding KYC, publicación de lotes y firma electrónica para productores y traders de minerales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupplierLandingPage,
});

const STEPS = [
  {
    icon: Building2,
    title: "1. Registra tu empresa",
    body: "Crea tu cuenta en 1 minuto con email. Completa razón social, país y contacto.",
  },
  {
    icon: UploadCloud,
    title: "2. Sube tu documentación",
    body: "Constitución, RUT, títulos mineros, assays y referencias comerciales quedan en storage privado, sólo visible para verificación.",
  },
  {
    icon: Package,
    title: "3. Publica tus lotes",
    body: "Registra commodity, tonelaje, incoterm y precio. El equipo Geocapitals verifica antes de publicar en el marketplace.",
  },
  {
    icon: FileSignature,
    title: "4. Firma y cierra",
    body: "NCNDA, LOI y contratos de compraventa firmables online con trazabilidad y QR de validación.",
  },
];

function SupplierLandingPage() {
  return (
    <div className="brand-light min-h-screen flex flex-col bg-surface">
      <MarketingHeader />
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-24">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-brand mb-3">
            <ShieldCheck className="w-4 h-4" />
            Portal de proveedores
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-content leading-tight">
            Vende tus minerales <br className="hidden md:block" />
            con compradores verificados.
          </h1>
          <p className="mt-4 max-w-2xl text-content-subtle text-lg">
            Onboarding, documentación KYC, publicación de lotes y firma electrónica en un mismo
            lugar. Sin planillas ni cadenas de WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup", role: "supplier" }}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-brand text-white px-5 py-3 text-sm font-semibold hover:opacity-90"
            >
              Crear cuenta de proveedor <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-white px-5 py-3 text-sm text-content hover:border-accent-brand"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid md:grid-cols-2 gap-4">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-xl border border-hairline bg-white p-5 flex gap-3"
              >
                <s.icon className="w-6 h-6 text-accent-brand shrink-0" />
                <div>
                  <h3 className="font-display text-lg text-content">{s.title}</h3>
                  <p className="text-sm text-content-subtle mt-1">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-hairline bg-white p-6 text-center">
            <p className="text-sm text-content-subtle">
              ¿Ya te compartieron un link para responder a un requerimiento específico?
            </p>
            <p className="text-[13px] text-content mt-1">
              Ábrelo directamente — no necesitas cuenta para esa propuesta puntual.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
