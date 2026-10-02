import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { LocaleProvider } from "@/features/marketing/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { queryClient } from "@/lib/queryClient";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold font-mono text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La ruta solicitada no existe en Geocapitals.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
          <Link
            to="/catastro"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary"
          >
            Explorar catastro minero
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0a09" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Geocapitals" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Geocapitals · Plataforma para exploración minera moderna" },
      {
        name: "description",
        content:
          "Geocapitals reúne catastro minero, campañas geofísicas, sondajes y muestreo en una plataforma limpia y rápida diseñada por geólogos.",
      },
      { name: "author", content: "Geocapitals" },
      { property: "og:title", content: "Geocapitals · Exploración minera moderna" },
      {
        property: "og:description",
        content:
          "Catastro, geofísica, sondajes y muestreo en una sola plataforma para geólogos profesionales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Geocapitals · Exploración minera moderna" },
      {
        name: "twitter:description",
        content: "Catastro, geofísica, sondajes y muestreo en una sola plataforma.",
      },
      // og:image intentionally omitted at root so leaf routes can define their own,
      // and hosting injects the project preview as fallback.
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap",
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
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host === "localhost" ||
      host === "127.0.0.1";

    if (inIframe || isPreviewHost) {
      // Never register SW inside the editor preview / iframes — unregister any leftovers.
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => {
          rs.forEach((r) => r.unregister().catch(() => {}));
        })
        .catch(() => {});
      return;
    }

    // Production: register kill-switch-friendly SW
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <CurrencyProvider>
            <Outlet />
            <Toaster />
          </CurrencyProvider>
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
