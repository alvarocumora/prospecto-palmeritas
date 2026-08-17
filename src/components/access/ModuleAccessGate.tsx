import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldAlert } from "lucide-react";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { denyMessage } from "@/lib/access/workspaceAccess";

/**
 * Gate de contenido: si el usuario no puede entrar a la ruta según el control
 * de acceso maestro, renderiza el motivo en vez del módulo. Complementa el
 * filtrado del rail para que no exista ninguna vía lateral de acceso.
 */
export function ModuleAccessGate({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const access = useWorkspaceAccess();
  if (!access.ready) return <>{children}</>;

  const decision = access.canPath(pathname);
  if (decision.allowed) return <>{children}</>;

  const { title, detail } = denyMessage(decision.reason);
  const isPlan = decision.reason.kind === "plan";

  return (
    <div className="px-4 md:px-6 py-10">
      <div className="max-w-lg mx-auto border border-border bg-bg-panel rounded-[3px] p-6 text-center">
        <div className="w-10 h-10 mx-auto mb-3 inline-flex items-center justify-center rounded-[3px] border border-border bg-bg-elevated text-signal-amber">
          {isPlan ? <Lock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        </div>
        <h1 className="font-mono text-[13px] uppercase tracking-[0.12em]">{title}</h1>
        <p className="mt-2 text-[12px] text-text-dim leading-relaxed">{detail}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/dashboard"
            className="px-3 h-8 inline-flex items-center font-mono text-[11px] border border-border rounded-[2px] hover:bg-bg-elevated"
          >
            Volver al inicio
          </Link>
          {isPlan && (
            <Link
              to="/dashboard/plan"
              className="px-3 h-8 inline-flex items-center font-mono text-[11px] rounded-[2px] bg-signal-cyan/15 text-signal-cyan border border-signal-cyan/40 hover:bg-signal-cyan/25"
            >
              Ver planes
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
