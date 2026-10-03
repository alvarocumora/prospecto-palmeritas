import { describe, expect, it } from "vitest";
import { PUBLIC_PROJECTS, canonicalProjectSlug, getPublicProject } from "./catalog";

describe("catálogo canónico de proyectos", () => {
  it("mantiene un único registro por proyecto publicado", () => {
    expect(PUBLIC_PROJECTS.map((project) => project.slug)).toEqual([
      "palmeras",
      "losverdes",
      "cholqui",
    ]);
  });

  it("resuelve nombres históricos hacia el proyecto canónico", () => {
    expect(canonicalProjectSlug("franco")).toBe("cholqui");
    expect(canonicalProjectSlug("gianfranco")).toBe("cholqui");
    expect(canonicalProjectSlug("tilama")).toBe("losverdes");
    expect(getPublicProject("franco")?.livePath).toBe("/terminal/cholqui");
    expect(getPublicProject("tilama")?.livePath).toBe("/terminal/losverdes");
  });
});
