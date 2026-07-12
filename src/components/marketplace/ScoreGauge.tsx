// Medidor circular 0-100 compartido por los paneles de confianza del marketplace
// (KYM y reputación de contraparte). Extraído para eliminar el SVG duplicado.

export function ScoreGauge({ score, ringClassName }: { score: number; ringClassName: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const dash = `${pct * 2.64} 264`;
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-black/5"
        />
        <circle
          cx="48"
          cy="48"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={dash}
          className={ringClassName}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-[9px] uppercase tracking-wider text-content-subtle">/ 100</span>
      </div>
    </div>
  );
}
