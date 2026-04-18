import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold font-mono text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La ruta solicitada no existe en Trackmin GeoIntel.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Trackmin GeoIntel · Prospecto Palmeras (TRK-ALH-001)" },
      {
        name: "description",
        content:
          "Dashboard de inteligencia geológica para Prospecto Palmeras — exploración Au–Cu epitermal–mesotermal en Alhué, Chile. Operado por Inversiones Bioenergy SpA.",
      },
      { name: "author", content: "Inversiones Bioenergy SpA" },
      { property: "og:title", content: "Trackmin GeoIntel · Prospecto Palmeras (TRK-ALH-001)" },
      {
        property: "og:description",
        content: "Inteligencia geológica para exploración Au–Cu en Alhué, Región Metropolitana, Chile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Trackmin GeoIntel · Prospecto Palmeras (TRK-ALH-001)" },
      { name: "description", content: "Prospecto Insights is a mining intelligence dashboard for active exploration projects." },
      { property: "og:description", content: "Prospecto Insights is a mining intelligence dashboard for active exploration projects." },
      { name: "twitter:description", content: "Prospecto Insights is a mining intelligence dashboard for active exploration projects." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2335f30b-9099-4300-9432-3cea9a056d13/id-preview-db74c1ab--4ff8283c-30b0-4202-a5f2-7e7e000a91a4.lovable.app-1776476805189.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2335f30b-9099-4300-9432-3cea9a056d13/id-preview-db74c1ab--4ff8283c-30b0-4202-a5f2-7e7e000a91a4.lovable.app-1776476805189.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
