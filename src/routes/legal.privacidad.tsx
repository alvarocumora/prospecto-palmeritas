import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/features/marketing/MarketingShell";

export const Route = createFileRoute("/legal/privacidad")({
  head: () => ({
    meta: [
      { title: "Política de privacidad — Geocapitals" },
      {
        name: "description",
        content:
          "Política de tratamiento de datos personales conforme a la Ley 21.719 (Chile) y GDPR. Derechos ARCO+P, retención, subprocesadores y contacto del DPO.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Legal · Ley 21.719 Chile"
      title="Política de privacidad"
      intro="Versión vigente: 2026-11-01. Responsable: Geocapitals SpA. Contacto DPO: privacy@geocapitals.com."
    >
      <article className="prose prose-sm max-w-3xl text-content-subtle space-y-4">
        <h2 className="text-content">1. Responsable y DPO</h2>
        <p>
          Geocapitals SpA (Santiago, Chile) es responsable del tratamiento. El Delegado de
          Protección de Datos puede ser contactado en{" "}
          <a className="text-accent-brand" href="mailto:privacy@geocapitals.com">
            privacy@geocapitals.com
          </a>
          .
        </p>

        <h2 className="text-content">2. Datos que tratamos</h2>
        <p>
          Identificación (nombre, RUT/ID fiscal, email, teléfono), organización, país, ticket
          objetivo, commodities de interés, estándares aceptados (NI 43-101, JORC), documentos
          técnicos y comerciales, IP y user-agent (hasheados en formularios públicos), bitácora de
          consentimientos y auditoría operativa.
        </p>

        <h2 className="text-content">3. Base legal y finalidad</h2>
        <ul>
          <li>
            <strong>Ejecución de contrato</strong>: onboarding, matching, firma electrónica,
            trazabilidad de operaciones.
          </li>
          <li>
            <strong>Obligación legal</strong>: KYC/AML, tributaria, prevención de fraude.
          </li>
          <li>
            <strong>Interés legítimo</strong>: seguridad, prevención de abuso, mejora del servicio.
          </li>
          <li>
            <strong>Consentimiento</strong>: comunicaciones comerciales, inclusión en dataroom
            compartido con terceros bajo NDA.
          </li>
        </ul>

        <h2 className="text-content">4. Retención</h2>
        <ul>
          <li>
            Cuenta y operaciones: mientras exista relación + 5 años (obligaciones tributarias).
          </li>
          <li>Consentimientos: 5 años tras revocación (prueba de licitud).</li>
          <li>Bitácora de correos y hits de formularios: 180 días.</li>
          <li>Bitácora de auditoría: 365 días.</li>
        </ul>

        <h2 className="text-content">5. Compartición</h2>
        <p>
          Datos del inversionista se comparten con titulares mineros sólo tras NDA firmado y
          consentimiento explícito. Nunca vendemos datos personales.
        </p>

        <h2 className="text-content">6. Subprocesadores</h2>
        <ul>
          <li>Supabase (base de datos, autenticación y almacenamiento — UE/US).</li>
          <li>Cloudflare (edge, DNS, protección — Global).</li>
          <li>Resend (correo transaccional — US).</li>
          <li>Lovable AI Gateway (extracción documental — US).</li>
        </ul>

        <h2 className="text-content">7. Derechos ARCO+P (Ley 21.719)</h2>
        <p>
          Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación, Oposición y
          Portabilidad. Respondemos dentro de 30 días hábiles.
        </p>
        <ul>
          <li>
            Usuarios autenticados:{" "}
            <Link to="/panel/privacidad" className="text-accent-brand">
              panel de privacidad
            </Link>{" "}
            (exporta tu JSON y crea solicitudes).
          </li>
          <li>
            No autenticados:{" "}
            <a className="text-accent-brand" href="mailto:privacy@geocapitals.com">
              privacy@geocapitals.com
            </a>
            .
          </li>
          <li>
            Reclamos ante la Agencia de Protección de Datos Personales (Chile) una vez esté
            operativa.
          </li>
        </ul>

        <h2 className="text-content">8. Seguridad</h2>
        <p>
          Cifrado en tránsito (TLS 1.2+) y en reposo, RLS por fila en PostgreSQL, roles mínimos,
          bitácora inmutable de firmas electrónicas y hashes SHA-256 en documentos verificables.
        </p>

        <h2 className="text-content">9. Cambios</h2>
        <p>Publicamos versiones fechadas. La versión activa se registra en cada consentimiento.</p>

        <p className="text-xs">
          <Link to="/legal/terminos" className="text-accent-brand">
            Términos de servicio
          </Link>
        </p>
      </article>
    </MarketingPage>
  );
}
