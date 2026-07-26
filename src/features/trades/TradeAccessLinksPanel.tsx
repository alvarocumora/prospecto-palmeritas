// Gobernanza de accesos (solo staff GC): muestra los links activos por operación
// vía get_trade_access_links (nunca expone el hash) y permite regenerar/revocar
// reusando ensureCounterpartyLink.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Key, RefreshCw, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureCounterpartyLink } from "@/lib/tradeOps.functions";
import { useIsGcStaff } from "@/hooks/useIsGcStaff";

type Row = { party: "buyer" | "seller"; email: string | null; token_prefix: string | null; active: boolean };

export function TradeAccessLinksPanel({ tradeId }: { tradeId: string }) {
  const { isStaff, loading: staffLoading } = useIsGcStaff();
  const qc = useQueryClient();
  const rotate = useServerFn(ensureCounterpartyLink);
  const [pending, setPending] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<{ party: string; url: string } | null>(null);

  const queryKey = ["trade-access-links", tradeId];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_trade_access_links", {
        p_trade_id: tradeId,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },

    enabled: isStaff,
    staleTime: 15_000,
  });

  if (staffLoading || !isStaff) return null;

  async function rotateLink(party: "buyer" | "seller") {
    setPending(party);
    try {
      const res = await rotate({ data: { tradeId, party, rotate: true } });
      if (res.url) {
        setLastUrl({ party, url: res.url });
        await navigator.clipboard?.writeText(res.url).catch(() => {});
        toast.success(`Nuevo enlace de ${party} generado y copiado al portapapeles.`);
      } else {
        toast.success("Enlace regenerado.");
      }
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo regenerar el enlace.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-md border border-[hsl(var(--im-hairline,var(--border)))] bg-white p-4">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
        <Key className="w-3.5 h-3.5 text-[hsl(var(--im-accent-brand))]" /> Gobernanza de accesos ·
        Staff GC
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando enlaces…</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wider">
              <th className="py-1">Parte</th>
              <th>Email</th>
              <th>Prefijo</th>
              <th>Estado</th>
              <th className="text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.party} className="border-t border-border">
                <td className="py-2 font-medium capitalize">{r.party === "buyer" ? "Comprador" : "Vendedor"}</td>
                <td className="text-muted-foreground">{r.email ?? "—"}</td>
                <td className="font-mono text-[11px]">{r.token_prefix ?? "—"}</td>
                <td>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                      r.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.active ? "Activo" : "Sin enlace"}
                  </span>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => rotateLink(r.party)}
                    disabled={pending === r.party}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {pending === r.party ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {r.active ? "Regenerar" : "Generar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lastUrl && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-[11px]">
          <div className="font-medium text-amber-900 mb-1">
            Nuevo enlace de {lastUrl.party} (visible una sola vez):
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate font-mono">{lastUrl.url}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(lastUrl.url).catch(() => {});
                toast.success("Copiado.");
              }}
              className="p-1 rounded hover:bg-amber-100"
              aria-label="Copiar"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Al regenerar se invalida el enlace anterior. Los tokens se almacenan hasheados; nunca se
        muestra el hash.
      </p>
    </div>
  );
}
