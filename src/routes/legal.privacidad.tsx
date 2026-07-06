import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/features/marketing/MarketingShell";

export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({ meta: [{ title: "Política de privacidad — Geocapitals" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Legal"
      title="Política de privacidad"
      intro="Última actualización: 2025."
    >
      <article className="prose prose-sm max-w-3xl text-content-subtle space-y-4">
        <h2 className="text-content">1. Datos que recolectamos</h2>
        <p>
          Email, nombre, organización, país, ticket objetivo, commodities de interés, estándares
          aceptados (NI 43-101, JORC) y registros de actividad para auditoría.
        </p>
        <h2 className="text-content">2. Uso</h2>
        <p>
          Verificación KYC/AML, matching de oportunidades, comunicaciones transaccionales y
          notificaciones operativas (catastro, anomalías satelitales).
        </p>
        <h2 className="text-content">3. Compartido</h2>
        <p>
          Sólo compartimos datos del inversionista con titulares mineros tras NDA firmado y
          consentimiento explícito.
        </p>
        <h2 className="text-content">4. Subprocesadores</h2>
        <p>Supabase (PostgreSQL), Cloudflare, Resend / proveedor de email transaccional.</p>
        <h2 className="text-content">5. Derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación o eliminación escribiendo a{" "}
          <a className="text-accent-brand" href="mailto:privacy@geocapitals.com">
            privacy@geocapitals.com
          </a>
          .
        </p>
        <p className="text-xs">
          <Link to="/legal/terminos" className="text-accent-brand">
            Términos de servicio
          </Link>
        </p>
      </article>
    </MarketingPage>
  );
}
