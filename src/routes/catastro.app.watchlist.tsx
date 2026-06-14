import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Trash2, MapPin, Crown, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyAlerts,
  listMyWatchlist,
  markAlertRead,
  removeFromWatchlist,
} from "@/lib/catastroWatchlist.functions";

export const Route = createFileRoute("/catastro/app/watchlist")({
  head: () => ({
    meta: [
      { title: "Monitoreo de concesiones · Catastro Chile" },
      { name: "description", content: "Tus concesiones mineras monitoreadas y alertas recientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: WatchlistPage,
});

function WatchlistPage() {
  const list = useServerFn(listMyWatchlist);
  const alerts = useServerFn(listMyAlerts);
  const remove = useServerFn(removeFromWatchlist);
  const markRead = useServerFn(markAlertRead);
  const qc = useQueryClient();

  const wl = useQuery({
    queryKey: ["catastro-watchlist"],
    queryFn: () => list({ data: undefined }),
  });
  const al = useQuery({
    queryKey: ["catastro-alerts"],
    queryFn: () => alerts({ data: undefined }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Eliminada");
      qc.invalidateQueries({ queryKey: ["catastro-watchlist"] });
    },
  });
  const readMut = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catastro-alerts"] }),
  });

  return (
    <PublicCatastroShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">Monitoreo</h1>
            <p className="text-xs font-mono text-muted-foreground">
              Concesiones que sigues y alertas de cambios en SERNAGEOMIN.
            </p>
          </div>
          {wl.data && (
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Plan</div>
              <div className="text-sm font-semibold capitalize">{wl.data.plan}</div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {wl.data.used} / {wl.data.maxWatches === 99999 ? "∞" : wl.data.maxWatches}
              </div>
            </div>
          )}
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Concesiones monitoreadas
          </h2>
          {wl.isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !wl.data?.items.length ? (
            <div className="border border-dashed border-border rounded-md p-8 text-center text-xs font-mono text-muted-foreground">
              No monitoreas ninguna concesión todavía.{" "}
              <Link to="/catastro/mapa" className="text-primary underline">
                Buscar en el mapa
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {wl.data.items.map((item) => {
                const c = wl.data.concessions[item.concession_code];
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded-md p-4 bg-bg-secondary/20"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">
                          {item.concession_code}
                        </div>
                        <div className="text-sm font-semibold truncate">
                          {c?.name ?? item.concession_code}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c?.holder ?? "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => removeMut.mutate(item.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c?.commune ?? c?.region ?? "—"}
                      </span>
                      <Link
                        to="/catastro/c/$code"
                        params={{ code: item.concession_code }}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Ficha <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {wl.data && wl.data.plan === "free" && (
            <Link
              to="/catastro/precios"
              className="mt-4 inline-flex items-center gap-2 text-xs font-mono text-primary hover:underline"
            >
              <Crown className="w-3.5 h-3.5" /> Aumentar a 50 concesiones con Pro
            </Link>
          )}
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" /> Alertas recientes
          </h2>
          {al.isLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !al.data?.alerts.length ? (
            <div className="border border-dashed border-border rounded-md p-6 text-center text-xs font-mono text-muted-foreground">
              Sin alertas. Te notificaremos cuando detectemos cambios en tus concesiones
              monitoreadas.
            </div>
          ) : (
            <ul className="space-y-2">
              {al.data.alerts.map((a) => (
                <li
                  key={a.id}
                  className={`border rounded-md p-3 flex items-start gap-3 ${
                    a.read_at
                      ? "border-border bg-bg-secondary/10 opacity-70"
                      : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      a.severity === "critical"
                        ? "text-destructive"
                        : a.severity === "warning"
                          ? "text-amber-500"
                          : "text-primary"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.message && (
                      <div className="text-xs text-muted-foreground mt-0.5">{a.message}</div>
                    )}
                    <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {a.concession_code} · {new Date(a.created_at).toLocaleString("es-CL")}
                    </div>
                  </div>
                  {!a.read_at && (
                    <button
                      onClick={() => readMut.mutate(a.id)}
                      className="text-[10px] font-mono text-primary hover:underline"
                    >
                      Marcar leída
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PublicCatastroShell>
  );
}
