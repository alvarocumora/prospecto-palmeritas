import { describe, it, expect } from 'vitest';
import { DECK_TERMS, DECK_SLIDES, buildMarketingDeck, deckSlideIndex } from './deck2026';
describe('Dossier comercial octubre 2026', () => {
 it('preserva ronda y asignación por proyecto', () => { expect(DECK_TERMS.roundUsd).toBe(1500000); expect(DECK_TERMS.shares * DECK_TERMS.shareUsd).toBe(1500000); });
 it('preserva mínimo de 150 acciones por USD 15.000', () => { expect(DECK_TERMS.minUsd).toBe(15000); expect(DECK_TERMS.minShares).toBe(150); expect(DECK_TERMS.minShares * DECK_TERMS.shareUsd).toBe(DECK_TERMS.minUsd); });
 it('conserva colocaciones declaradas sin derivar recaudo', () => { expect(DECK_TERMS.cholquiPlacement).toBe(47); expect(DECK_TERMS.tilamaPlacement).toBe(65); expect(buildMarketingDeck()).not.toHaveProperty('raisedUsd'); });
 it('mantiene colateral separado y ejemplo nominal', () => { expect(DECK_TERMS.collateralMinClp).toBe(15000000); expect(DECK_TERMS.collateralMinClp*DECK_TERMS.collateralRate/100/12).toBe(150000); });
 it('comparte las diez láminas con el PDF', () => { expect(DECK_SLIDES).toHaveLength(10); expect(buildMarketingDeck().visualSlides).toBe(DECK_SLIDES); });
 it('limita navegación a láminas válidas', () => { expect(deckSlideIndex(10)).toBe(10); expect(deckSlideIndex(11)).toBe(1); expect(deckSlideIndex(-1)).toBe(1); expect(deckSlideIndex('x')).toBe(1); expect(deckSlideIndex(4)).toBe(4); });
});
