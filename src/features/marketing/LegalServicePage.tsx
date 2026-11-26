import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  Landmark,
  Loader2,
  Map,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { BrandButton, Eyebrow } from "@/components/brand";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { submitContactMessage } from "@/lib/contactMessages.functions";
import {
  LEGAL_APPLICANT_LABELS,
  LEGAL_TIMING_LABELS,
  formatLegalQuoteMessage,
  quoteTotalAreaHa,
  validateLegalQuoteSubmission,
  type LegalApplicantType,
  type LegalQuoteDetails,
  type LegalTiming,
} from "@/lib/cadastre/legalQuote";
import { LEGAL_SERVICES, getLegalService } from "@/lib/cadastre/legalServices";
import type { LegalServiceType } from "@/lib/cadastre/legalRequest";

const PROCESS = [
  {
    icon: Map,
    title: "Sector y antecedentes",
    text: "Recibimos la ubicación, el objetivo y los documentos disponibles. Si aún no tienes coordenadas, puedes partir en el mapa.",
  },
  {
    icon: FileSearch,
    title: "Revisión de viabilidad",
    text: "Contrastamos el diseño con catastro, OJV, Boletín y antecedentes formales antes de recomendar una presentación.",
  },
  {
    icon: FileCheck2,
    title: "Alcance y mandato",
    text: "Entregamos una propuesta con honorarios, gastos externos identificados y documentos requeridos. El encargo se acepta por escrito.",
  },
  {
    icon: Landmark,
    title: "Ingreso y seguimiento",
    text: "Con el encargo formalizado, coordinamos la presentación y mantenemos trazabilidad de actuaciones, pagos y plazos.",
  },
];

const FAQ = [
  {
    q: "¿El mapa confirma que una concesión está libre?",
    a: "No. Las capas y el análisis de solapes son antecedentes de trabajo. La disponibilidad y la prelación deben verificarse con los registros judiciales, OJV, Boletín Oficial y la normativa aplicable antes de presentar.",
  },
  {
    q: "¿Puedo solicitar el servicio sin tener coordenadas?",
    a: "Sí. Indica la comuna, el sector y una referencia de ubicación. El equipo evaluará si primero corresponde diseñar el polígono o reunir antecedentes adicionales.",
  },
  {
    q: "¿La cotización incluye tasas, publicaciones y mensura?",
    a: "La propuesta separa honorarios profesionales y gastos externos. Las tasas TGR, publicaciones, mensura u otros gastos se informan cuando se conoce el trámite y su alcance; esta página no inventa montos ni los da por incluidos.",
  },
  {
    q: "¿Enviar el formulario obliga a presentar el trámite?",
    a: "No. El formulario solicita una evaluación y propuesta. No constituye aceptación del encargo, patrocinio, presentación judicial ni reserva de disponibilidad.",
  },
];

export function LegalServicePage({ initialService }: { initialService: LegalServiceType }) {
  const submit = useServerFn(submitContactMessage);
  const [details, setDetails] = useState<LegalQuoteDetails>({
    service: initialService,
    region: "",
    comuna: "",
    areaHa: initialService === "manifestacion" ? 10 : 300,
    requestCount: 1,
    applicantType: "sociedad",
    hasDesign: false,
    timing: "evaluacion",
  });
  const [contact, setContact] = useState({ name: "", email: "", phone: "", organization: "" });
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const service = getLegalService(details.service);

  useEffect(() => {
    setDetails((current) => ({
      ...current,
      service: initialService,
      areaHa:
        current.service === initialService
          ? current.areaHa
          : initialService === "manifestacion"
            ? 10
            : 300,
    }));
  }, [initialService]);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          organization: contact.organization.trim() || null,
          role: "owner",
          source: "legal-service-quote",
          message: formatLegalQuoteMessage(details, { ...contact, notes }),
        },
      }),
  });

  const selectService = (id: LegalServiceType) => {
    setDetails((current) => ({
      ...current,
      service: id,
      areaHa: id === "manifestacion" ? Math.min(current.areaHa, 10) : current.areaHa,
    }));
    setValidationError(null);
    mut.reset();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateLegalQuoteSubmission(details, { ...contact, notes });
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    mut.mutate();
  };

  const totalArea = quoteTotalAreaHa(details);
  const formatArea = (value: number) =>
    value.toLocaleString("es-CL", { maximumFractionDigits: 2 });

  return (
    <MarketingPage
      eyebrow="Geocapitals · Consultoría y Legal Minero"
      title="Tu concesión, con diseño catastral y tramitación en un solo flujo."
      intro="Configura el alcance, reúne los antecedentes y solicita una propuesta para pedimentos, manifestaciones o due diligence minera en Chile."
    >
      <div className="mb-8 flex flex-wrap gap-3">
        <BrandButton asChild>
          <a href="#cotizador">Configurar cotización <ArrowRight /></a>
        </BrandButton>
        <BrandButton asChild variant="outline">
          <Link to="/catastro/mapa">Diseñar en el mapa <Map /></Link>
        </BrandButton>
      </div>

      <section aria-labelledby="servicios-legales" className="border-y border-hairline py-10">
        <Eyebrow className="mb-3">Servicios</Eyebrow>
        <h2 id="servicios-legales" className="font-serif text-3xl text-content">
          Elige el trabajo que necesitas realizar
        </h2>
        <div className="mt-6 grid gap-px border border-hairline bg-hairline lg:grid-cols-3">
          {LEGAL_SERVICES.map((item, index) => (
            <article key={item.id} className="bg-surface p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
                0{index + 1} · {item.shortTitle}
              </div>
              <h3 className="mt-2 font-serif text-2xl leading-tight text-content">{item.title}</h3>
              <p className="mt-1 text-xs text-content-muted">{item.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-content-muted">{item.description}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-content">
                {item.items.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#cotizador"
                onClick={() => selectService(item.id)}
                className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand hover:underline"
              >
                Cotizar este servicio <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="py-14" aria-labelledby="proceso-legal">
        <Eyebrow className="mb-3">Cómo trabajamos</Eyebrow>
        <h2 id="proceso-legal" className="font-serif text-3xl text-content">
          Cuatro etapas, con una decisión informada antes de ingresar
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PROCESS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="border border-hairline bg-surface-2 p-5">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-accent-brand" />
                <span className="font-mono text-[10px] text-content-muted">ETAPA 0{index + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold text-content">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-content-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cotizador" className="scroll-mt-24 border-t border-hairline pt-12" aria-labelledby="cotizador-title">
        <div className="max-w-3xl">
          <Eyebrow className="mb-3">Cotizador de alcance</Eyebrow>
          <h2 id="cotizador-title" className="font-serif text-3xl text-content">
            Define tu trámite y envía una solicitud completa
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-content-muted">
            Calculamos la superficie total y ordenamos los antecedentes. Los honorarios y gastos externos quedan a confirmar mediante una propuesta escrita; no se publican tarifas ficticias.
          </p>
        </div>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
          <form onSubmit={handleSubmit} className="border border-hairline bg-surface p-5 sm:p-6">
            {mut.isSuccess ? (
              <div className="py-6">
                <CheckCircle2 className="h-9 w-9 text-accent-brand" />
                <h3 className="mt-4 font-serif text-3xl text-content">Solicitud registrada</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-content-muted">
                  El equipo recibió el alcance de {service.shortTitle} para {details.comuna.trim()}, con {formatArea(totalArea)} ha preliminares. La respuesta no implica aceptación del encargo ni confirmación de disponibilidad.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <BrandButton type="button" variant="outline" onClick={() => mut.reset()}>
                    Revisar o enviar otra solicitud
                  </BrandButton>
                  <BrandButton asChild variant="ghost">
                    <Link to="/catastro/mapa">Volver al catastro</Link>
                  </BrandButton>
                </div>
              </div>
            ) : (
              <>
                <fieldset>
                  <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                    1. Servicio
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {LEGAL_SERVICES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={details.service === item.id}
                        onClick={() => selectService(item.id)}
                        className={`min-h-14 border px-3 py-3 text-left text-sm font-medium transition-colors ${
                          details.service === item.id
                            ? "border-accent-brand bg-accent-brand-subtle text-accent-brand"
                            : "border-hairline bg-surface text-content hover:border-accent-brand"
                        }`}
                      >
                        {item.shortTitle}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-7">
                  <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                    2. Alcance preliminar
                  </legend>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Región *">
                      <input
                        required
                        maxLength={100}
                        value={details.region}
                        onChange={(event) => setDetails({ ...details, region: event.target.value })}
                        placeholder="Ej. Coquimbo"
                        className="brand-input"
                      />
                    </Field>
                    <Field label="Comuna o localidad *">
                      <input
                        required
                        maxLength={120}
                        value={details.comuna}
                        onChange={(event) => setDetails({ ...details, comuna: event.target.value })}
                        placeholder="Ej. Illapel"
                        className="brand-input"
                      />
                    </Field>
                    <Field label={details.service === "manifestacion" ? "Hectáreas por pertenencia *" : "Hectáreas por solicitud *"}>
                      <input
                        required
                        type="number"
                        min={details.service === "manifestacion" ? 1 : 0.01}
                        max={details.service === "pedimento" ? 5000 : details.service === "manifestacion" ? 10 : undefined}
                        step="0.01"
                        value={details.areaHa}
                        onChange={(event) => setDetails({ ...details, areaHa: Number(event.target.value) })}
                        className="brand-input"
                      />
                    </Field>
                    <Field label={details.service === "manifestacion" ? "Número de pertenencias *" : "Número de solicitudes *"}>
                      <input
                        required
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={details.requestCount}
                        onChange={(event) => setDetails({ ...details, requestCount: Number(event.target.value) })}
                        className="brand-input"
                      />
                    </Field>
                    <Field label="Quién solicitaría">
                      <select
                        value={details.applicantType}
                        onChange={(event) => setDetails({ ...details, applicantType: event.target.value as LegalApplicantType })}
                        className="brand-input"
                      >
                        {Object.entries(LEGAL_APPLICANT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Diseño catastral">
                      <select
                        value={details.hasDesign ? "si" : "no"}
                        onChange={(event) => setDetails({ ...details, hasDesign: event.target.value === "si" })}
                        className="brand-input"
                      >
                        <option value="no">Necesito diseñarlo o revisarlo</option>
                        <option value="si">Ya tengo coordenadas o polígono</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Objetivo de la solicitud">
                      <select
                        value={details.timing}
                        onChange={(event) => setDetails({ ...details, timing: event.target.value as LegalTiming })}
                        className="brand-input"
                      >
                        {Object.entries(LEGAL_TIMING_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </fieldset>

                <fieldset className="mt-7">
                  <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                    3. Datos de contacto
                  </legend>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre completo *">
                      <input
                        required
                        minLength={2}
                        maxLength={200}
                        autoComplete="name"
                        value={contact.name}
                        onChange={(event) => setContact({ ...contact, name: event.target.value })}
                        className="brand-input"
                      />
                    </Field>
                    <Field label="Correo *">
                      <input
                        required
                        type="email"
                        maxLength={320}
                        autoComplete="email"
                        value={contact.email}
                        onChange={(event) => setContact({ ...contact, email: event.target.value })}
                        placeholder="nombre@empresa.cl"
                        className="brand-input"
                      />
                    </Field>
                    <Field label="Teléfono / WhatsApp">
                      <input
                        maxLength={40}
                        autoComplete="tel"
                        value={contact.phone}
                        onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                        placeholder="+56 9 ..."
                        className="brand-input"
                      />
                    </Field>
                    <Field label="Sociedad o titular">
                      <input
                        maxLength={200}
                        autoComplete="organization"
                        value={contact.organization}
                        onChange={(event) => setContact({ ...contact, organization: event.target.value })}
                        className="brand-input"
                      />
                    </Field>
                  </div>
                  <div className="mt-4">
                    <Field label="Antecedentes, faenas, roles o fecha relevante">
                      <textarea
                        rows={4}
                        maxLength={1500}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Describe lo que está comprobado y lo que aún debe revisarse."
                        className="brand-input resize-y"
                      />
                    </Field>
                  </div>
                </fieldset>

                {(validationError || mut.isError) && (
                  <p role="alert" className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {validationError ?? (mut.error instanceof Error ? mut.error.message : "No pudimos registrar la solicitud.")}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-[11px] leading-relaxed text-content-muted">
                    Enviar no acepta honorarios ni autoriza una presentación judicial.
                  </p>
                  <BrandButton type="submit" disabled={mut.isPending} className="shrink-0">
                    {mut.isPending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                    Solicitar propuesta
                  </BrandButton>
                </div>
              </>
            )}
          </form>

          <aside className="border border-hairline bg-surface-2 p-5 lg:sticky lg:top-24" aria-live="polite">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
              <Scale className="h-4 w-4" /> Resumen de alcance
            </div>
            <h3 className="mt-3 font-serif text-2xl text-content">{service.shortTitle}</h3>
            <dl className="mt-5 space-y-3 border-y border-hairline py-4 text-sm">
              <SummaryRow label="Ubicación" value={details.comuna.trim() || "Por indicar"} />
              <SummaryRow label="Solicitudes" value={String(details.requestCount || 0)} />
              <SummaryRow label="Superficie unitaria" value={`${formatArea(details.areaHa || 0)} ha`} />
              <SummaryRow label="Superficie total" value={`${formatArea(totalArea || 0)} ha`} emphasize />
            </dl>
            <div className="mt-5">
              <div className="text-xs text-content-muted">Honorarios profesionales</div>
              <div className="mt-1 font-serif text-2xl text-content">A confirmar</div>
              <p className="mt-2 text-xs leading-relaxed text-content-muted">
                La propuesta separará honorarios, tasas, publicaciones, mensura y otros gastos externos que correspondan.
              </p>
            </div>
            <div className="mt-5 border-t border-hairline pt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
                Antecedentes que te pediremos
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-content">
                {service.required.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-brand" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-14 border-t border-hairline pt-12" aria-labelledby="preguntas-legales">
        <Eyebrow className="mb-3">Antes de solicitar</Eyebrow>
        <h2 id="preguntas-legales" className="font-serif text-3xl text-content">Preguntas frecuentes</h2>
        <div className="mt-6 divide-y divide-hairline border-y border-hairline">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none pr-6 font-medium text-content marker:hidden">
                {item.q}
              </summary>
              <p className="mt-3 max-w-4xl text-sm leading-relaxed text-content-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-content-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-content-muted">{label}</dt>
      <dd className={emphasize ? "text-right font-semibold text-accent-brand" : "text-right text-content"}>{value}</dd>
    </div>
  );
}
