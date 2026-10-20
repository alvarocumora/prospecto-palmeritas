import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentState } from "./ContentState";
import { PageHeader, PlatformPage } from "./PlatformPage";

describe("GeoCapitals institutional page primitives", () => {
  it("uses the canonical scoped design system without replacing the app shell", () => {
    const html = renderToStaticMarkup(
      <PlatformPage width="standard">
        <PageHeader eyebrow="Proyectos" title="Mi cartera" description="Información registrada" />
        <section>Contenido real</section>
      </PlatformPage>,
    );
    expect(html).toContain('data-theme="im-light"');
    expect(html).toContain("max-w-5xl");
    expect(html).toContain("Mi cartera");
    expect(html).toContain("Contenido real");
    expect(html).toContain("border-hairline");
  });

  it("distinguishes loading and errors instead of presenting synthetic zeroes", () => {
    const loading = renderToStaticMarkup(<ContentState kind="loading" />);
    const error = renderToStaticMarkup(
      <ContentState kind="error" action={{ label: "Reintentar", onClick: () => {} }} />,
    );
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).not.toContain("Reintentar");
    expect(error).toContain('role="alert"');
    expect(error).toContain("Reintentar");
    expect(error).not.toContain("USD 0");
  });

  it("shows intentional empty data with a separate action", () => {
    const html = renderToStaticMarkup(
      <ContentState
        kind="empty"
        title="Sin proyectos"
        action={{ label: "Crear proyecto", onClick: () => {} }}
      />,
    );
    expect(html).toContain("Sin proyectos");
    expect(html).toContain("Crear proyecto");
    expect(html).toContain("min-h-11");
  });
});
