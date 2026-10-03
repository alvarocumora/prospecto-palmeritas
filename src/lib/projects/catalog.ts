export type CanonicalProjectSlug = "palmeras" | "losverdes" | "cholqui";

export type PublicProjectRecord = {
  slug: CanonicalProjectSlug;
  code: string;
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
    livePath: "/live/palmeras",
    investmentPath: "/proyectos/ficha/palmeras",
    status: "published",
  },
  {
    slug: "losverdes",
    code: "LV-TIL-001",
    name: "Distrito Cuprífero Los Verdes–Tilama",
    aliases: ["tilama"],
    livePath: "/live/losverdes",
    investmentPath: "/proyectos/ficha/losverdes",
    status: "published",
  },
  {
    slug: "cholqui",
    code: "CHOLQUI",
    name: "Proyecto Cholqui",
    aliases: ["franco", "gianfranco"],
    livePath: "/live/cholqui",
    investmentPath: "/proyectos/ficha/cholqui",
    privatePath: "/dashboard/cholqui",
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
