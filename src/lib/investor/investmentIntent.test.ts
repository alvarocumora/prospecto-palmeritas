import { describe, expect, it } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  parseSearchWith,
} from "@tanstack/react-router";
import {
  collateralSearch,
  equityAmount,
  equitySearch,
  investmentHref,
  safeAuthNext,
} from "./investmentIntent";

const parseSearch = parseSearchWith(JSON.parse);

describe("retorno de la simulación después de autenticarse", () => {
  it("conserva Cholqui y USD 15.000 al navegar al destino de auth", async () => {
    const checkout = investmentHref("/terminal/cholqui", equitySearch(15_000));
    const auth = investmentHref("/auth", { intent: "investor", next: checkout });
    const root = createRootRoute();
    const authRoute = createRoute({
      getParentRoute: () => root,
      path: "/auth",
      validateSearch: (search: Record<string, unknown>) => ({
        next: typeof search.next === "string" ? search.next : undefined,
      }),
    });
    const terminalRoute = createRoute({
      getParentRoute: () => root,
      path: "/terminal/$slug",
      validateSearch: (search: Record<string, unknown>) => ({
        tab: search.tab,
        amount: equityAmount(search),
      }),
    });
    const router = createRouter({
      routeTree: root.addChildren([authRoute, terminalRoute]),
      history: createMemoryHistory({ initialEntries: [auth] }),
    });
    await router.load();
    const { next } = router.state.location.search as Record<string, unknown>;
    await router.navigate({
      href: safeAuthNext(typeof next === "string" ? next : undefined),
      replace: true,
    });
    expect(router.state.location.pathname).toBe("/terminal/cholqui");
    expect(router.state.matches.at(-1)?.search).toMatchObject({ tab: "simulador", amount: 15_000 });
  });

  it("conserva monto CLP, plazo e instrumento del colateral publicado", () => {
    const checkout = investmentHref("/inversion-colateral", collateralSearch(15_000_000, 24));
    const target = new URL(safeAuthNext(checkout), "https://geocapitals.com");
    expect(parseSearch(target.search)).toEqual(collateralSearch(15_000_000, 24));
    expect(equityAmount(parseSearch(target.search))).toBeUndefined();
  });

  it.each(["//example.com", "/\\example.com", "/\texample.com", "https://example.com"])(
    "descarta el destino externo %j",
    (target) => expect(safeAuthNext(target)).toBe("/dashboard"),
  );
  it.each(["/auth?next=%2Fdashboard", "/auth/", "/terminal/../auth"])(
    "evita volver a la pantalla de acceso desde %j",
    (target) => expect(safeAuthNext(target)).toBe("/dashboard"),
  );
});
