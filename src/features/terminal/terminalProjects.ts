import { PUBLIC_PROJECTS, canonicalProjectSlug } from "@/lib/projects/catalog";
import type { CanonicalProjectSlug } from "@/lib/projects/catalog";
import { getFicha, type ProjectFicha } from "@/lib/investor/fichas";

/**
 * Configuración del Terminal de inversión: una sola shell por proyecto con
 * pestañas ejecutivas (mapa, tesis, simulador, data room). Reemplaza la cadena
 * portada → drawer → ficha → live map.
 */
export type TerminalTabKey = "mapa" | "tesis" | "simulador" | "dataroom";

export const TERMINAL_TABS: Array<{ key: TerminalTabKey; label: string; short: string }> = [
  { key: "mapa", label: "Mapa & Exploración", short: "Mapa" },
  { key: "tesis", label: "Tesis & Ensayes", short: "Tesis" },
  { key: "simulador", label: "Simulador & Modelo", short: "Simulador" },
  { key: "dataroom", label: "Data Room & Compliance", short: "Data room" },
];

export function isTerminalTab(value: unknown): value is TerminalTabKey {
  return TERMINAL_TABS.some((tab) => tab.key === value);
}

export type TerminalProject = {
  slug: CanonicalProjectSlug;
  code: string;
  name: string;
  ficha: ProjectFicha;
  livePath: string;
};

export function getTerminalProject(slug: string): TerminalProject | null {
  const canonical = canonicalProjectSlug(slug);
  if (!canonical) return null;
  const record = PUBLIC_PROJECTS.find((project) => project.slug === canonical);
  const ficha = getFicha(canonical);
  if (!record || !ficha) return null;
  return {
    slug: canonical,
    code: ficha.code,
    name: ficha.name,
    ficha,
    livePath: record.livePath,
  };
}

export function listTerminalProjects(): TerminalProject[] {
  return PUBLIC_PROJECTS.map((project) => getTerminalProject(project.slug)).filter(
    (project): project is TerminalProject => project !== null,
  );
}

/**
 * Resuelve el slug del terminal para un listado público (tarjetas de portada),
 * para aterrizar directo en el terminal en vez de abrir el panel intermedio.
 */
export function terminalSlugForListing(listing: {
  code?: string | null;
  title?: string | null;
}): CanonicalProjectSlug | null {
  const code = (listing.code ?? "").trim().toUpperCase();
  const title = (listing.title ?? "").toLowerCase();
  for (const project of PUBLIC_PROJECTS) {
    if (code && code === project.code.toUpperCase()) return project.slug;
  }
  if (title.includes("cholqui")) return "cholqui";
  if (title.includes("verdes") || title.includes("tilama")) return "losverdes";
  if (title.includes("palmeras")) return "palmeras";
  if (title.includes("nahuelbuta") || title.includes("arcillas")) return "nahuelbuta";
  return null;
}
