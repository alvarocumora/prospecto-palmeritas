import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell, TerminalTopBar } from "@/components/shell/AppShell";
import { TerminalSidebar } from "./TerminalSidebar";
import { TickerTape } from "./TickerTape";

export function TerminalSectionFrame({ eyebrow, title, description, children }: {
  eyebrow: string; title: string; description: string; children: ReactNode;
}) {
  return (
    <AppShell variant="terminal" topBar={<TerminalTopBar />}>
      <TickerTape />
      <div className="flex flex-1 min-h-0">
        <TerminalSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-5 md:p-8 space-y-7">
            <header className="space-y-3">
              <Link to="/terminal" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Volver al terminal</Link>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
              <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
              <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
            </header>
            <nav aria-label="Secciones del terminal" className="flex flex-wrap gap-2 md:hidden">
              <Link to="/terminal" className="rounded-full border border-border px-3 py-1.5 text-xs">Proyectos</Link>
              <Link to="/terminal/market" className="rounded-full border border-border px-3 py-1.5 text-xs">Mercado</Link>
              <Link to="/terminal/capital-raise" className="rounded-full border border-border px-3 py-1.5 text-xs">Capital</Link>
              <Link to="/terminal/tokenize" className="rounded-full border border-border px-3 py-1.5 text-xs">Participaciones</Link>
            </nav>
            {children}
          </div>
        </main>
      </div>
    </AppShell>
  );
}
