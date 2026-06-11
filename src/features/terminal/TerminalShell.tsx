import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, TerminalTopBar } from "@/components/shell/AppShell";
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
    <AppShell variant="terminal" topBar={<TerminalTopBar />}>
      <TickerTape />
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
    </AppShell>
  );
}
