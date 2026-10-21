import { useEffect, useRef, useState } from 'react';
import type { InvestorVisualSlide } from '@/lib/pdf/model';

export function DeckSlide({ slide, index, total }: { slide: InvestorVisualSlide; index: number; total: number }) {
  return <article className={`investor-slide ${slide.hero ? 'investor-slide-hero' : ''}`} aria-label={`Lámina ${index + 1}: ${slide.title}`}>
    <figure className="investor-slide-image"><img src={slide.image} alt={slide.imageLabel} /><figcaption>{slide.imageLabel}</figcaption></figure>
    <div className="investor-slide-copy">
      <header><span>GEOCAPITALS</span><span>INVESTOR DECK / OCTUBRE 2026</span></header>
      <p className="investor-kicker">{slide.kicker}</p><h1>{slide.title}</h1><p className="investor-lead">{slide.lead}</p>
      <div className="investor-stats">{slide.stats.map(s => <div key={s.label}><strong>{s.value}</strong><span>{s.label}</span>{s.note && <small>{s.note}</small>}</div>)}</div>
      <div className="investor-items">{slide.items.map(item => <section key={item.title}><h2>{item.title}</h2><p>{item.body}</p></section>)}</div>
    </div>
    <footer><p>{slide.note}{slide.note.includes('NI 43-101') ? '' : ' · Sin recursos ni reservas certificados NI 43-101/JORC.'}</p><span>{String(index + 1).padStart(2, '0')} / {total}</span></footer>
  </article>;
}
export function ScaledDeckSlide(props: Parameters<typeof DeckSlide>[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080)));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="investor-slide-stage"><div className="investor-slide-scaled" style={{ transform: `scale(${scale})` }}><DeckSlide {...props}/></div></div>;
}
