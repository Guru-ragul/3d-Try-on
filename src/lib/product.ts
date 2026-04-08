// ─── Product model ────────────────────────────────────────────────────────────

export type ProductCategory = 'top' | 'bottom' | 'full';

export interface FitWeights {
  chest: number; // must sum to 1 with waist + hips
  waist: number;
  hips: number;
}

export interface CategoryConfig {
  label: string;
  emoji: string;
  description: string;
  tryOnSupported: boolean;
  tryOnNote?: string;
  fitWeights: FitWeights;
  /** Which measurements are shown prominently in the form */
  primaryMeasurements: Array<'chest' | 'waist' | 'hips'>;
  photoHint: string;
}

export const CATEGORY_CONFIG: Record<ProductCategory, CategoryConfig> = {
  top: {
    label: 'Top / T-Shirt',
    emoji: '👕',
    description: 'Shirts, T-shirts, jackets, hoodies',
    tryOnSupported: true,
    fitWeights: { chest: 0.50, waist: 0.30, hips: 0.20 },
    primaryMeasurements: ['chest'],
    photoHint: 'Upper body or full body, front-facing works best',
  },
  bottom: {
    label: 'Bottom / Pants',
    emoji: '👖',
    description: 'Jeans, trousers, shorts, skirts',
    tryOnSupported: true,
    tryOnNote: 'Pants try-on is experimental. Measurements drive the fit score — treat the visual as style reference only.',
    fitWeights: { chest: 0.10, waist: 0.50, hips: 0.40 },
    primaryMeasurements: ['waist', 'hips'],
    photoHint: 'Full body, stand straight, front-facing',
  },
  full: {
    label: 'Full Outfit',
    emoji: '🧥',
    description: 'Dresses, suits, co-ords, full sets',
    tryOnSupported: true,
    fitWeights: { chest: 0.35, waist: 0.35, hips: 0.30 },
    primaryMeasurements: ['chest', 'waist', 'hips'],
    photoHint: 'Full body, front-facing photo required',
  },
};

// ─── Cross-sell map ───────────────────────────────────────────────────────────

export interface CrossSellEntry {
  label: string;
  examples: string;
  /** Word appended to "size X" when building a search query */
  searchSuffix: string;
}

export const CROSS_SELL_MAP: Record<ProductCategory, CrossSellEntry[]> = {
  top: [
    { label: 'Matching Pants',       examples: 'slim jeans, chinos, trousers',   searchSuffix: 'pants'       },
    { label: 'Shoes to pair',         examples: 'sneakers, loafers, boots',        searchSuffix: 'shoes'       },
  ],
  bottom: [
    { label: 'Matching Top',          examples: 'fitted shirt, polo, casual tee', searchSuffix: 'shirt'       },
    { label: 'Complete with a Jacket', examples: 'bomber, denim jacket, blazer',  searchSuffix: 'jacket'      },
  ],
  full: [
    { label: 'Add a Layer',           examples: 'jacket, blazer, cardigan',       searchSuffix: 'jacket'      },
    { label: 'Accessories',           examples: 'belt, watch, sunglasses',        searchSuffix: 'accessories' },
  ],
};
