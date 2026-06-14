import { createFileRoute } from "@tanstack/react-router";
import { Mail, Linkedin, MapPin, Clock } from "lucide-react";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { ContactForm } from "@/features/marketing/ContactForm";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto — Geocapitals" },
      {
        name: "description",
        content: "Habla con el equipo de Geocapitals. Respondemos en menos de 24 horas hábiles.",
      },
      { property: "og:title", content: "Contacto — Geocapitals" },
      {
        property: "og:description",
        content: "Conecta con nosotros para evaluar tu proyecto minero o desplegar capital.",
      },
    ],
  }),
  component: ContactoPage,
});

function ContactoPage() {
  return (
    <MarketingPage
      eyebrow="Contacto"
      title="Hablemos de tu próximo proyecto minero"
      intro="Dueños de proyectos, fondos e inversionistas calificados, QPs y reguladores. Cuéntanos qué buscas y agendamos una sesión."
    >
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12">
        <div>
          <ContactForm source="contact-page" />
        </div>
        <aside className="space-y-6">
          <InfoCard
            icon={<Mail className="w-5 h-5" />}
            title="Correo directo"
            lines={["info@geocapitals.com", "deals@geocapitals.com"]}
          />
          <InfoCard
            icon={<Linkedin className="w-5 h-5" />}
            title="LinkedIn"
            lines={["/company/geocapitals"]}
          />
          <InfoCard
            icon={<MapPin className="w-5 h-5" />}
            title="Operación"
            lines={["Santiago de Chile", "Cobertura LatAm + global"]}
          />
          <InfoCard
            icon={<Clock className="w-5 h-5" />}
            title="Respuesta"
            lines={["< 24 h hábiles", "Reuniones en español / english"]}
          />
        </aside>
      </div>
    </MarketingPage>
  );
}

function InfoCard({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border border-[var(--brand-hair)] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--brand-blue-soft)] text-[var(--brand-blue)]">
          {icon}
        </span>
        <div className="font-display text-[15px] text-[var(--brand-navy-deep)]">{title}</div>
      </div>
      <div className="mt-3 space-y-1 text-sm text-[var(--brand-ink)]">
        {lines.map((l) => (
          <div key={l} className="font-mono text-[13px]">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}
