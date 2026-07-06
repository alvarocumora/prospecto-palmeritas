import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/features/marketing/MarketingShell";

export const Route = createFileRoute("/legal/terminos")({
  head: () => ({ meta: [{ title: "Términos de servicio — Geocapitals" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MarketingPage eyebrow="Legal" title="Términos de servicio" intro="Última actualización: 2025.">
      <article className="prose prose-sm max-w-3xl text-content-subtle space-y-4">
        <h2 className="text-content">1. Naturaleza de la plataforma</h2>
        <p>
          Geocapitals opera una plataforma de inteligencia geoespacial y deal-flow minero. No somos
          un broker-dealer, no custodiamos fondos de inversionistas y no garantizamos retornos.
        </p>
        <h2 className="text-content">2. Comisión de éxito</h2>
        <p>
          Por transacciones cerradas mediante la plataforma (venta, joint venture o royalty),
          Geocapitals cobra una comisión de éxito acordada por escrito con las partes. La
          facturación se emite post-cierre desde Geocapitals SpA (Chile).
        </p>
        <h2 className="text-content">3. KYC / AML</h2>
        <p>
          Todos los inversionistas institucionales pasan por verificación KYC/AML antes de acceder a
          data rooms. Nos reservamos el derecho de rechazar perfiles a discreción.
        </p>
        <h2 className="text-content">4. Datos públicos</h2>
        <p>
          El catastro minero y datos satelitales provienen de fuentes públicas (Sernageomin,
          Sentinel-2, Landsat, USGS). No garantizamos exactitud y se entregan tal cual.
        </p>
        <h2 className="text-content">5. Confidencialidad</h2>
        <p>
          Los data rooms requieren NDA click-wrap. La descarga, captura y reenvío de documentos
          quedan auditados.
        </p>
        <h2 className="text-content">6. Jurisdicción</h2>
        <p>Tribunales de Santiago, Chile.</p>
        <p className="text-xs">
          Contacto:{" "}
          <a className="text-accent-brand" href="mailto:legal@geocapitals.com">
            legal@geocapitals.com
          </a>{" "}
          ·{" "}
          <Link to="/legal/privacidad" className="text-accent-brand">
            Política de privacidad
          </Link>
        </p>
      </article>
    </MarketingPage>
  );
}
