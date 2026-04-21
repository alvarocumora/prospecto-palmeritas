import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useUnreadCatastroAlerts } from "@/hooks/useUnreadCatastroAlerts";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { StatusDot } from "./StatusDot";
import { Link } from "@tanstack/react-router";

export function StatusBar() {
  const { user } = useAuth();
  const { active } = useProjects();
  const { total: alerts } = useUnreadCatastroAlerts(active?.id ?? null);
  const online = useOnlineStatus();
  const [latency, setLatency] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const t0 = performance.now();
      try {
        await fetch("/favicon.ico", { cache: "no-store" });
        if (!cancelled) setLatency(Math.round(performance.now() - t0));
      } catch {
        if (!cancelled) setLatency(null);
      }
    };
    ping();
    const i = setInterval(ping, 15000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  if (!user) return null;
  const time = now.toLocaleTimeString("es-CL", { hour12: false });

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-30 h-6 border-t border-border bg-bg-panel/95 backdrop-blur flex items-center px-2 gap-3 font-mono text-[10px] text-text-mono select-none"
      role="status"
      aria-live="polite"
    >
      <StatusDot status={online ? "live" : "crit"} pulse={online} label={online ? "LIVE" : "OFFLINE"} />
      <span className="text-text-dim">|</span>
      {active ? (
        <Link to="/dashboard/projects" className="hover:text-signal-cyan transition-colors uppercase tracking-wider">
          {active.code}
        </Link>
      ) : (
        <span className="text-text-dim uppercase tracking-wider">NO PROJECT</span>
      )}
      <span className="text-text-dim">|</span>
      <Link to="/dashboard/boletin" className="hover:text-signal-amber transition-colors flex items-center gap-1">
        {alerts > 0 && <StatusDot status="warn" />}
        <span className="tabular-nums">{alerts}</span>
        <span className="text-text-dim uppercase tracking-wider">alerts</span>
      </Link>
      <span className="hidden sm:inline text-text-dim">|</span>
      <Link to="/dashboard/approvals" className="hidden sm:inline hover:text-signal-cyan transition-colors uppercase tracking-wider text-text-dim">
        approvals
      </Link>
      <div className="flex-1" />
      <span className="hidden md:inline text-text-dim tabular-nums">
        {latency != null ? `${latency}ms` : "—"}
      </span>
      <span className="hidden md:inline text-text-dim">|</span>
      <kbd className="hidden md:inline text-text-dim border border-border px-1 rounded-[2px]">⌘K</kbd>
      <span className="text-text-dim">|</span>
      <span className="tabular-nums text-text-mono">{time}</span>
    </footer>
  );
}
