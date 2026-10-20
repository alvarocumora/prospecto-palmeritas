import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { BrandButton } from '@/components/brand/Button';
import { DECK_SLIDES } from './deck2026';
import { DeckDownload } from './DeckDownload';
export function InvestorDeckEntry() {
  return <section className="investor-deck-entry border-b border-hairline bg-surface-2">
    <div className="mx-auto max-w-6xl px-5 py-12 grid gap-6 md:grid-cols-[1fr_auto] items-center">
      <div><p className="font-mono text-xs text-accent-brand">SERIE A / DOS PROYECTOS EN CHILE</p><h2 className="font-serif text-4xl mt-2">Investor Deck 2026</h2><p className="mt-3 text-content-muted">Cholqui y Los Verdes – Tilama. Rondas, plan de explotación y alternativa de colateral.</p><p className="mt-2 text-xs text-content-muted">Según dossier comercial octubre 2026 · Datos declarados y referenciales.</p></div>
      <div className="flex flex-wrap gap-3"><BrandButton asChild><Link to="/inversion/deck" search={{ slide: 1, print: undefined }} >Ver deck de inversión <ArrowUpRight/></Link></BrandButton><DeckDownload/></div>
    </div><div className="grid grid-cols-2 h-40 md:h-56 overflow-hidden">{[DECK_SLIDES[3], DECK_SLIDES[4]].map(s => <figure className="relative overflow-hidden" key={s.title}><img src={s.image} alt={`Imagen satelital ${s.title}`} loading="lazy" className="h-full w-full object-cover"/><figcaption className="absolute bottom-0 inset-x-0 bg-content/90 text-surface px-5 py-2 text-sm">{s.title} · Imagen satelital</figcaption></figure>)}</div>
  </section>;
}
