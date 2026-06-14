import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  addToWatchlist,
  listMyWatchlist,
  removeFromWatchlist,
} from "@/lib/catastroWatchlist.functions";

export function WatchlistButton({ code }: { code: string }) {
  const { user, loading } = useAuth();
  const list = useServerFn(listMyWatchlist);
  const add = useServerFn(addToWatchlist);
  const remove = useServerFn(removeFromWatchlist);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["catastro-watchlist"],
    queryFn: () => list({ data: undefined }),
    enabled: !!user,
  });

  const item = data?.items.find((i) => i.concession_code === code);
  const atLimit = data ? data.used >= data.maxWatches && !item : false;

  const addMut = useMutation({
    mutationFn: () => add({ data: { code } }),
    onSuccess: () => {
      toast.success("Concesión agregada al monitoreo");
      qc.invalidateQueries({ queryKey: ["catastro-watchlist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: () => remove({ data: { id: item!.id } }),
    onSuccess: () => {
      toast.success("Eliminada del monitoreo");
      qc.invalidateQueries({ queryKey: ["catastro-watchlist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs font-mono text-muted-foreground"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </button>
    );
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs font-mono hover:bg-accent"
      >
        <Bell className="w-3.5 h-3.5" /> Iniciar sesión para monitorear
      </Link>
    );
  }

  if (atLimit) {
    return (
      <Link
        to="/catastro/precios"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/40 text-xs font-mono text-primary hover:bg-primary/20"
      >
        <Crown className="w-3.5 h-3.5" /> Plan Free al límite — Upgrade Pro
      </Link>
    );
  }

  if (item) {
    return (
      <button
        onClick={() => {
          setBusy(true);
          removeMut.mutate(undefined, { onSettled: () => setBusy(false) });
        }}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/40 text-xs font-mono text-emerald-500 hover:bg-emerald-500/20"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <BellOff className="w-3.5 h-3.5" />
        )}
        Monitoreando · quitar
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        setBusy(true);
        addMut.mutate(undefined, { onSettled: () => setBusy(false) });
      }}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-mono hover:bg-primary/90"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
      Agregar a monitoreo
    </button>
  );
}
