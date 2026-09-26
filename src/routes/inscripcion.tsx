import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  submitInscripcion,
  trackInvitationOpen,
  getActivePrivacyPolicy,
} from "@/lib/suppliers/inscripcion.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/inscripcion")({
  head: () => ({
    meta: [
      { title: "Inscripción de proveedores — Geocapitals" },
      {
        name: "description",
        content:
          "Registra tu material (hierro, cobre, oro, litio, antimonio, carbón) para calificar como proveedor de Geocapitals. Formulario en 6 minutos, sin costo.",
      },
      { property: "og:title", content: "Portal de proveedores — Geocapitals" },
      {
        property: "og:description",
        content:
          "Portal formal de calificación de proveedores de minerales para Chile, Perú, Argentina y Bolivia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InscripcionWizard,
});

const COUNTRIES: Array<{
  code: "CL" | "PE" | "AR" | "BO" | "OTRO";
  name: string;
  taxLabel: string;
}> = [
  { code: "CL", name: "Chile", taxLabel: "RUT" },
  { code: "PE", name: "Perú", taxLabel: "RUC" },
  { code: "AR", name: "Argentina", taxLabel: "CUIT" },
  { code: "BO", name: "Bolivia", taxLabel: "NIT" },
  { code: "OTRO", name: "Otro", taxLabel: "Identificador tributario" },
];

const PRODUCTS = [
  "Mineral de hierro",
  "Concentrado de cobre",
  "Mineral de cobre",
  "Oro",
  "Plata",
  "Litio",
  "Antimonio",
  "Carbón",
  "Otro",
];

const PENALIZABLES = ["Arsénico", "Azufre", "Mercurio", "Plomo", "Cloro", "Flúor", "Humedad"];

type FormState = {
  country: (typeof COUNTRIES)[number]["code"];
  legalName: string;
  taxId: string;
  contactName: string;
  contactRole: string;
  phoneE164: string;
  email: string;
  supplierRole: "titular" | "mandatario" | "intermediario" | "trader" | "";
  intermediariesCount: string;
  mineName: string;
  region: string;
  concessionRef: string;
  concessionMissingReason: string;
  hasExportPermit: string;
  chainOfCustody: string;
  materialAvailability: string;
  product: string;
  presentation: string;
  gradeValue: string;
  gradeUnit: string;
  tonnageAvailable: string;
  tonnageMonthly: string;
  portOrDelivery: string;
  incoterm: string;
  priceAsk: string;
  priceBasis: string;
  acceptsInspection: "si" | "no" | "depende" | "";
  canSendSample: boolean | null;
  penalizables: Array<{ element: string; value: string }>;
  consent: boolean;
  honeypot: string;
};

const EMPTY: FormState = {
  country: "CL",
  legalName: "",
  taxId: "",
  contactName: "",
  contactRole: "",
  phoneE164: "",
  email: "",
  supplierRole: "",
  intermediariesCount: "",
  mineName: "",
  region: "",
  concessionRef: "",
  concessionMissingReason: "",
  hasExportPermit: "",
  chainOfCustody: "",
  materialAvailability: "",
  product: "",
  presentation: "",
  gradeValue: "",
  gradeUnit: "%",
  tonnageAvailable: "",
  tonnageMonthly: "",
  portOrDelivery: "",
  incoterm: "",
  priceAsk: "",
  priceBasis: "a_negociar",
  acceptsInspection: "",
  canSendSample: null,
  penalizables: [],
  consent: false,
  honeypot: "",
};

const STORAGE_KEY = "gc:inscripcion:draft:v1";

function InscripcionWizard() {
  const navigate = useNavigate();
  const submit = useServerFn(submitInscripcion);
  const trackOpen = useServerFn(trackInvitationOpen);
  const loadPolicy = useServerFn(getActivePrivacyPolicy);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [ref, setRef] = useState<string | undefined>();
  const [policy, setPolicy] = useState<{ version: string; content_md: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = COUNTRIES.find((c) => c.code === form.country)!;

  // Hidratación de draft + ref del link.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref") ?? undefined;
    setRef(r);
    if (r) trackOpen({ data: { token: r } }).catch(() => undefined);
    loadPolicy().then((p) => setPolicy({ version: p.version, content_md: p.content_md }));
  }, [loadPolicy, trackOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      // ignore
    }
  }, [form]);

  const canGoNext = useMemo(() => {
    if (step === 1)
      return (
        form.legalName.length > 1 &&
        form.taxId.length > 2 &&
        form.contactName.length > 1 &&
        form.phoneE164.length > 5 &&
        /.+@.+\..+/.test(form.email) &&
        form.supplierRole !== ""
      );
    if (step === 2) return true; // opcional: mine data
    if (step === 3) return form.product !== "" && form.acceptsInspection !== "";
    return form.consent;
  }, [form, step]);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submit({
        data: {
          country: form.country,
          legalName: form.legalName,
          taxId: form.taxId,
          contactName: form.contactName,
          contactRole: form.contactRole || undefined,
          phoneE164: form.phoneE164,
          email: form.email,
          supplierRole: form.supplierRole as "titular" | "mandatario" | "intermediario" | "trader",
          intermediariesCount: form.intermediariesCount || undefined,
          ref,
          policyVersion: policy?.version ?? "unknown",
          honeypot: form.honeypot,
          offer: {
            product: form.product,
            presentation: form.presentation || undefined,
            gradeValue: form.gradeValue ? Number(form.gradeValue) : null,
            gradeUnit: form.gradeUnit || undefined,
            tonnageAvailable: form.tonnageAvailable ? Number(form.tonnageAvailable) : null,
            tonnageMonthly: form.tonnageMonthly ? Number(form.tonnageMonthly) : null,
            portOrDelivery: form.portOrDelivery || undefined,
            incoterm: form.incoterm || undefined,
            priceAsk: form.priceAsk || undefined,
            priceBasis: form.priceBasis,
            acceptsInspection: form.acceptsInspection as "si" | "no" | "depende",
            canSendSample: form.canSendSample ?? undefined,
            mineName: form.mineName || undefined,
            region: form.region || undefined,
            concessionRef: form.concessionRef || undefined,
            concessionMissingReason: form.concessionMissingReason || undefined,
            hasExportPermit: form.hasExportPermit || undefined,
            chainOfCustody: form.chainOfCustody || undefined,
            materialAvailability: form.materialAvailability || undefined,
            penalizables: form.penalizables
              .filter((p) => p.element)
              .map((p) => ({ element: p.element, value: p.value ? Number(p.value) : null })),
          },
        },
      });
      if (!res.ok) {
        setError(
          res.error === "rate_limit"
            ? "Hemos recibido demasiadas inscripciones desde tu conexión. Intenta en una hora."
            : "No pudimos registrar tu inscripción. Intenta nuevamente.",
        );
        setSubmitting(false);
        return;
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      navigate({ to: "/inscripcion/gracias", search: { folio: res.folio } as never });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <header className="border-b border-[hsl(var(--hairline))] bg-[hsl(var(--surface))]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-serif text-xl">
            Geocapitals
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
            Portal de proveedores
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-[hsl(var(--content-subtle))]">
            <span>Paso {step} de 4</span>
            <span>{Math.round((step / 4) * 100)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded bg-[hsl(var(--hairline))]">
            <div
              className="h-full bg-[hsl(var(--accent-brand))] transition-all"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Aviso institucional */}
        <div className="mb-6 flex gap-3 rounded border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--accent-brand))]" />
          <p>
            Geocapitals <strong>nunca</strong> solicita pagos, comisiones ni anticipos para
            registrar o evaluar una oferta. Si alguien te lo pide en nuestro nombre, escribe a{" "}
            <a href="mailto:info@geocapitals.com" className="underline">
              info@geocapitals.com
            </a>
            .
          </p>
        </div>

        {/* Honeypot invisible */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
          className="absolute h-0 w-0 opacity-0"
          aria-hidden="true"
        />

        {step === 1 && <Paso1 form={form} setForm={setForm} country={country} />}
        {step === 2 && <Paso2 form={form} setForm={setForm} />}
        {step === 3 && <Paso3 form={form} setForm={setForm} />}
        {step === 4 && <Paso4 form={form} setForm={setForm} policy={policy} />}

        {error && (
          <div className="mt-6 flex gap-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canGoNext}>
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={!canGoNext || submitting}>
              {submitting ? "Enviando…" : "Enviar inscripción"}
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function Paso1({
  form,
  setForm,
  country,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  country: (typeof COUNTRIES)[number];
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Quién eres</h2>
      <div>
        <Label>País</Label>
        <select
          className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value as FormState["country"] })}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Razón social o nombre</Label>
        <Input
          value={form.legalName}
          onChange={(e) => setForm({ ...form, legalName: e.target.value })}
        />
      </div>
      <div>
        <Label>{country.taxLabel}</Label>
        <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Nombre de contacto</Label>
          <Input
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
        </div>
        <div>
          <Label>Cargo</Label>
          <Input
            value={form.contactRole}
            onChange={(e) => setForm({ ...form, contactRole: e.target.value })}
          />
        </div>
        <div>
          <Label>WhatsApp (con código país, ej. +56962184071)</Label>
          <Input
            value={form.phoneE164}
            onChange={(e) => setForm({ ...form, phoneE164: e.target.value })}
            placeholder="+56..."
          />
        </div>
        <div>
          <Label>Correo</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Tu rol frente al material</Label>
        <div className="mt-2 grid gap-2">
          {(
            [
              ["titular", "Soy titular de la concesión o dueño de la faena"],
              ["mandatario", "Represento al titular con mandato escrito"],
              ["intermediario", "Soy intermediario o comercializador"],
              ["trader", "Soy trader, no tengo relación directa con la mina"],
            ] as const
          ).map(([val, label]) => (
            <label
              key={val}
              className={`flex cursor-pointer items-center gap-2 rounded border p-3 text-sm ${
                form.supplierRole === val
                  ? "border-[hsl(var(--accent-brand))] bg-[hsl(var(--surface))]"
                  : "border-[hsl(var(--hairline))]"
              }`}
            >
              <input
                type="radio"
                checked={form.supplierRole === val}
                onChange={() => setForm({ ...form, supplierRole: val })}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      {(form.supplierRole === "intermediario" || form.supplierRole === "trader") && (
        <div>
          <Label>¿Cuántas personas o empresas hay entre ti y el dueño del material?</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.intermediariesCount}
            onChange={(e) => setForm({ ...form, intermediariesCount: e.target.value })}
          >
            <option value="">Selecciona</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3+">3 o más</option>
            <option value="unknown">No lo sé</option>
          </select>
        </div>
      )}
    </section>
  );
}

function Paso2({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">De dónde sale el material</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Nombre de la mina, faena o acopio</Label>
          <Input
            value={form.mineName}
            onChange={(e) => setForm({ ...form, mineName: e.target.value })}
          />
        </div>
        <div>
          <Label>Región o provincia</Label>
          <Input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Rol / código / número de concesión</Label>
        <Input
          value={form.concessionRef}
          onChange={(e) => setForm({ ...form, concessionRef: e.target.value })}
          placeholder="Chile: rol; Perú: código INGEMMET; Argentina: N° minero; Bolivia: código AJAM"
        />
      </div>
      {!form.concessionRef && (
        <div>
          <Label>Si no lo tienes, explica por qué</Label>
          <Textarea
            value={form.concessionMissingReason}
            onChange={(e) => setForm({ ...form, concessionMissingReason: e.target.value })}
            rows={2}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>¿Permiso de exportación vigente?</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.hasExportPermit}
            onChange={(e) => setForm({ ...form, hasExportPermit: e.target.value })}
          >
            <option value="">—</option>
            <option value="si">Sí</option>
            <option value="tramite">En trámite</option>
            <option value="no">No</option>
            <option value="na">No aplica</option>
          </select>
        </div>
        <div>
          <Label>¿Puedes documentar cadena de custodia mina → puerto?</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.chainOfCustody}
            onChange={(e) => setForm({ ...form, chainOfCustody: e.target.value })}
          >
            <option value="">—</option>
            <option value="si">Sí</option>
            <option value="parcial">Parcialmente</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <Label>Estado actual del material</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.materialAvailability}
            onChange={(e) => setForm({ ...form, materialAvailability: e.target.value })}
          >
            <option value="">—</option>
            <option value="cancha">En cancha</option>
            <option value="produccion">En producción</option>
            <option value="proyectado">Proyectado</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function Paso3({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Qué ofreces</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Producto</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.product}
            onChange={(e) => setForm({ ...form, product: e.target.value })}
          >
            <option value="">Selecciona</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Presentación</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.presentation}
            onChange={(e) => setForm({ ...form, presentation: e.target.value })}
          >
            <option value="">—</option>
            <option>Mineral bruto</option>
            <option>Concentrado</option>
            <option>Precipitado</option>
            <option>Doré</option>
            <option>Cátodo</option>
            <option>Relave / escoria</option>
          </select>
        </div>
        <div>
          <Label>Ley del elemento principal</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={form.gradeValue}
              onChange={(e) => setForm({ ...form, gradeValue: e.target.value })}
              className="font-mono"
            />
            <select
              className="rounded border border-[hsl(var(--hairline))] bg-white px-2"
              value={form.gradeUnit}
              onChange={(e) => setForm({ ...form, gradeUnit: e.target.value })}
            >
              <option>%</option>
              <option>g/t</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Toneladas disponibles ahora</Label>
          <Input
            type="number"
            value={form.tonnageAvailable}
            onChange={(e) => setForm({ ...form, tonnageAvailable: e.target.value })}
            className="font-mono"
          />
        </div>
        <div>
          <Label>Toneladas por mes sostenido</Label>
          <Input
            type="number"
            value={form.tonnageMonthly}
            onChange={(e) => setForm({ ...form, tonnageMonthly: e.target.value })}
            className="font-mono"
          />
        </div>
        <div>
          <Label>Puerto o punto de entrega</Label>
          <Input
            value={form.portOrDelivery}
            onChange={(e) => setForm({ ...form, portOrDelivery: e.target.value })}
          />
        </div>
        <div>
          <Label>Condición de venta</Label>
          <select
            className="mt-1 w-full rounded border border-[hsl(var(--hairline))] bg-white p-2"
            value={form.incoterm}
            onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
          >
            <option value="">—</option>
            <option>EXW</option>
            <option>FOB</option>
            <option>CIF</option>
            <option>OTRA</option>
            <option>NO_SE</option>
          </select>
        </div>
        <div>
          <Label>Precio pedido</Label>
          <Input
            value={form.priceAsk}
            onChange={(e) => setForm({ ...form, priceAsk: e.target.value })}
            placeholder="US$/t o base"
          />
        </div>
      </div>

      <div>
        <Label>Base de precio</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["fijo", "Precio fijo por tonelada"],
              ["indice", "Porcentaje de un índice internacional"],
              ["a_negociar", "A negociar"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setForm({ ...form, priceBasis: val })}
              className={`rounded border px-3 py-1.5 text-sm ${
                form.priceBasis === val
                  ? "border-[hsl(var(--accent-brand))] bg-[hsl(var(--surface))]"
                  : "border-[hsl(var(--hairline))]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>
          Elementos penalizables (define el descuento del comprador; omitirlos hace que la oferta no
          sea evaluable)
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {PENALIZABLES.map((el) => {
            const idx = form.penalizables.findIndex((p) => p.element === el);
            const val = idx >= 0 ? form.penalizables[idx].value : "";
            return (
              <div key={el} className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
                  {el}
                </span>
                <Input
                  type="number"
                  value={val}
                  onChange={(e) => {
                    const next = [...form.penalizables];
                    if (idx >= 0) next[idx] = { element: el, value: e.target.value };
                    else next.push({ element: el, value: e.target.value });
                    setForm({ ...form, penalizables: next });
                  }}
                  className="font-mono"
                  placeholder="—"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label>
          ¿Acepta inspección y muestreo por empresa independiente designada por el comprador?
        </Label>
        <div className="mt-2 flex gap-2">
          {(["si", "no", "depende"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm({ ...form, acceptsInspection: v })}
              className={`rounded border px-3 py-1.5 text-sm capitalize ${
                form.acceptsInspection === v
                  ? "border-[hsl(var(--accent-brand))] bg-[hsl(var(--surface))]"
                  : "border-[hsl(var(--hairline))]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>¿Puedes enviar muestra a laboratorio?</Label>
        <div className="mt-2 flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setForm({ ...form, canSendSample: v })}
              className={`rounded border px-3 py-1.5 text-sm ${
                form.canSendSample === v
                  ? "border-[hsl(var(--accent-brand))] bg-[hsl(var(--surface))]"
                  : "border-[hsl(var(--hairline))]"
              }`}
            >
              {v ? "Sí" : "No"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Paso4({
  form,
  setForm,
  policy,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  policy: { version: string; content_md: string } | null;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl">Consentimiento y envío</h2>
      <p className="text-sm text-[hsl(var(--content-subtle))]">
        Los documentos (certificado de análisis, título/mandato, fotos y estatutos) los subes en tu
        panel después de crear cuenta con este mismo correo. Sin documentos, la oferta no avanza a
        evaluación.
      </p>

      <div className="max-h-56 overflow-y-auto rounded border border-[hsl(var(--hairline))] bg-white p-3 text-xs text-[hsl(var(--content-subtle))] whitespace-pre-wrap">
        <div className="mb-2 font-mono text-[10px] uppercase">
          Política vigente: {policy?.version ?? "—"}
        </div>
        {policy?.content_md ?? "Cargando política…"}
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          className="mt-1"
        />
        <span>
          Acepto la política de privacidad de Geocapitals (versión{" "}
          <span className="font-mono">{policy?.version ?? "—"}</span>) y autorizo el tratamiento de
          mis datos personales para calificación como proveedor bajo la Ley 21.719.
        </span>
      </label>

      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        Recordatorio: Geocapitals nunca solicita pagos ni comisiones para registrar o evaluar tu
        oferta.
      </div>
    </section>
  );
}
