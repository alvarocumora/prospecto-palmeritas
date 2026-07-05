/* Banda de "prueba social" con etiquetas de estándares/organismos.
   No usa imágenes externas (evita 404s y bloqueos). Es un marquee CSS. */
const ITEMS = [
  "SERNAGEOMIN",
  "NI 43-101",
  "JORC 2012",
  "S-K 1300",
  "LBMA",
  "RJC",
  "FAIRMINED",
  "ICMM",
  "IRMA",
  "ISO 14001",
  "SOC 2",
  "GRI",
];

export function LogoMarquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <section
      aria-label="Estándares y certificaciones soportadas"
      className="relative overflow-hidden border-y border-hairline bg-white"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10" />
      <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-6">
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.22em] text-content-subtle">
          Estándares soportados
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex gap-10 marquee-track whitespace-nowrap py-2">
            {row.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="font-mono text-[12px] tracking-[0.22em] uppercase text-content-subtle/70 hover:text-content transition-colors"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
