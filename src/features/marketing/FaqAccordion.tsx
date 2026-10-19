import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Eyebrow } from "@/components/brand";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "¿Cuál es la inversión mínima para acceder a proyectos?",
    a: "El ticket mínimo depende del proyecto y del vehículo de inversión (equity, royalty u offtake). La mayoría de deals arrancan en USD 15.000 (≈ CLP 15 millones) y USD 250.000 para participaciones institucionales.",
  },
  {
    q: "¿En qué países operan actualmente?",
    a: "Cubrimos 18 jurisdicciones en LatAm y África. Los mercados principales son Chile, Perú, Brasil, Colombia, México y Sudáfrica, con integraciones directas al catastro de SERNAGEOMIN e INGEMMET.",
  },
  {
    q: "¿Cómo verifican la calidad de los proyectos publicados?",
    a: "Cada proyecto pasa por un proceso de KYC/AML, verificación de catastro, revisión documental por Qualified Persons y auditoría técnica del reporte NI 43-101 / JORC / S-K 1300 asociado.",
  },
  {
    q: "¿Cómo publica un titular su proyecto?",
    a: "Un titular solicita acceso institucional, completa el onboarding con documentación de titularidad y catastro, y en 48-72h su proyecto queda listo para exponerse al deal-flow de inversionistas calificados.",
  },
  {
    q: "¿Qué garantías de seguridad ofrece la plataforma?",
    a: "Cifrado AES-256 en reposo y en tránsito, hosting soberano por jurisdicción, controles SOC 2, audit-trail granular por campo y documento, y firma electrónica avanzada para acuerdos.",
  },
  {
    q: "¿Puedo integrar mis datos con herramientas externas?",
    a: "Sí. Contamos con APIs autenticadas para exportar catastro, geología 3D y reportes hacia sistemas GIS, ERPs y data rooms externos con permisos granulares por rol.",
  },
];

export function FaqAccordion() {
  return (
    <section className="border-b border-hairline bg-surface-2">
      <div className="max-w-5xl mx-auto px-5 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-12">
          <Eyebrow className="mb-3">Preguntas frecuentes</Eyebrow>
          <h2 className="brand-display text-3xl md:text-4xl text-content leading-tight">
            Todo lo que necesitas saber antes de operar
          </h2>
        </Reveal>
        <Reveal>
          <Accordion
            type="single"
            collapsible
            className="rounded-2xl border border-hairline bg-white divide-y divide-[color:var(--hairline)]"
          >
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-0 px-6">
                <AccordionTrigger className="text-left text-content font-display text-base md:text-lg py-5 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-content-subtle text-sm md:text-[15px] leading-relaxed pb-5">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
