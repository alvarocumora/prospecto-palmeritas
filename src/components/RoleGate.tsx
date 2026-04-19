import type { ReactNode } from "react";
import { useProjectRole, type ProjectRole } from "@/hooks/useProjectRole";
import { Lock } from "lucide-react";

type Props = {
  roles: ProjectRole[];
  children: ReactNode;
  /** If true, render disabled with tooltip instead of hiding. */
  disableInsteadOfHide?: boolean;
  fallback?: ReactNode;
};

/** Conditionally render children based on the user's role on the active project. */
export function RoleGate({ roles, children, disableInsteadOfHide, fallback = null }: Props) {
  const role = useProjectRole();
  const allowed = role ? roles.includes(role) : false;

  if (allowed) return <>{children}</>;

  if (disableInsteadOfHide) {
    return (
      <div
        className="opacity-50 pointer-events-none relative inline-flex items-center gap-1"
        title={`Requiere rol: ${roles.join(" o ")}`}
      >
        <Lock className="w-3 h-3 absolute -top-1 -right-1 text-muted-foreground" />
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
}
