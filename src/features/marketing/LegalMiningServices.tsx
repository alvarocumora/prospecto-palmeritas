import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Scale } from "lucide-react";
import { Eyebrow } from "@/components/brand";
import { LegalTramiteModal } from "@/features/catastro-workbench/LegalTramiteModal";
import type { LegalServiceType } from "@/lib/cadastre/legalRequest";
import { LEGAL_SERVICES } from "@/lib/cadastre/legalServices";

const GUARANTEES = [
  "Abogados mineros habilitados en Chile",
  "Control estricto de plazos fatales y TGR",
  "Trazabilidad completa en Oficina Judicial Virtual",
];

export function LegalMiningServices() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<LegalServiceType>("pedimento");

  const openFor = (svc: LegalServiceType) => {
    setSelectedService(svc);
    setModalOpen(true);
  };

  return (
    <section id="legal-minero" className="scroll-mt-20 border-b border-hairline bg-surface-2">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="max-w-3xl">
          <Eyebrow className="mb-3">Consultoría y Legal Minero</Eyebrow>
          <h2 className="font-serif text-3xl leading-tight md:text-4xl">
            De la coordenada al título minero, sin errores de plazo.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-content-muted">
            Diseña tu pedimento o manifestación directamente en nuestro mapa de catastro y deja en
            manos de nuestro equipo legal la verificación jurídica, redacción, ingreso en OJV y
            seguimiento procesal.
          </p>
        </div>

        <div className="mt-8 grid gap-px border border-hairline bg-hairline md:grid-cols-3">
          {LEGAL_SERVICES.map((svc, idx) => (
            <div key={svc.id} className="flex flex-col justify-between bg-surface p-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand">
                  0{idx + 1} · Servicio
                </div>
                <h3 className="mt-2 font-serif text-2xl leading-snug">{svc.title}</h3>
                <div className="mt-1 text-xs text-content-muted">{svc.subtitle}</div>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {svc.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/servicios/legal-minero"
                search={{ servicio: svc.id }}
                className="mt-6 inline-flex items-center gap-2 self-start font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-brand hover:underline"
              >
                Ver alcance y cotizar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 border border-hairline bg-surface px-5 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-content-muted md:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g} className="flex items-center gap-2">
              <Scale className="h-3.5 w-3.5 shrink-0 text-accent-brand" />
              <span>{g}</span>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/catastro/mapa"
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-accent-brand px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-brand-contrast transition-opacity hover:opacity-90"
          >
            Diseñar concesión en el mapa <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => openFor("pedimento")}
            className="inline-flex h-11 items-center gap-2 rounded-sm border border-content px-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-content transition-colors hover:bg-content hover:text-surface"
          >
            Solicitar asesoría legal
          </button>
        </div>

        <p className="mt-4 text-[11px] text-content-muted">
          La vacancia y prelación mostradas en el mapa son indicativas; la disponibilidad jurídica
          definitiva se verifica en OJV y Boletín Oficial antes de cada presentación.
        </p>
      </div>

      <LegalTramiteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        source="landing-legal-minero"
        defaultService={selectedService}
      />
    </section>
  );
}