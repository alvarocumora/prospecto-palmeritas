export type CanonicalProjectSlug = "palmeras" | "losverdes" | "cholqui" | "nahuelbuta";

export type PublicProjectRecord = {
  slug: CanonicalProjectSlug;
  code: string;
  /** UUID already used by the published project's data adapters. */
  projectId?: string;
  name: string;
  aliases: readonly string[];
  livePath: `/terminal/${string}`;
  investmentPath: `/proyectos/ficha/${string}`;
  privatePath?: `/dashboard/${string}`;
  status: "published" | "review" | "draft" | "archived";
};

export const PUBLIC_PROJECTS: readonly PublicProjectRecord[] = [
  {
    slug: "palmeras",
    code: "PALMERAS",
    name: "Prospecto Las Palmeras",
    aliases: [],
    livePath: "/terminal/palmeras",
    investmentPath: "/proyectos/ficha/palmeras",
    status: "published",
  },
  {
    slug: "losverdes",
    projectId: "7a499b02-ecdf-447b-8956-b106fe4ec087",
    code: "LV-TIL-001",
    name: "Distrito Cuprífero Los Verdes–Tilama",
    aliases: ["tilama"],
    livePath: "/terminal/losverdes",
    investmentPath: "/proyectos/ficha/losverdes",
    status: "published",
  },
  {
    slug: "cholqui",
    projectId: "e5360f13-1647-4e44-bb13-c0614e6f39fe",
    code: "CHOLQUI",
    name: "Proyecto Cholqui",
    aliases: ["franco", "gianfranco"],
    livePath: "/terminal/cholqui",
    investmentPath: "/proyectos/ficha/cholqui",
    privatePath: "/dashboard/cholqui",
    status: "published",
  },
  {
    slug: "nahuelbuta",
    code: "NHB-REE",
    name: "Nahuelbuta REE · Paños Arcillas",
    aliases: ["losalamos", "arcillas", "bioenergy"],
    livePath: "/terminal/nahuelbuta",
    investmentPath: "/proyectos/ficha/nahuelbuta",
    status: "published",
  },
] as const;

const ALIASES = new Map(
  PUBLIC_PROJECTS.flatMap((project) => [
    [project.slug, project.slug] as const,
    ...project.aliases.map((alias) => [alias, project.slug] as const),
  ]),
);

export function canonicalProjectSlug(slug: string): CanonicalProjectSlug | null {
  return ALIASES.get(slug.toLowerCase()) ?? null;
}

export function getPublicProject(slug: string): PublicProjectRecord | null {
  const canonical = canonicalProjectSlug(slug);
  return PUBLIC_PROJECTS.find((project) => project.slug === canonical) ?? null;
}

export function getPublicProjectById(projectId: string): PublicProjectRecord | null {
  return PUBLIC_PROJECTS.find((project) => project.projectId === projectId) ?? null;
}
