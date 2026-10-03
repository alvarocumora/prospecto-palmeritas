import { Link } from "@tanstack/react-router";
import { Map, Search, Bell, FileText, LogIn } from "lucide-react";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export function PublicCatastroShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div data-theme="im-light" className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-display text-base font-semibold tracking-tight">
              Geocapitals
            </Link>
            <span className="text-border">/</span>
            <Link
              to="/catastro"
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Catastro
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-1 text-xs font-mono text-muted-foreground">
            <Link
              to="/catastro/mapa"
              className="px-3 py-1.5 rounded hover:bg-accent hover:text-foreground transition-colors flex items-center gap-1.5"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              <Map className="w-3.5 h-3.5" /> Mapa multipaís
            </Link>
            {user && (
              <Link
                to="/catastro/proyecto"
                className="px-3 py-1.5 rounded hover:bg-accent hover:text-foreground transition-colors"
                activeProps={{ className: "text-foreground bg-accent" }}
              >
                Vista proyecto
              </Link>
            )}
            <Link
              to="/catastro/precios"
              className="px-3 py-1.5 rounded hover:bg-accent hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground bg-accent" }}
            >
              Planes
            </Link>
            <Link
              to="/"
              className="px-3 py-1.5 rounded hover:bg-accent hover:text-foreground transition-colors"
            >
              Plataforma completa
            </Link>
          </nav>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/catastro/app/watchlist"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-mono font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" /> Mis monitoreos
              </Link>
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-mono font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Acceder
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-xs font-mono text-muted-foreground grid sm:grid-cols-4 gap-6">
          <div className="sm:col-span-2">
            <div className="text-foreground font-semibold mb-2">Geocapitals · Catastro Chile</div>
            <p className="leading-relaxed">
              Plataforma profesional para operadores mineros. Datos públicos de SERNAGEOMIN
              actualizados diariamente, herramientas de monitoreo y due-diligence.
            </p>
          </div>
          <div>
            <div className="text-foreground font-semibold mb-2">Producto</div>
            <ul className="space-y-1">
              <li>
                <Link to="/catastro/mapa" className="hover:text-foreground">
                  Mapa nacional
                </Link>
              </li>
              <li>
                <Link to="/catastro/precios" className="hover:text-foreground">
                  Planes y precios
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-foreground font-semibold mb-2">Herramientas pro</div>
            <ul className="space-y-1">
              <li className="flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Búsqueda titular / RUT
              </li>
              <li className="flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Monitoreo y alertas
              </li>
              <li className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Reportes PDF / GeoJSON
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 text-[10px] font-mono text-muted-foreground/70">
            Fuente: SERNAGEOMIN · Catastro Minero. Datos referenciales, sin valor legal.
          </div>
        </div>
      </footer>
    </div>
  );
}
