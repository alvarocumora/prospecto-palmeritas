// Precios y productos de la operación — staff / dueño del trade.
// El precio de venta es el único público (ficha); el precio base es interno.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tag, Plus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Pricing = {
  id?: string;
  unit: string | null;
  base_price: number | null;
  sale_price: number | null;
  currency: string | null;
  qty_per_order: number | null;
  extra_pool_per_order: number | null;
  order_frequency: string | null;
  contract_months: number | null;
};

type Product = {
  id: string;
  product_name: string | null;
  presentation: string | null;
  purity: string | null;
  packaging: string | null;
  origin_country: string | null;
  origin_region: string | null;
  incoterm: string | null;
};

const input = "rounded border border-border px-2 py-1.5 text-xs w-full";

export function TradePricingPanel({ tradeId }: { tradeId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [p, setP] = useState<Pricing>({
    unit: "g",
    base_price: null,
    sale_price: null,
    currency: "CLP",
    qty_per_order: null,
    extra_pool_per_order: null,
    order_frequency: "monthly",
    contract_months: null,
  });
  const [prod, setProd] = useState({
    product_name: "",
    presentation: "",
    purity: "",
    packaging: "",
    origin_region: "",
    origin_country: "Chile",
    incoterm: "FOB",
  });

  const pricingQ = useQuery({
    queryKey: ["trade-pricing", tradeId],
    queryFn: async (): Promise<Pricing | null> => {
      const { data, error } = await supabase
        .from("trade_pricing" as never)
        .select("*")
        .eq("trade_id", tradeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Pricing | null;
    },
  });

  const productsQ = useQuery({
    queryKey: ["trade-products", tradeId],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("trade_products" as never)
        .select("id, product_name, presentation, purity, packaging, origin_country, origin_region, incoterm")
        .eq("trade_id", tradeId)
        .order("product_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Product[];
    },
  });

  useEffect(() => {
    if (pricingQ.data) setP(pricingQ.data);
  }, [pricingQ.data]);

  const num = (v: number | null) => (v == null ? "" : String(v));
  const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

  const savePricing = async () => {
    setSaving(true);
    const payload = {
      trade_id: tradeId,
      unit: p.unit,
      base_price: p.base_price,
      sale_price: p.sale_price,
      currency: p.currency,
      qty_per_order: p.qty_per_order,
      extra_pool_per_order: p.extra_pool_per_order,
      order_frequency: p.order_frequency,
      contract_months: p.contract_months,
    };
    const { error } = pricingQ.data?.id
      ? await supabase.from("trade_pricing" as never).update(payload as never).eq("trade_id", tradeId)
      : await supabase.from("trade_pricing" as never).insert(payload as never);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Precios guardados.");
    void qc.invalidateQueries({ queryKey: ["trade-pricing", tradeId] });
    void qc.invalidateQueries({ queryKey: ["trade-margin-split", tradeId] });
  };

  const addProduct = async () => {
    if (!prod.product_name.trim()) {
      toast.error("Indica el nombre del producto.");
      return;
    }
    const { error } = await supabase.from("trade_products" as never).insert({
      trade_id: tradeId,
      ...prod,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProd({ ...prod, product_name: "", presentation: "", purity: "", packaging: "" });
    setShowProduct(false);
    void qc.invalidateQueries({ queryKey: ["trade-products", tradeId] });
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from("trade_products" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["trade-products", tradeId] });
  };

  return (
    <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4">
      <h3 className="text-sm font-semibold inline-flex items-center gap-2">
        <Tag className="h-4 w-4" /> Precios y productos
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          el precio base es interno
        </span>
      </h3>

      {pricingQ.isLoading ? (
        <p className="mt-3 text-xs text-neutral-500 inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </p>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Unidad
            <input className={input} value={p.unit ?? ""} onChange={(e) => setP({ ...p, unit: e.target.value })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Moneda
            <input className={input} value={p.currency ?? ""} onChange={(e) => setP({ ...p, currency: e.target.value })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Precio base (interno)
            <input className={input} inputMode="decimal" value={num(p.base_price)} onChange={(e) => setP({ ...p, base_price: toNum(e.target.value) })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Precio de venta (público)
            <input className={input} inputMode="decimal" value={num(p.sale_price)} onChange={(e) => setP({ ...p, sale_price: toNum(e.target.value) })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Cantidad por pedido
            <input className={input} inputMode="decimal" value={num(p.qty_per_order)} onChange={(e) => setP({ ...p, qty_per_order: toNum(e.target.value) })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Pool extra por pedido
            <input className={input} inputMode="decimal" value={num(p.extra_pool_per_order)} onChange={(e) => setP({ ...p, extra_pool_per_order: toNum(e.target.value) })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Frecuencia
            <input className={input} value={p.order_frequency ?? ""} onChange={(e) => setP({ ...p, order_frequency: e.target.value })} />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Meses de contrato
            <input className={input} inputMode="numeric" value={num(p.contract_months)} onChange={(e) => setP({ ...p, contract_months: toNum(e.target.value) })} />
          </label>
          <div className="md:col-span-4">
            <button
              type="button"
              onClick={() => void savePricing()}
              disabled={saving}
              className="rounded bg-[#1B3FAE] px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar precios"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <h4 className="text-xs font-semibold">Productos de la operación</h4>
        <button
          type="button"
          onClick={() => setShowProduct((s) => !s)}
          className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Producto
        </button>
      </div>

      <ul className="mt-2 divide-y divide-neutral-200 text-xs">
        {(productsQ.data ?? []).map((pr) => (
          <li key={pr.id} className="py-1.5 flex items-center justify-between gap-2">
            <span>
              <strong>{pr.product_name}</strong>
              {pr.presentation ? ` · ${pr.presentation}` : ""}
              {pr.purity ? ` · ${pr.purity}` : ""}
              {pr.origin_region || pr.origin_country
                ? ` · ${[pr.origin_region, pr.origin_country].filter(Boolean).join(", ")}`
                : ""}
              {pr.incoterm ? ` · ${pr.incoterm}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void removeProduct(pr.id)}
              className="text-neutral-400 hover:text-red-600"
              aria-label="Eliminar producto"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
        {(productsQ.data ?? []).length === 0 ? (
          <li className="py-2 text-neutral-500">Sin productos cargados.</li>
        ) : null}
      </ul>

      {showProduct ? (
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {(
            [
              ["product_name", "Producto"],
              ["presentation", "Presentación"],
              ["purity", "Pureza / ley"],
              ["packaging", "Empaque"],
              ["origin_region", "Región"],
              ["origin_country", "País"],
              ["incoterm", "Incoterm"],
            ] as Array<[keyof typeof prod, string]>
          ).map(([k, label]) => (
            <input
              key={k}
              className={input}
              placeholder={label}
              value={prod[k]}
              onChange={(e) => setProd({ ...prod, [k]: e.target.value })}
            />
          ))}
          <button
            type="button"
            onClick={() => void addProduct()}
            className="rounded bg-[#1B3FAE] px-3 py-1.5 text-xs text-white"
          >
            Agregar
          </button>
        </div>
      ) : null}
    </div>
  );
}
