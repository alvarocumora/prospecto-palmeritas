import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terminal/tokenize")({
  head: () => ({ meta: [{ title: "Tokenize · Geocapitals Terminal" }] }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-3 gap-3 bg-card/40">
        <Link to="/" className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Terminal
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold">Tokenize</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Próximamente</p>
          <h1 className="text-2xl font-semibold">Tokenización de activos mineros</h1>
          <p className="text-sm text-muted-foreground">
            Emite participaciones fraccionadas sobre proyectos NI 43-101 con contratos inteligentes auditables.
          </p>
        </div>
      </div>
    </div>
  ),
});
