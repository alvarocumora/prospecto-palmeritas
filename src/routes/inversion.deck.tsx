import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize, Minimize, Printer } from "lucide-react";
import { BrandButton } from "@/components/brand/Button";
import { DECK_SLIDES, deckSlideIndex } from "@/features/marketing/deck/deck2026";
import { DeckSlide, ScaledDeckSlide } from "@/features/marketing/deck/DeckSlide";
import { DeckDownload } from "@/features/marketing/deck/DeckDownload";
export const Route = createFileRoute("/inversion/deck")({
  validateSearch: (search: Record<string, unknown>) => ({
    slide: deckSlideIndex(search.slide),
    print: search.print === true || search.print === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "GeoCapitals · Investor Deck 2026 | Cholqui y Los Verdes" },
      {
        name: "description",
        content:
          "Presentación comercial Serie A: proyectos Cholqui y Los Verdes–Tilama, rondas declaradas, explotación, riesgos y alternativa de colateral inmobiliario.",
      },
      { property: "og:title", content: "GeoCapitals · Investor Deck 2026" },
      {
        property: "og:description",
        content:
          "Dos proyectos mineros en Chile. Términos según dossier comercial octubre 2026, datos declarados y riesgos identificados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestorDeck,
});
function InvestorDeck() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const index = search.slide - 1;
  const slide = DECK_SLIDES[index];
  const root = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const go = (n: number) => {
    if (n >= 1 && n <= DECK_SLIDES.length)
      void navigate({ search: { ...search, slide: n }, replace: true });
  };
  useEffect(() => {
    document.title = `${search.slide}/${DECK_SLIDES.length} — ${slide.title} · GeoCapitals`;
  }, [search.slide, slide.title]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,select,textarea,[contenteditable]")
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(search.slide + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(search.slide - 1);
      }
      if (e.key === "Escape" && document.fullscreenElement) void document.exitFullscreen();
    };
    const sync = () => setFullscreen(document.fullscreenElement === root.current);
    window.addEventListener("keydown", keys);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      window.removeEventListener("keydown", keys);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [search.slide, search.print]);
  if (search.print)
    return (
      <main data-theme="im-light" className="brand-light investor-print">
        {DECK_SLIDES.map((s, i) => (
          <DeckSlide key={s.title} slide={s} index={i} total={DECK_SLIDES.length} />
        ))}
      </main>
    );
  return (
    <div
      ref={root}
      data-theme="im-light"
      className={`brand-light investor-deck-page bg-surface text-content min-h-screen ${fullscreen ? "investor-fullscreen" : ""}`}
    >
      <header className="deck-toolbar flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-4">
        <BrandButton asChild variant="ghost">
          <Link to="/" aria-label="Volver a inicio">
            <ArrowLeft /> GeoCapitals
          </Link>
        </BrandButton>
        <span className="font-mono text-xs text-content-muted flex-1">INVESTOR DECK 2026</span>
        <DeckDownload />
        <BrandButton variant="ghost" title="Versión imprimible" asChild>
          <Link
            to="/inversion/deck"
            search={{ slide: 1, print: true }}
            aria-label="Versión imprimible"
          >
            <Printer />
          </Link>
        </BrandButton>
        <BrandButton
          variant="ghost"
          title="Pantalla completa"
          aria-label="Pantalla completa"
          onClick={async () => {
            try {
              if (document.fullscreenElement) await document.exitFullscreen();
              else await root.current?.requestFullscreen();
            } catch {
              setError("La pantalla completa no está disponible en este navegador.");
            }
          }}
        >
          {fullscreen ? <Minimize /> : <Maximize />}
        </BrandButton>
      </header>
      <main className="deck-main mx-auto max-w-[1600px] w-full px-3 md:px-8 py-4 md:py-8">
        {error && <p role="alert">{error}</p>}
        <div
          onTouchStart={(e) => {
            startX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const end = e.changedTouches[0]?.clientX;
            if (startX.current !== null && end !== undefined && Math.abs(end - startX.current) > 45)
              go(search.slide + (end < startX.current ? 1 : -1));
            startX.current = null;
          }}
        >
          <ScaledDeckSlide slide={slide} index={index} total={DECK_SLIDES.length} />
        </div>
        <nav
          aria-label="Navegación de láminas"
          className="flex items-center justify-between gap-2 mt-4"
        >
          <BrandButton
            variant="outline"
            aria-label="Lámina anterior"
            disabled={index === 0}
            onClick={() => go(search.slide - 1)}
          >
            <ArrowLeft />
          </BrandButton>
          <select
            aria-label="Seleccionar lámina"
            value={search.slide}
            onChange={(e) => go(Number(e.target.value))}
            className="min-w-0 max-w-[65%] h-11 border border-hairline bg-surface text-content px-2 text-sm"
          >
            {DECK_SLIDES.map((s, i) => (
              <option key={s.title} value={i + 1}>
                {String(i + 1).padStart(2, "0")} / {s.title}
              </option>
            ))}
          </select>
          <BrandButton
            variant="outline"
            aria-label="Lámina siguiente"
            disabled={index === DECK_SLIDES.length - 1}
            onClick={() => go(search.slide + 1)}
          >
            <ArrowRight />
          </BrandButton>
        </nav>
        <div className="deck-mobile-reading mt-6 border-t border-hairline pt-5">
          <p className="text-xs font-mono text-accent-brand">{slide.kicker}</p>
          <h2 className="font-serif text-3xl mt-2">{slide.title}</h2>
          <p className="mt-3">{slide.lead}</p>
          {slide.stats.map((s) => (
            <p key={s.label} className="mt-3">
              <strong>{s.value}</strong> · {s.label} {s.note}
            </p>
          ))}
          {slide.items.map((item) => (
            <section key={item.title} className="mt-4">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm mt-1 text-content-muted">{item.body}</p>
            </section>
          ))}
          <p className="text-xs mt-4 text-content-muted">{slide.note}</p>
        </div>
        {index === 9 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <BrandButton asChild>
              <Link to="/contacto">
                Conversar con Geocapitals <ArrowRight />
              </Link>
            </BrandButton>
            <BrandButton variant="outline" asChild>
              <Link to="/proyectos">Revisar proyectos</Link>
            </BrandButton>
          </div>
        )}
        <p className="text-xs text-content-muted mt-6">
          Documento comercial · Octubre 2026 · No constituye oferta pública de valores. Sin recursos
          ni reservas certificados NI 43-101/JORC.
        </p>
      </main>
    </div>
  );
}
