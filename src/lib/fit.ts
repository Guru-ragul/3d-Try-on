// ─── Types ────────────────────────────────────────────────────────────────────

export interface Measurements {
  size: string;    // 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '2XL'
  chest?: string;  // inches
  waist?: string;  // inches
  hips?: string;   // inches
  height?: string; // cm  (used for display / future BMI calc)
  weight?: string; // kg  (used for display / future BMI calc)
}

export interface AreaBreakdown {
  area: string;
  userIn: number;
  sizeRange: [number, number];
  deviation: number;   // inches, positive = too large (loose), negative = too small (tight)
  status: 'perfect' | 'great' | 'loose' | 'tight' | 'too-loose' | 'too-tight';
  score: number;       // 0–100
}

export interface FitResult {
  score: number;        // 0–100 weighted overall
  label: string;        // e.g. "Perfect Fit"
  recommendation: string;
  suggestedSize: string;
  confidence: number;   // 0–100 based on how many measurements were provided
  breakdown: AreaBreakdown[];
}

// ─── Size chart ───────────────────────────────────────────────────────────────
// Body measurements in inches that the size is designed for (without ease).

const SIZE_CHART: Record<string, Record<'chest' | 'waist' | 'hips', [number, number]>> = {
  'XS':  { chest: [31, 33], waist: [24, 26], hips: [33, 35] },
  'S':   { chest: [33, 35], waist: [26, 28], hips: [35, 37] },
  'M':   { chest: [35, 37], waist: [28, 30], hips: [37, 39] },
  'L':   { chest: [37, 39], waist: [30, 32], hips: [39, 41] },
  'XL':  { chest: [39, 41], waist: [32, 34], hips: [41, 43] },
  'XXL': { chest: [41, 43], waist: [34, 36], hips: [43, 45] },
  '2XL': { chest: [43, 46], waist: [36, 38], hips: [45, 48] },
};

const SIZES_ORDERED = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL'];

/**
 * Standard comfort ease for a regular-fit garment (inches).
 * Fitted shirts ≈ 2", regular tops ≈ 2.5–3", boxy/relaxed ≈ 4"+.
 * We use 2.5" as a conservative default.
 */
const EASE = 2.5;

// ─── Per-area scoring ─────────────────────────────────────────────────────────

function scoreArea(
  userMeasurement: number,
  sizeRange: [number, number],
  label: string,
): AreaBreakdown {
  const [lo, hi] = sizeRange;
  const mid = (lo + hi) / 2;
  const halfWidth = (hi - lo) / 2; // typically 1 inch

  // deviation: positive means user is larger than the size midpoint
  const deviation = parseFloat((userMeasurement - mid).toFixed(1));

  let status: AreaBreakdown['status'];
  let score: number;

  if (userMeasurement >= lo && userMeasurement <= hi) {
    // ✅ Exactly within the size range
    status = 'perfect';
    score = Math.round(100 - (Math.abs(deviation) / halfWidth) * 5); // 95–100
  } else if (userMeasurement > hi && userMeasurement <= hi + EASE) {
    // User slightly larger → garment sits snug but within ease
    status = 'great';
    const excess = userMeasurement - hi;
    score = Math.round(94 - (excess / EASE) * 14); // 80–94
  } else if (userMeasurement < lo && userMeasurement >= lo - EASE) {
    // User slightly smaller → garment is a touch loose but comfortable
    status = 'loose';
    const deficit = lo - userMeasurement;
    score = Math.round(90 - (deficit / EASE) * 15); // 75–90
  } else if (userMeasurement > hi + EASE && userMeasurement <= hi + EASE * 2) {
    // User noticeably larger → will feel tight
    status = 'tight';
    const excess = userMeasurement - (hi + EASE);
    score = Math.round(74 - (excess / EASE) * 20); // 54–74
  } else if (userMeasurement < lo - EASE) {
    // User noticeably smaller → garment bags out
    status = 'too-loose';
    const deficit = (lo - EASE) - userMeasurement;
    score = Math.max(10, Math.round(55 - deficit * 7));
  } else {
    // user > hi + EASE*2 → too tight, won't fit
    status = 'too-tight';
    const excess = userMeasurement - (hi + EASE * 2);
    score = Math.max(10, Math.round(50 - excess * 8));
  }

  return {
    area: label,
    userIn: userMeasurement,
    sizeRange,
    deviation,
    status,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ─── Best-size finder ─────────────────────────────────────────────────────────

function findBestSize(measured: Partial<Record<'chest' | 'waist' | 'hips', number>>): string {
  const entries = Object.entries(measured) as Array<['chest' | 'waist' | 'hips', number]>;
  if (entries.length === 0) return 'M';

  let best = 'M';
  let bestScore = -1;

  for (const size of SIZES_ORDERED) {
    let total = 0;
    for (const [area, val] of entries) {
      total += scoreArea(val, SIZE_CHART[size][area], area).score;
    }
    const avg = total / entries.length;
    if (avg > bestScore) {
      bestScore = avg;
      best = size;
    }
  }

  return best;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function calculateFit(measurements: Measurements): FitResult {
  const { size = 'M' } = measurements;
  const sizeData = SIZE_CHART[size] ?? SIZE_CHART['M'];

  // Parse optional numeric inputs
  const parse = (v?: string) => {
    const n = parseFloat(v ?? '');
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const chestVal = parse(measurements.chest);
  const waistVal = parse(measurements.waist);
  const hipsVal  = parse(measurements.hips);

  // Weights (must sum to 1)
  const WEIGHTS = { chest: 0.40, waist: 0.40, hips: 0.20 } as const;

  const breakdown: AreaBreakdown[] = [];
  let weightedScore = 0;
  let usedWeight = 0;

  const areas: Array<{ key: 'chest' | 'waist' | 'hips'; label: string; val: number | null }> = [
    { key: 'chest', label: 'Chest / Bust', val: chestVal },
    { key: 'waist', label: 'Waist',        val: waistVal },
    { key: 'hips',  label: 'Hips',         val: hipsVal  },
  ];

  for (const { key, label, val } of areas) {
    if (val === null) continue;
    const result = scoreArea(val, sizeData[key], label);
    breakdown.push(result);
    weightedScore += result.score * WEIGHTS[key];
    usedWeight += WEIGHTS[key];
  }

  const maxWeight = WEIGHTS.chest + WEIGHTS.waist + WEIGHTS.hips; // 1.0
  const confidence = Math.round((usedWeight / maxWeight) * 100);
  const overallScore = usedWeight > 0 ? Math.round(weightedScore / usedWeight) : 0;

  // Fit label
  const label =
    overallScore >= 95 ? 'Perfect Fit' :
    overallScore >= 85 ? 'Great Fit'   :
    overallScore >= 75 ? 'Good Fit'    :
    overallScore >= 65 ? 'Fair Fit'    :
    overallScore >= 50 ? 'Poor Fit'    : 'Wrong Size';

  // Suggested size
  const measuredMap: Partial<Record<'chest' | 'waist' | 'hips', number>> = {};
  if (chestVal) measuredMap.chest = chestVal;
  if (waistVal) measuredMap.waist = waistVal;
  if (hipsVal)  measuredMap.hips  = hipsVal;
  const suggestedSize = findBestSize(measuredMap);

  // Recommendation text
  let recommendation: string;
  if (overallScore >= 85) {
    recommendation = `${label}! Size ${size} works great for your measurements.`;
  } else if (suggestedSize !== size) {
    recommendation = `Consider size ${suggestedSize} for a better fit based on your measurements.`;
  } else {
    const tightAreas = breakdown
      .filter(b => b.status === 'tight' || b.status === 'too-tight')
      .map(b => b.area);
    const looseAreas = breakdown
      .filter(b => b.status === 'too-loose')
      .map(b => b.area);

    const sizeIdx = SIZES_ORDERED.indexOf(size);
    if (tightAreas.length > 0) {
      const up = SIZES_ORDERED[sizeIdx + 1] ?? size;
      recommendation = `${tightAreas.join(' & ')} may feel tight. Size ${up} might suit you better.`;
    } else if (looseAreas.length > 0) {
      const down = SIZES_ORDERED[sizeIdx - 1] ?? size;
      recommendation = `${looseAreas.join(' & ')} may feel loose. Size ${down} might be a better fit.`;
    } else {
      recommendation = `Size ${size} should fit comfortably based on your measurements.`;
    }
  }

  return { score: overallScore, label, recommendation, suggestedSize, confidence, breakdown };
}
