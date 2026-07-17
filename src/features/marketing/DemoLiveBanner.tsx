import { Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";

/**
 * Banner honesto para los live maps DEMO (datos ilustrativos, no proyectos
 * reales) con retorno a la plataforma. Reemplaza al banner "Confidencial"
 * que inducía a creer que eran datos operativos.
 */
export function DemoLiveBanner({ label = "Live Map de demostración" }: { label?: string }) {
  return (
    <div className="bg-gold/10 border-b border-gold/30 px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider">
      <span className="flex items-center gap-2 text-gold">
        <FlaskConical className="w-3.5 h-3.5" />
        {label} · Datos ilustrativos — no representan un proyecto real
      </span>
      <span className="ml-auto flex items-center gap-3">
        <Link to="/" className="flex items-center gap-1 text-gold hover:underline">
          <ArrowLeft className="w-3 h-3" /> Geocapitals
        </Link>
        <Link to="/dashboard" className="text-gold hover:underline">
          Abrir plataforma →
        </Link>
      </span>
    </div>
  );
}
