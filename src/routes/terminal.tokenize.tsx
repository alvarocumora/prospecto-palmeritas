import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Files, PieChart, ShieldCheck } from "lucide-react";
import { TerminalSectionFrame } from "@/features/terminal/TerminalSectionFrame";

export const Route = createFileRoute("/terminal/tokenize")({
  head: () => ({ meta: [{ title: "Participaciones · Geocapitals" }] }),
  component: ParticipationsPage,
});

function ParticipationsPage() {
  return (
    <TerminalSectionFrame eyebrow="Capital & participaciones" title="Oportunidades y participaciones" description="Consulta instrumentos disponibles y sigue tus suscripciones desde el espacio privado de inversión.">
      <div className="grid md:grid-cols-3 gap-4">
        {[{ icon: Files, title: "Términos por oportunidad", text: "Instrumento, unidades, precio y condiciones antes de comprometer capital." }, { icon: PieChart, title: "Mis participaciones", text: "Distingue suscripciones pendientes de posiciones confirmadas." }, { icon: ShieldCheck, title: "Acceso autorizado", text: "Los documentos privados y la administración del emisor conservan sus permisos." }].map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-xl border border-border bg-card/40 p-6"><Icon className="w-6 h-6 text-gold mb-4" /><h2 className="font-semibold">{title}</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{text}</p></article>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card/40 p-6 flex flex-wrap items-center justify-between gap-5">
        <div><h2 className="text-lg font-semibold">Tu espacio de inversión</h2><p className="text-sm text-muted-foreground mt-2">Explora ofertas y consulta el estado de tus participaciones.</p></div>
        <Link to="/auth" search={{ intent: "investor", next: "/dashboard/offerings" }} className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-medium text-black">Abrir ofertas y participaciones <ArrowRight className="w-4 h-4" /></Link>
      </div>
      <p className="text-xs text-muted-foreground">La plataforma registra ofertas y suscripciones. La titularidad y sus derechos dependen de los documentos definitivos de cada instrumento. No constituye oferta pública de valores.</p>
    </TerminalSectionFrame>
  );
}
