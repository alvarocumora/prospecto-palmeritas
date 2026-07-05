/**
 * FlagChip — chip de país tipográfico (no depende de emoji fonts, que fallan
 * en Linux headless / muchas distros Chromium usadas en preview).
 * Muestra el código ISO alpha-2 sobre una banda con un acento del sistema.
 */

type Props = {
  code: string; // ISO alpha-2, ej. "CL"
  label?: string;
  className?: string;
};

// Bandas de acento por país (colores oficiales suavizados)
const ACCENT: Record<string, string> = {
  CL: "#d52b1e",
  PE: "#d91023",
  BR: "#009c3b",
  CO: "#fcd116",
  VE: "#ffcc00",
  AR: "#75aadb",
  BO: "#ffcc00",
  EC: "#ffdd00",
  MX: "#006341",
  ZA: "#007749",
  CD: "#007fff",
  ZM: "#198a00",
  GH: "#fcd116",
  TZ: "#1eb53a",
  US: "#3c3b6e",
};

export function FlagChip({ code, label, className = "" }: Props) {
  const c = code.toUpperCase();
  const accent = ACCENT[c] ?? "#6b7280";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-hairline bg-white/70 font-mono text-[10px] uppercase tracking-wider text-content ${className}`}
    >
      <span
        aria-hidden
        className="inline-block w-3 h-2 rounded-sm"
        style={{ background: accent }}
      />
      <span className="font-semibold">{c}</span>
      {label && <span className="text-content-subtle normal-case tracking-normal">{label}</span>}
    </span>
  );
}
