import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createRfq } from "@/lib/rfqs/rfq.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/rfqs/nuevo")({
  head: () => ({
    meta: [
      { title: "Nuevo RFQ — Geocapitals" },
      {
        name: "description",
        content:
          "Crea una solicitud de cotización (RFQ) minera y publícala a proveedores verificados.",
      },
    ],
  }),
  component: NewRfq,
});

type Product = {
  product_name: string;
  purity: string;
  qty_monthly_mt: string;
  qty_total_mt: string;
  incoterm: string;
  port_destination: string;
  packaging: string;
  target_price_usd: string;
};

const emptyProduct = (): Product => ({
  product_name: "",
  purity: "",
  qty_monthly_mt: "",
  qty_total_mt: "",
  incoterm: "",
  port_destination: "",
  packaging: "",
  target_price_usd: "",
});

function NewRfq() {
  const navigate = useNavigate();
  const create = useServerFn(createRfq);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buyer_name, setBuyerName] = useState("");
  const [buyer_company, setBuyerCompany] = useState("");
  const [destination_country, setCountry] = useState("");
  const [destination_port, setPort] = useState("");
  const [incoterm, setIncoterm] = useState("CIF");
  const [notes, setNotes] = useState("");
  const [is_public, setIsPublic] = useState(true);
  const [products, setProducts] = useState<Product[]>([emptyProduct()]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await create({
        data: {
          buyer_name,
          buyer_company: buyer_company || undefined,
          destination_country: destination_country || undefined,
          destination_port: destination_port || undefined,
          incoterm: incoterm || undefined,
          currency: "USD",
          notes: notes || undefined,
          is_public,
          products: products.map((p) => ({
            product_name: p.product_name,
            purity: p.purity || undefined,
            qty_monthly_mt: p.qty_monthly_mt ? Number(p.qty_monthly_mt) : null,
            qty_total_mt: p.qty_total_mt ? Number(p.qty_total_mt) : null,
            incoterm: p.incoterm || undefined,
            port_destination: p.port_destination || undefined,
            packaging: p.packaging || undefined,
            target_price_usd: p.target_price_usd ? Number(p.target_price_usd) : null,
          })),
        },
      });
      await navigate({ to: "/dashboard/rfqs/$id", params: { id: res.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
          Comprador · Nuevo RFQ
        </div>
        <h1 className="mt-1 font-serif text-3xl">Publica una solicitud de cotización</h1>
        <p className="mt-1 text-sm text-[hsl(var(--content-subtle))]">
          Los datos comerciales sensibles quedan bajo NDA. Los proveedores solo ven el resumen del
          producto y contactan a través de Geocapitals.
        </p>

        <div className="mt-8 space-y-4 rounded border border-[hsl(var(--hairline))] bg-white p-5">
          <h2 className="font-serif text-lg">Datos del comprador</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nombre de contacto *">
              <Input value={buyer_name} onChange={(e) => setBuyerName(e.target.value)} />
            </Field>
            <Field label="Empresa">
              <Input value={buyer_company} onChange={(e) => setBuyerCompany(e.target.value)} />
            </Field>
            <Field label="País destino">
              <Input value={destination_country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
            <Field label="Puerto destino">
              <Input value={destination_port} onChange={(e) => setPort(e.target.value)} />
            </Field>
            <Field label="Incoterm preferido">
              <select
                className="w-full rounded border border-[hsl(var(--hairline))] bg-white px-2 py-2 text-sm"
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
              >
                {["FOB", "CIF", "CFR", "DAP", "EXW"].map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Publicación">
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={is_public}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                Visible en el marketplace público
              </label>
            </Field>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded border border-[hsl(var(--hairline))] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Productos solicitados</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setProducts((p) => [...p, emptyProduct()])}
            >
              <Plus className="mr-1 h-3 w-3" /> Añadir producto
            </Button>
          </div>
          {products.map((p, idx) => (
            <div key={idx} className="rounded border border-[hsl(var(--hairline))] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-[hsl(var(--content-subtle))]">
                  Producto {idx + 1}
                </div>
                {products.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProducts((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Producto *">
                  <Input
                    value={p.product_name}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, product_name: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Ej: Cátodos de cobre grado A"
                  />
                </Field>
                <Field label="Ley / pureza">
                  <Input
                    value={p.purity}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, purity: e.target.value } : x)),
                      )
                    }
                    placeholder="99.99% Cu"
                  />
                </Field>
                <Field label="Empaque">
                  <Input
                    value={p.packaging}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, packaging: e.target.value } : x)),
                      )
                    }
                    placeholder="Bundles 2 t"
                  />
                </Field>
                <Field label="Cantidad mensual (t)">
                  <Input
                    type="number"
                    value={p.qty_monthly_mt}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, qty_monthly_mt: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Cantidad total (t)">
                  <Input
                    type="number"
                    value={p.qty_total_mt}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, qty_total_mt: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Precio objetivo (USD)">
                  <Input
                    type="number"
                    value={p.target_price_usd}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, target_price_usd: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="USD/t"
                  />
                </Field>
                <Field label="Incoterm">
                  <Input
                    value={p.incoterm}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, incoterm: e.target.value } : x)),
                      )
                    }
                    placeholder={incoterm}
                  />
                </Field>
                <Field label="Puerto destino">
                  <Input
                    value={p.port_destination}
                    onChange={(e) =>
                      setProducts((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, port_destination: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded border border-[hsl(var(--hairline))] bg-white p-5">
          <Field label="Notas comerciales">
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condiciones especiales, pagos, plazos, etc."
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={!buyer_name || !products[0]?.product_name || busy} onClick={submit}>
            {busy ? "Publicando…" : "Publicar RFQ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
