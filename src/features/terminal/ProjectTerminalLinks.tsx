import { Link } from "@tanstack/react-router";

const PROJECTS = [
  { slug: "cholqui", name: "Cholqui", c: "Au-Cu" },
  { slug: "losverdes", name: "Los Verdes", c: "Cu-Mo" },
  { slug: "palmeras", name: "Las Palmeras", c: "Au-Ag" },
];

/** Franja que lleva de visores sueltos al terminal único de cada proyecto. */
export function ProjectTerminalLinks({ label }: { label: string }) {
  return (
    <div className="border-b border-hairline bg-surface">
      <div className="max-w-7xl mx-auto px-5 py-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono uppercase tracking-wider text-content-muted mr-2">{label}</span>
        {PROJECTS.map((p) => (
          <Link
            key={p.slug}
            to="/terminal/$slug"
            params={{ slug: p.slug }}
            search={{ tab: "mapa" } as never}
            className="rounded border border-hairline px-3 py-1 hover:border-accent-brand hover:text-accent-brand"
          >
            {p.name} <span className="font-mono text-content-muted">{p.c}</span> →
          </Link>
        ))}
      </div>
    </div>
  );
}
