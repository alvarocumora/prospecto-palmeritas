// Panel interno de margen y reparto de comisiones — SOLO staff GeoCapitals.
// El precio de venta es público (ficha); base, margen y reparto son internos.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Plus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

type Split = {
  id?: string;
  name: string;
  beneficiary_type?: string;
  share_kind?: string;
  share_value?: number;
  amount: number;
};

type MarginResult = {
  currency?: string | null;
  unit?: string | null;
  qty?: number | null;
  order_value?: number | null;
  seller_cost?: number | null;
  margin?: number | null;
  extra_pool?: number | null;
  distributable?: number | null;
  distributed?: number | null;
  remaining?: number | null;
  distribution?: Split[] | null;
};

const SHARE_KINDS = [
  { v: "fixed_per_order", l: "Monto fijo por pedido" },
  { v: "pct_of_margin", l: "% del margen" },
  { v: "per_unit", l: "Por unidad" },
];

function fmt(n: number | null | undefined, currency?: string | null) {
  if (n == null) return "—";
  const cur = currency === "USD" ? "US$" : "$";
  return `${cur} ${Math.round(n).toLocaleString("es-CL")}`;
}

export function TradeMarginPanel({ tradeId }: { tradeId: string }) {
  const { isAdmin, loading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "operator",
    kind: "fixed_per_order",
    value: "",
  });

  const q = useQuery({
    queryKey: ["trade-margin-split", tradeId],
    enabled: isAdmin && !!tradeId,
    staleTime: 15_000,
    queryFn: async (): Promise<MarginResult | null> => {
      const { data, error } = await (
        supabase.rpc as never as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>
      )("get_trade_margin_split", {
        p_trade_id: tradeId,
      });
      if (error) throw new Error(error.message);
      return (data ?? null) as MarginResult | null;
    },
  });

  if (loading || !isAdmin) return null;

  const r = q.data;
  const currency = r?.currency ?? "CLP";

  const addSplit = async () => {
    const value = Number(form.value);
    if (!form.name.trim() || !Number.isFinite(value)) {
      toast.error("Ingresa beneficiario y valor.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("trade_commission_splits" as never).insert({
      trade_id: tradeId,
      beneficiary_type: form.type,
      beneficiary_name: form.name.trim(),
      share_kind: form.kind,
      share_value: value,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm({ name: "", type: "operator", kind: "fixed_per_order", value: "" });
    setShowForm(false);
    toast.success("Beneficiario agregado.");
    void qc.invalidateQueries({ queryKey: ["trade-margin-split", tradeId] });
  };

  const removeSplit = async (id?: string) => {
    if (!id) return;
    const { error } = await supabase
      .from("trade_commission_splits" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["trade-margin-split", tradeId] });
  };

  return (
    <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <Coins className="h-4 w-4" /> Margen y reparto{" "}
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">interno</span>
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-[11px] px-2.5 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Beneficiario
        </button>
      </div>

      {q.isLoading ? (
        <p className="mt-3 text-xs text-neutral-500 inline-flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
        </p>
      ) : !r ? (
        <p className="mt-3 text-xs text-neutral-500">
          Sin precios cargados para esta operación (base / venta / cantidad por pedido).
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              ["Valor del pedido", r.order_value],
              ["Costo vendedor", r.seller_cost],
              ["Margen", r.margin],
              ["Pool extra", r.extra_pool],
              ["Distribuible", r.distributable],
              ["Distribuido", r.distributed],
              ["Remanente", r.remaining],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded border border-neutral-200 p-2">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {String(label)}
                </p>
                <p className="font-medium">{fmt(val as number | null, currency)}</p>
              </div>
            ))}
          </div>

          <table className="mt-4 w-full text-xs">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1">Beneficiario</th>
                <th className="py-1">Regla</th>
                <th className="py-1 text-right">Monto</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(r.distribution ?? []).map((d, i) => (
                <tr key={d.id ?? i} className="border-t border-neutral-200">
                  <td className="py-1.5">{d.name}</td>
                  <td className="py-1.5 text-neutral-600">
                    {SHARE_KINDS.find((k) => k.v === d.share_kind)?.l ?? d.share_kind} ·{" "}
                    {d.share_value}
                  </td>
                  <td className="py-1.5 text-right font-medium">{fmt(d.amount, currency)}</td>
                  <td className="py-1.5 text-right">
                    {d.id ? (
                      <button
                        type="button"
                        onClick={() => void removeSplit(d.id)}
                        className="text-neutral-400 hover:text-red-600"
                        aria-label="Eliminar beneficiario"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {(r.distribution ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2 text-neutral-500">
                    Sin beneficiarios configurados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      )}

      {showForm ? (
        <div className="mt-4 grid gap-2 md:grid-cols-4 text-xs">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Beneficiario"
            className="rounded border border-border px-2 py-1.5"
          />
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="rounded border border-border px-2 py-1.5"
          >
            <option value="operator">Operador</option>
            <option value="internal_pool">Pool interno</option>
            <option value="broker">Broker</option>
          </select>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
            className="rounded border border-border px-2 py-1.5"
          >
            {SHARE_KINDS.map((k) => (
              <option key={k.v} value={k.v}>
                {k.l}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Valor"
              inputMode="decimal"
              className="w-full rounded border border-border px-2 py-1.5"
            />
            <button
              type="button"
              onClick={() => void addSplit()}
              disabled={saving}
              className="rounded bg-[#1B3FAE] px-3 py-1.5 text-white disabled:opacity-50"
            >
              {saving ? "…" : "Agregar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
