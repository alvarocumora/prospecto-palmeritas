import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// La vista proyecto vive ahora dentro del catastro único (/catastro/mapa?vista=proyecto).
// Las subrutas (p. ej. titulares/$id) siguen funcionando bajo este layout.
export const Route = createFileRoute("/catastro/proyecto")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/$/, "") === "/catastro/proyecto") {
      throw redirect({ to: "/catastro/mapa", search: { vista: "proyecto" }, statusCode: 301 });
    }
  },
  head: () => ({
    meta: [
      { title: "Catastro · vista proyecto — Geocapitals" },
      { name: "description", content: "Concesiones, titulares y vigilancia de tu proyecto minero." },
    ],
  }),
  component: Outlet,
});
