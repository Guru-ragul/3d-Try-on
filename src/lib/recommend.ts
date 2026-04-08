// ─── Recommendation engine ────────────────────────────────────────────────────
// Completely separate from the fit engine.
// Input: selected product's category + size + fit result.
// Output: upsell (better size/fit) + cross-sell (complementary items).

import type { FitResult } from './fit';
import type { ProductCategory } from './product';
import { CROSS_SELL_MAP } from './product';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Upsell {
  type: 'size-up' | 'size-down' | 'perfect' | 'no-data';
  headline: string;
  detail: string;
  suggestedSize: string;
}

export interface CrossSell {
  label: string;
  examples: string;
  /** Pre-built query you can drop into any search engine / marketplace */
  searchQuery: string;
  /** Link to search on Myntra (best-effort) */
  myntraUrl: string;
}

export interface RecommendationSet {
  upsell: Upsell | null;
  crossSell: CrossSell[];
  bundleNote: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIZES_ORDERED = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL'];

function adjacentSize(size: string, dir: 'up' | 'down'): string {
  const i = SIZES_ORDERED.indexOf(size.toUpperCase());
  if (i === -1) return size;
  const j = dir === 'up' ? i + 1 : i - 1;
  return SIZES_ORDERED[j] ?? size;
}

// ─── Rules ─────────────────────────────────────────────────────────────────────
// Rule 1 — If any area is too-tight OR (tight + score < 75) → size up.
// Rule 2 — If any area is too-loose AND score < 75 → size down.
// Rule 3 — Otherwise (score ≥ 75 or no tight/loose) → affirm the size.
// Rule 4 — If no fit data → generic upsell with confidence note.
// Rule 5 — Cross-sell always comes from CROSS_SELL_MAP for the chosen category.
// Rule 6 — Bundle note fires only when fit score ≥ 70.

export function getRecommendations(
  category: ProductCategory,
  selectedSize: string,
  fit: FitResult | null,
): RecommendationSet {
  // ── Upsell ───────────────────────────────────────────────────────────────────
  let upsell: Upsell | null = null;

  if (!fit || fit.breakdown.length === 0) {
    upsell = {
      type: 'no-data',
      headline: 'Add your measurements',
      detail: 'Enter chest / waist / hips measurements to get a personalised size recommendation.',
      suggestedSize: selectedSize,
    };
  } else {
    const hasTooTight = fit.breakdown.some(b => b.status === 'too-tight');
    const hasTight    = fit.breakdown.some(b => b.status === 'tight');
    const hasTooLoose = fit.breakdown.some(b => b.status === 'too-loose');

    if (hasTooTight || (hasTight && fit.score < 75)) {
      const up = adjacentSize(selectedSize, 'up');
      upsell = {
        type: 'size-up',
        headline: hasTooTight ? `Size ${selectedSize} won't fit comfortably` : `Feeling a bit snug`,
        detail: `Your measurements suggest ${up} will give better comfort and movement.`,
        suggestedSize: up,
      };
    } else if (hasTooLoose && fit.score < 75) {
      const down = adjacentSize(selectedSize, 'down');
      upsell = {
        type: 'size-down',
        headline: `This might run too large`,
        detail: `Try ${down} for a cleaner silhouette that doesn't bag out.`,
        suggestedSize: down,
      };
    } else {
      upsell = {
        type: 'perfect',
        headline: `${fit.label} — great choice!`,
        detail: fit.recommendation,
        suggestedSize: selectedSize,
      };
    }
  }

  // ── Cross-sell ────────────────────────────────────────────────────────────────
  const crossSell: CrossSell[] = (CROSS_SELL_MAP[category] ?? []).map(cs => {
    const query = `${cs.searchSuffix} size ${selectedSize}`;
    return {
      label:       cs.label,
      examples:    cs.examples,
      searchQuery: query,
      myntraUrl:   `https://www.myntra.com/${encodeURIComponent(cs.searchSuffix)}?q=${encodeURIComponent(query)}`,
    };
  });

  // ── Bundle note ───────────────────────────────────────────────────────────────
  const bundleNote: string | null = fit && fit.score >= 70 && crossSell.length > 0
    ? `Great fit found! Complete your look — browse ${crossSell[0].label} below.`
    : crossSell.length > 0
    ? `Complete your look with ${crossSell[0].label}.`
    : null;

  return { upsell, crossSell, bundleNote };
}
