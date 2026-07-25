import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOperation } from "@/lib/operations/operations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/dashboard/operaciones/nuevo")({
  head: () => ({
    meta: [{ title: "Nueva operación — Geocapitals Trade Desk" }],
  }),
  component: NewOperation,
});

function NewOperation() {
  const create = useServerFn(createOperation);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    commodity: "",
    subproduct: "",
    quantity_monthly: "",
    quantity_total: "",
    unit: "MT",
    incoterm: "",
    origin_country: "",
    destination_country: "",
    destination_port: "",
    target_price_usd: "",
    duration_months: "",
    priority: "normal",
    buyer_name: "",
    buyer_company: "",
    buyer_email: "",
    buyer_phone: "",
    seller_name: "",
    seller_company: "",
    seller_email: "",
    seller_phone: "",
    tech_spec_json: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      let tech_spec: Record<string, unknown> | undefined;
      if (form.tech_spec_json.trim()) {
        try {
          tech_spec = JSON.parse(form.tech_spec_json);
        } catch {
          throw new Error("Especificación técnica no es JSON válido");
        }
      }
      const r = await create({
        data: {
          name: form.name,
          commodity: form.commodity,
          subproduct: form.subproduct || undefined,
          quantity_monthly: form.quantity_monthly ? Number(form.quantity_monthly) : null,
          quantity_total: form.quantity_total ? Number(form.quantity_total) : null,
          unit: form.unit,
          incoterm: form.incoterm || undefined,
          origin_country: form.origin_country || undefined,
          destination_country: form.destination_country || undefined,
          destination_port: form.destination_port || undefined,
          target_price_usd: form.target_price_usd ? Number(form.target_price_usd) : null,
          duration_months: form.duration_months ? Number(form.duration_months) : null,
          priority: form.priority,
          buyer_name: form.buyer_name || undefined,
          buyer_company: form.buyer_company || undefined,
          buyer_email: form.buyer_email || undefined,
          buyer_phone: form.buyer_phone || undefined,
          seller_name: form.seller_name || undefined,
          seller_company: form.seller_company || undefined,
          seller_email: form.seller_email || undefined,
          seller_phone: form.seller_phone || undefined,
          tech_spec,
        },
      });
      navigate({ to: "/dashboard/operaciones/$id", params: { id: r.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear la operación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-theme="im-light" className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--content-subtle))]">
            Nueva operación
          </div>
          <h1 className="mt-1 font-serif text-3xl">Crear workspace transaccional</h1>
          <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">
            Al confirmar se genera un código único (GC-XXX-####), dos portales privados y sus links seguros para
            comprador y vendedor.
          </p>
        </div>

        <div className="space-y-8 rounded-xl border border-[hsl(var(--hairline))] bg-white p-6">
          <Section title="Información del pedido">
            <Field label="Nombre interno *" value={form.name} onChange={set("name")} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commodity *" value={form.commodity} onChange={set("commodity")} placeholder="Antimony, Copper…" />
              <Field label="Subproducto" value={form.subproduct} onChange={set("subproduct")} placeholder="Concentrate, Cathodes…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cantidad mensual" value={form.quantity_monthly} onChange={set("quantity_monthly")} type="number" />
              <Field label="Cantidad total" value={form.quantity_total} onChange={set("quantity_total")} type="number" />
              <Field label="Unidad" value={form.unit} onChange={set("unit")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Origen" value={form.origin_country} onChange={set("origin_country")} />
              <Field label="Destino país" value={form.destination_country} onChange={set("destination_country")} />
              <Field label="Puerto destino" value={form.destination_port} onChange={set("destination_port")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Incoterm" value={form.incoterm} onChange={set("incoterm")} placeholder="FOB, CIF…" />
              <Field label="Precio objetivo USD" value={form.target_price_usd} onChange={set("target_price_usd")} type="number" />
              <Field label="Duración (meses)" value={form.duration_months} onChange={set("duration_months")} type="number" />
            </div>
            <div>
              <Label className="text-xs">Especificación técnica (JSON opcional)</Label>
              <Textarea
                value={form.tech_spec_json}
                onChange={set("tech_spec_json")}
                placeholder={`{"Sb_pct":58,"As_pct":0.3,"Hg_ppm":30}`}
                className="mt-1 font-mono text-xs"
                rows={4}
              />
            </div>
          </Section>

          <Section title="Comprador">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={form.buyer_name} onChange={set("buyer_name")} />
              <Field label="Empresa" value={form.buyer_company} onChange={set("buyer_company")} />
              <Field label="Email" value={form.buyer_email} onChange={set("buyer_email")} type="email" />
              <Field label="Teléfono" value={form.buyer_phone} onChange={set("buyer_phone")} />
            </div>
            <p className="text-[11px] text-[hsl(var(--content-subtle))]">
              Si registras un email se genera automáticamente un link seguro para el portal del comprador.
            </p>
          </Section>

          <Section title="Vendedor">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre" value={form.seller_name} onChange={set("seller_name")} />
              <Field label="Empresa" value={form.seller_company} onChange={set("seller_company")} />
              <Field label="Email" value={form.seller_email} onChange={set("seller_email")} type="email" />
              <Field label="Teléfono" value={form.seller_phone} onChange={set("seller_phone")} />
            </div>
            <p className="text-[11px] text-[hsl(var(--content-subtle))]">
              Puedes crear la operación sin contraparte y agregarla después.
            </p>
          </Section>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <Button onClick={submit} disabled={saving || !form.name || !form.commodity}>
              {saving ? "Creando…" : "Crear operación"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-lg">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} type={type} className="mt-1" />
    </div>
  );
}
