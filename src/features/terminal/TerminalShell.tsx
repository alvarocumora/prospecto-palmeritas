import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { TerminalSidebar } from "./TerminalSidebar";
import { TickerTape } from "./TickerTape";
import { GeologicalMapPanel } from "./panels/GeologicalMapPanel";
import { PortfolioPanel } from "./panels/PortfolioPanel";
import { getTerminalPortfolio } from "@/lib/terminal.functions";

export function TerminalShell() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fetchPortfolio = useServerFn(getTerminalPortfolio);

  const { data, isLoading } = useQuery({
    queryKey: ["terminal-portfolio", user?.id ?? "anon"],
    queryFn: () => fetchPortfolio(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const projects = data?.projects ?? [];

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top utility bar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-4 bg-card/40">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gold">
          Geocapitals Terminal
        </span>
        <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
          Mining Investment Desk · CL
        </span>
        <div className="flex-1" />
        {user ? (
          <Link
            to="/dashboard"
            className="text-[11px] font-mono text-muted-foreground hover:text-foreground"
          >
            Workspace →
          </Link>
        ) : (
          <Link
            to="/auth"
            className="text-[11px] font-mono px-2 py-1 rounded bg-gold text-background hover:bg-gold-light"
          >
            Sign in
          </Link>
        )}
      </div>

      <TickerTape />

      {/* Body: sidebar + grid */}
      <div className="flex-1 flex min-h-0">
        <TerminalSidebar />
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] min-h-0">
          <section className="border-b lg:border-b-0 lg:border-r border-border min-h-[50vh] lg:min-h-0">
            <GeologicalMapPanel
              projects={projects}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>
          <section id="portfolio" className="min-h-[40vh] lg:min-h-0 overflow-hidden">
            <PortfolioPanel
              projects={projects}
              loading={isLoading}
              authed={!!user}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
