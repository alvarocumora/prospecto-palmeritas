import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Estado de error reutilizable con reintento. Usa colores literales (no tokens
 * de tema) para renderizar bien tanto en el sitio de marketing como en el
 * dashboard. Evita que un fallo de red se muestre como "sin datos".
 */
export function QueryError({
  onRetry,
  message,
  className,
}: {
  onRetry?: () => void;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-red-500/30 bg-red-500/5 p-5 text-center ${className ?? ""}`}
    >
      <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-2" />
      <p className="text-sm font-medium text-red-600">
        {message ?? "No pudimos cargar los datos."}
      </p>
      <p className="text-xs opacity-60 mt-1">Revisa tu conexión e inténtalo de nuevo.</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}
