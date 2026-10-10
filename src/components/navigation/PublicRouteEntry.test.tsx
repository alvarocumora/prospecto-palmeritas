import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { PublicRouteEntry } from "./PublicRouteEntry";

afterEach(cleanup);

async function publicRouter(
  path: string,
  landingPath: "/proyectos" | "/terminal",
  childPath: string,
) {
  const root = createRootRoute({ component: Outlet });
  const landing = createRoute({
    getParentRoute: () => root,
    path: landingPath,
    component: () => (
      <PublicRouteEntry path={landingPath}>
        <h1>Catálogo principal</h1>
      </PublicRouteEntry>
    ),
  });
  const child = createRoute({
    getParentRoute: () => landing,
    path: childPath,
    component: () => <h1>Detalle solicitado</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([landing.addChildren([child])]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("public landing routes", () => {
  it("renders a listing detail directly instead of its catalogue", async () => {
    await publicRouter("/proyectos/listing-1?simulationAmount=50000", "/proyectos", "$listingId");
    expect(await screen.findByRole("heading", { name: "Detalle solicitado" })).toBeInTheDocument();
    expect(screen.queryByText("Catálogo principal")).not.toBeInTheDocument();
  });
  it.each(["market", "tokenize", "capital-raise"])(
    "renders the terminal %s child",
    async (section) => {
      await publicRouter("/terminal/" + section, "/terminal", section);
      expect(
        await screen.findByRole("heading", { name: "Detalle solicitado" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Catálogo principal")).not.toBeInTheDocument();
    },
  );
  it("keeps the landing page reachable with a trailing slash", async () => {
    await publicRouter("/proyectos/", "/proyectos", "$listingId");
    expect(await screen.findByRole("heading", { name: "Catálogo principal" })).toBeInTheDocument();
  });
});
