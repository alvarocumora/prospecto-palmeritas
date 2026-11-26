import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Scale, X } from "lucide-react";
import { submitContactMessage } from "@/lib/contactMessages.functions";
import {
  computeEffectiveAreaHa,
  formatLegalTramiteMessage,
  validateLegalContact,
  type LegalServiceType,
  type LegalTramiteContext,
} from "@/lib/cadastre/legalRequest";

const SERVICE_OPTIONS: { value: LegalServiceType; label: string }[] = [
  { value: "pedimento", label: "Pedimento de exploración" },
  { value: "manifestacion", label: "Manifestación de explotación" },
  { value: "due-diligence", label: "Due Diligence y blindaje territorial" },
];

export function LegalTramiteModal({
  open,
  onOpenChange,
  source,
  defaultService = "pedimento",
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: string;
  defaultService?: LegalServiceType;
  context?: LegalTramiteContext;
}) {
  const submit = useServerFn(submitContactMessage);
  const [service, setService] = useState<LegalServiceType>(context ? context.kind : defaultService);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim() || null,
          role: "owner",
          source,
          message: formatLegalTramiteMessage(
            service,
            { name, email, phone, organization, notes },
            context,
          ),
        },
      }),
  });

  useEffect(() => {
    if (!open) return;
    setService(context ? context.kind : defaultService);
    if (context) {
      setName((prev) => prev || context.datos.nombre || "");
      setEmail((prev) => prev || context.datos.email || "");
      setOrganization((prev) => prev || context.datos.representada || "");
    }
    setValidationError(null);
    mut.reset();
  }, [open, defaultService, context]);

  const effectiveAreaHa = context
    ? computeEffectiveAreaHa(context.kind, context.ped, context.pertenencias)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateLegalContact({ name, email, phone, organization, notes });
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    mut.mutate();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[800] bg-surface-inverse/70 backdrop-blur-xs" />
        <DialogPrimitive.Content
          data-theme="im-light"
          className="fixed left-1/2 top-1/2 z-[810] w-[calc(100%-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-sm border border-hairline bg-surface p-6 text-content shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-brand">
                <Scale className="h-3.5 w-3.5" /> Geocapitals Legal Minero
              </div>
              <DialogPrimitive.Title className="mt-1 font-serif text-2xl leading-tight text-content">
                {context ? "Tramitar esta concesión con nuestro equipo" : "Solicitar asesoría legal minera"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-content-muted">
                {context
                  ? "Adjuntamos automáticamente las coordenadas, superficie y tribunal sugerido para revisión legal antes de ingresar en OJV."
                  : "Cuéntanos el trámite o sector que necesitas evaluar y un abogado minero te contactará en menos de 24 horas hábiles."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label="Cerrar" className="text-content-muted hover:text-content">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {mut.isSuccess ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-sm border border-hairline bg-surface-2 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-brand" />
                <div className="text-sm">
                  <div className="font-semibold text-content">Solicitud enviada al equipo legal</div>
                  <p className="mt-1 text-xs text-content-muted">
                    Revisaremos los antecedentes{context ? ", coordenadas y disponibilidad en OJV/Boletín" : ""} y te responderemos al correo registrado en menos de 24 horas hábiles.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-10 rounded-sm bg-content px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-surface hover:bg-accent-brand transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              {context && effectiveAreaHa !== null ? (
                <div className="rounded-sm border border-hairline bg-surface-2 p-3 text-xs space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted">
                    Resumen técnico precargado
                  </div>
                  <div className="font-semibold text-content">
                    {context.kind === "manifestacion" ? "Manifestación" : "Pedimento"} ·{" "}
                    {context.datos.concesion?.trim() || "Nombre por definir"} ·{" "}
                    {effectiveAreaHa.toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha
                  </div>
                  <div className="text-content-muted">
                    {context.datos.comuna ? `${context.datos.comuna} · ` : ""}
                    {context.datos.tribunal || "Tribunal por confirmar"} ·{" "}
                    {context.ped.datum.includes("UTM") ? context.ped.datum : `${context.ped.datum} · Huso ${context.ped.huso}S`}
                  </div>
                  <div className="font-mono text-[10px] text-content-muted">
                    NW N {Math.round(context.ped.cornersUtm.NW[1]).toLocaleString("es-CL")} / E{" "}
                    {Math.round(context.ped.cornersUtm.NW[0]).toLocaleString("es-CL")} · Lados{" "}
                    {Math.round(context.ped.ladosM["N-S"]).toLocaleString("es-CL")}×
                    {Math.round(context.ped.ladosM["E-W"]).toLocaleString("es-CL")} m
                  </div>
                </div>
              ) : (
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">
                    Servicio requerido
                  </span>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value as LegalServiceType)}
                    className="w-full h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:border-accent-brand"
                  >
                    {SERVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">Nombre *</span>
                  <input required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre y apellido" className="w-full h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:border-accent-brand" />
                </label>
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">Correo *</span>
                  <input required type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@empresa.cl" className="w-full h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:border-accent-brand" />
                </label>
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">Teléfono / WhatsApp</span>
                  <input maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+56 9 ..." className="w-full h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:border-accent-brand" />
                </label>
                <label className="block">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">Sociedad o titular</span>
                  <input maxLength={200} value={organization} onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Persona natural o SpA" className="w-full h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-content focus:outline-none focus:border-accent-brand" />
                </label>
              </div>

              <label className="block">
                <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-content-muted mb-1">Antecedentes o comentarios</span>
                <textarea rows={3} maxLength={1500} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={context ? "Ej. indicar si existen labores previas, entregas ENAMI o urgencia de ingreso." : "Comuna, sector, superficie estimada o trámite que necesitas."}
                  className="w-full rounded-sm border border-hairline bg-surface p-3 text-sm text-content focus:outline-none focus:border-accent-brand resize-y" />
              </label>

              {(validationError || mut.isError) && (
                <p className="text-xs text-destructive">
                  {validationError ?? (mut.error instanceof Error ? mut.error.message : "No pudimos enviar la solicitud.")}
                </p>
              )}

              <p className="text-[11px] text-content-muted">
                El ingreso en OJV y el pago de tasa fiscal TGR requieren verificación jurídica previa y patrocinio formal.
              </p>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => onOpenChange(false)}
                  className="h-10 rounded-sm border border-hairline px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-content hover:border-accent-brand">
                  Cancelar
                </button>
                <button type="submit" disabled={mut.isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-sm bg-accent-brand px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-brand-contrast hover:opacity-90 disabled:opacity-50">
                  {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Enviar solicitud legal
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}