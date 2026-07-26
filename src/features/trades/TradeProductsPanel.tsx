// Productos de la operación: consume get_trade_products (staff/authenticated)
// o el server fn público por token (War Room del seller).
// - Staff GC: puede cambiar status e importar oferta de proveedor.
// - Seller (War Room): puede agregar productos (added_by_role='seller').
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Package, Plus, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import {
  getOperacionProducts,
  addOperacionProduct,
} from "@/lib/tradeOps.functions";

type Row = {
  id: string;
  product_name: string;
  presentation: string | null;
  purity: string | null;
  grade_value: number | null;
  grade_unit: string | null;
  tonnage_total_t: number | null;
  tonnage_monthly_t: number | null;
  packaging: string | null;
  origin_country: string | null;
  origin_region: string | null;
  incoterm: string | null;
  price_usd: number | null;
  price_note: string | null;
  status: string;
  added_by_role: string | null;
  notes: string | null;
  source_supplier_offer_id: string | null;
  source_rfq_product_id: string | null;
  source_submission_id: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  offered: "bg-blue-100 text-blue-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-200 text-gray-700",
};

const STATUS_LABEL: Record<string, string> = {
  offered: "Ofertado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  withdrawn: "Retirado",
};

function sourceChip(r: Row): { label: string; to?: string; params?: any } | null {
  if (r.source_supplier_offer_id)
    return { label: "desde oferta de proveedor" };
  if (r.source_submission_id)
    return { label: "desde propuesta de sourcing", to: "/dashboard/rfqs" };
  if (r.source_rfq_product_id)
    return { label: "desde RFQ" };
  return null;
}

function fmtT(n: number | null) {
  return n != null ? `${Number(n).toLocaleString("es-CL")} t` : "—";
}
function fmtUsd(n: number | null) {
  return n != null ? `US$ ${Math.round(Number(n)).toLocaleString("es-CL")}/t` : "—";
}

export function TradeProductsPanel({
  tradeId,
  mode,
  token,
  canManage,
  canAdd,
}: {
  tradeId?: string;
  mode: "authenticated" | "public";
  token?: string;
  canManage?: boolean;
  canAdd?: boolean;
}) {
  const qc = useQueryClient();
  const addPublic = useServerFn(addOperacionProduct);
  const getPublic = useServerFn(getOperacionProducts);

  const queryKey =
    mode === "public" ? ["trade-products-public", token] : ["trade-products", tradeId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (mode === "public") {
        const res = await getPublic({ data: { token: token! } });
        return (res ?? []) as Row[];
      }
      const { data, error } = await supabase.rpc("get_trade_products", {
        p_trade_id: tradeId!,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
    enabled: mode === "public" ? !!token : !!tradeId,
    staleTime: 15_000,
  });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: "",
    purity: "",
    tonnage_total_t: "",
    incoterm: "",
    price_note: "",
    notes: "",
  });

  async function submitProduct() {
    if (!form.product_name.trim()) {
      toast.error("Nombre de producto es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "public") {
        await addPublic({
          data: {
            token: token!,
            product_name: form.product_name.trim(),
            purity: form.purity.trim() || undefined,
            tonnage_total_t: form.tonnage_total_t
              ? Number(form.tonnage_total_t)
              : undefined,
            incoterm: form.incoterm.trim() || undefined,
            price_note: form.price_note.trim() || undefined,
            notes: form.notes.trim() || undefined,
          },
        });
      } else {
        const { error } = await supabase.from("trade_products").insert({
          trade_id: tradeId,
          product_name: form.product_name.trim(),
          purity: form.purity.trim() || null,
          tonnage_total_t: form.tonnage_total_t ? Number(form.tonnage_total_t) : null,
          incoterm: form.incoterm.trim() || null,
          price_note: form.price_note.trim() || null,
          notes: form.notes.trim() || null,
          added_by_role: "seller",
          status: "offered",
        });
        if (error) throw new Error(error.message);
      }
      toast.success("Producto agregado.");
      setForm({
        product_name: "",
        purity: "",
        tonnage_total_t: "",
        incoterm: "",
        price_note: "",
        notes: "",
      });
      setShowForm(false);
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo agregar el producto.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("trade_products")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Producto marcado como ${STATUS_LABEL[status] ?? status}.`);
    await qc.invalidateQueries({ queryKey });
  }

  return (
    <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Package className="w-3.5 h-3.5 text-[hsl(var(--im-accent-brand))]" /> Productos de la
          operación · {rows.length}
        </div>
        {canAdd && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="px-2.5 py-1 rounded border border-border text-[11px] hover:bg-accent inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> {showForm ? "Cerrar" : "Agregar producto"}
          </button>
        )}
      </div>

      {showForm && canAdd && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded">
          <input
            className="border rounded px-2 py-1"
            placeholder="Nombre del producto *"
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Calidad / ley (ej. Grade A)"
            value={form.purity}
            onChange={(e) => setForm({ ...form, purity: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1"
            type="number"
            placeholder="Tonelaje total (t)"
            value={form.tonnage_total_t}
            onChange={(e) => setForm({ ...form, tonnage_total_t: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1"
            placeholder="Incoterm (CIF, FOB…)"
            value={form.incoterm}
            onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
          />
          <input
            className="border rounded px-2 py-1 md:col-span-2"
            placeholder="Precio (nota, ej. LME - 5%)"
            value={form.price_note}
            onChange={(e) => setForm({ ...form, price_note: e.target.value })}
          />
          <textarea
            className="border rounded px-2 py-1 md:col-span-2"
            rows={2}
            placeholder="Notas / specs"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button
            type="button"
            disabled={saving}
            onClick={submitProduct}
            className="md:col-span-2 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />} Guardar producto
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando productos…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay productos declarados en esta operación.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const chip = sourceChip(r);
            return (
              <div
                key={r.id}
                className="border border-border rounded p-3 text-xs bg-white"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{r.product_name}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {[
                        r.purity ?? (r.grade_value != null ? `${r.grade_value}${r.grade_unit ?? ""}` : null),
                        fmtT(r.tonnage_total_t),
                        r.incoterm,
                        r.origin_country,
                        r.packaging,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {(r.price_usd != null || r.price_note) && (
                      <div className="text-muted-foreground mt-0.5">
                        Precio: {r.price_note ?? fmtUsd(r.price_usd)}
                      </div>
                    )}
                    {r.notes && (
                      <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                        {r.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {chip && (
                      chip.to ? (
                        <Link
                          to={chip.to}
                          className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          {chip.label} <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{chip.label}</span>
                      )
                    )}
                    {r.added_by_role && (
                      <span className="text-[10px] text-muted-foreground">
                        origen: {r.added_by_role}
                      </span>
                    )}
                  </div>
                </div>
                {canManage && mode === "authenticated" && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {(["accepted", "rejected", "withdrawn", "offered"] as const)
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(r.id, s)}
                          className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
                        >
                          Marcar {STATUS_LABEL[s]}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
