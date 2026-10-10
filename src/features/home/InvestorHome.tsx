import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileSearch, Layers, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getMyInvestmentHistory } from "@/lib/investors.functions";
import { listMyHoldings } from "@/lib/tokenization.functions";

const usd = (value: number) => "USD " + value.toLocaleString("es-CL", { maximumFractionDigits: 0 });
const statusLabels: Record<string, string> = { new: "Interés registrado", nda_signed: "NDA firmado", closed: "Cerrada", pending: "Pendiente", approved: "Aprobado", pending_review: "En revisión", rejected: "Requiere revisión" };

export function InvestorHome({ name, children }: { name: string; children?: ReactNode }) {
  const { user } = useAuth();
  const fetchHistory = useServerFn(getMyInvestmentHistory);
  const fetchHoldings = useServerFn(listMyHoldings);
  const history = useQuery({ queryKey: ["investor-history", user?.id], queryFn: () => fetchHistory(), enabled: !!user, staleTime: 30_000 });
  const holdings = useQuery({ queryKey: ["my-holdings", user?.id], queryFn: () => fetchHoldings(), enabled: !!user, staleTime: 30_000 });
  const data = history.data;
  const inquiries = data?.inquiries ?? [];
  const confirmed = (holdings.data ?? []).filter((holding) => holding.status === "confirmed");
  const latest = inquiries.slice(0, 5);

  return (
    <div data-theme="im-light" className="min-h-full bg-background text-foreground">
      <main className="max-w-7xl mx-auto p-4 md:p-7 pb-20 space-y-6">
        <header className="rounded-2xl bg-slate-950 text-white p-6 md:p-8 space-y-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Geocapitals · Espacio del inversionista</p>
          <div className="flex flex-wrap justify-between gap-5 items-end"><div><h1 className="font-display text-3xl md:text-4xl">Hola{name ? ", " + name : ""}.</h1><p className="text-sm text-white/65 mt-3 max-w-xl">Evalúa oportunidades, revisa documentos y sigue el avance de tus inversiones.</p></div><Link to="/inversionistas" className="inline-flex items-center gap-2 rounded-md bg-white text-slate-950 px-5 py-3 text-sm font-medium">Explorar oportunidades <ArrowRight className="w-4 h-4" /></Link></div>
        </header>
        {children}
        <div className="grid sm:grid-cols-3 gap-4">
          <InvestorMetric icon={<FileSearch className="w-4 h-4" />} title="Oportunidades en evaluación" value={data ? String(inquiries.filter((item) => !item.closed_at).length) : history.isError ? "No disponible" : "…"} description="Solicitudes abiertas; todavía no son inversiones." />
          <InvestorMetric icon={<Wallet className="w-4 h-4" />} title="Pagos registrados" value={data ? usd(data.totals.paidUsd) : history.isError ? "No disponible" : "…"} description="Liquidaciones registradas como pagadas o recibidas." />
          <InvestorMetric icon={<Layers className="w-4 h-4" />} title="Participaciones confirmadas" value={holdings.data ? String(confirmed.length) : holdings.isError ? "No disponible" : "…"} description="Suscripciones confirmadas; consulta sus términos." />
        </div>
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
          <section className="rounded-xl border border-border bg-card">
            <header className="p-5 border-b border-border flex justify-between gap-3"><h2 className="font-display text-xl">Tu seguimiento</h2><Link to="/dashboard/investments" className="text-sm text-primary hover:underline">Ver historial</Link></header>
            {history.isError ? <div role="status" className="p-5 text-sm text-muted-foreground">No pudimos cargar tu historial. <button className="text-primary underline" onClick={() => void history.refetch()}>Reintentar</button></div> : history.isLoading ? <p role="status" className="p-5 text-sm text-muted-foreground">Cargando oportunidades…</p> : latest.length ? (
              <ul className="divide-y divide-border">{latest.map((item) => (
                <li key={item.id} className="p-5 flex flex-wrap justify-between items-center gap-3"><div><Link to="/proyectos/$listingId" params={{ listingId: item.listing_id }} className="font-medium hover:underline">{item.listing?.title ?? "Revisar oportunidad"}</Link><p className="text-xs text-muted-foreground mt-1">{item.listing?.commodity ?? "Minería"} · {item.nda_signed_at ? "NDA firmado" : "NDA pendiente"}</p></div><span className="rounded-full bg-muted px-3 py-1 text-[11px]">{statusLabels[item.status] ?? item.status}</span></li>
              ))}</ul>
            ) : <div className="p-6 space-y-3"><h3 className="font-medium">Comienza por una tesis de inversión</h3><p className="text-sm text-muted-foreground">Revisa etapa, evidencias, uso de fondos y riesgos. Tus solicitudes aparecerán aquí al registrar interés.</p><Link to="/proyectos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Explorar proyectos <ArrowRight className="w-4 h-4" /></Link></div>}
          </section>
          <section className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div><p className="text-[10px] font-mono uppercase text-muted-foreground">Perfil de inversión</p><h2 className="font-display text-xl mt-2">{data?.profile ? statusLabels[data.profile.review_status] ?? data.profile.review_status : history.isError ? "Estado no disponible" : history.isLoading ? "Consultando perfil…" : "Completa tu perfil"}</h2><p className="text-sm text-muted-foreground mt-2">Mantén tus preferencias y antecedentes al día para avanzar en la evaluación de oportunidades.</p></div>
            <div className="border-t border-border pt-4 space-y-3"><Link to="/dashboard/offerings" className="flex items-center justify-between text-sm hover:text-primary">Ofertas y participaciones <ArrowRight className="w-4 h-4" /></Link><Link to="/terminal" className="flex items-center justify-between text-sm hover:text-primary">Terminal de proyectos <ArrowRight className="w-4 h-4" /></Link><Link to="/terminal/market" className="flex items-center justify-between text-sm hover:text-primary">Referencias de mercado <ArrowRight className="w-4 h-4" /></Link></div>
            {holdings.isError && <p role="status" className="text-xs text-muted-foreground">No pudimos consultar las participaciones. <button onClick={() => void holdings.refetch()} className="text-primary underline">Reintentar</button></p>}
          </section>
        </div>
        <section className="grid md:grid-cols-3 gap-4" aria-label="Proceso de inversión">{[{ step: "01", title: "Evaluar el activo", text: "Tesis, derechos, evidencia y riesgos." }, { step: "02", title: "Revisar el expediente", text: "NDA y acceso autorizado por oportunidad." }, { step: "03", title: "Seguir la inversión", text: "Términos, pagos y posiciones confirmadas." }].map((item) => <div key={item.step} className="rounded-xl border border-border p-5"><p className="font-mono text-xs text-primary">{item.step}</p><h2 className="font-medium mt-2">{item.title}</h2><p className="text-sm text-muted-foreground mt-2">{item.text}</p></div>)}</section>
      </main>
    </div>
  );
}

function InvestorMetric({ icon, title, value, description }: { icon: ReactNode; title: string; value: string; description: string }) {
  return <section className="rounded-xl border border-border bg-card p-5"><div className="flex gap-2 text-muted-foreground text-xs items-center">{icon}{title}</div><p className="font-display text-2xl mt-3">{value}</p><p className="text-xs text-muted-foreground mt-2">{description}</p></section>;
}
