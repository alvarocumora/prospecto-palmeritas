import type { ReactNode } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

/** A public landing page must yield to its matched child route. */
export function PublicRouteEntry({ path, children }: { path: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/$/, "") === path ? children : <Outlet />;
}
