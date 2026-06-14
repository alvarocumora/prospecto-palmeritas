import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "invalid"; reason?: string }
  | { kind: "already" }
  | { kind: "done" }
  | { kind: "error"; message: string };

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "missing_token" });
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState({ kind: "valid" });
        else if (d.reason === "already_unsubscribed") setState({ kind: "already" });
        else setState({ kind: "invalid", reason: d.error });
      })
      .catch((e) => setState({ kind: "error", message: String(e) }));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (d.success) setState({ kind: "done" });
      else if (d.reason === "already_unsubscribed") setState({ kind: "already" });
      else setState({ kind: "error", message: d.error ?? "No se pudo procesar." });
    } catch (e) {
      setState({ kind: "error", message: String(e) });
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-border rounded-lg p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary mb-3">
          Geocapitals · Email
        </p>
        {state.kind === "loading" && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {state.kind === "valid" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Cancelar notificaciones</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Confirmas que ya no deseas recibir más correos de Geocapitals a esta dirección.
            </p>
            <button
              onClick={confirm}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
            >
              Confirmar baja
            </button>
          </>
        )}
        {state.kind === "already" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Ya estabas dado de baja</h1>
            <p className="text-sm text-muted-foreground">
              Esta dirección ya está en nuestra lista de exclusión.
            </p>
          </>
        )}
        {state.kind === "done" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Listo</h1>
            <p className="text-sm text-muted-foreground">
              No recibirás más correos de Geocapitals. Puedes cerrar esta ventana.
            </p>
          </>
        )}
        {state.kind === "invalid" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Enlace no válido</h1>
            <p className="text-sm text-muted-foreground">
              El enlace ya expiró o no es correcto.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Error</h1>
            <p className="text-sm text-destructive">{state.message}</p>
          </>
        )}
      </div>
    </main>
  );
}
