// Menu Engineering Matrix — the standard restaurant-industry method (Kasavana
// & Smith) for classifying dishes by popularity × profitability. Splits items
// against the *average* of the set (not fixed thresholds), matching how the
// method is actually taught: a quiet café and a busy one both get a matrix
// that makes sense for their own volume.
export type MenuClassification = 'star' | 'plow-horse' | 'puzzle' | 'dog';

// Colors validated with the dataviz skill's palette validator for all-pairs
// (scatter) use: `validate_palette.js "#1baf7a,#2a78d6,#eda100,#e34948" --mode
// light --pairs all` → ALL CHECKS PASS. The CVD 6-8 floor band on the
// green/red pair is legal only with secondary encoding, which the matrix
// already has (quadrant zone labels + legend + per-point labels).
export const CLASSIFICATION_INFO: Record<MenuClassification, { labelKey: string; color: string; adviceKey: string }> = {
  star: {
    labelKey: 'menuEngineering.star',
    color: '#1baf7a',
    adviceKey: 'menuEngineering.starAdvice',
  },
  'plow-horse': {
    labelKey: 'menuEngineering.plowHorse',
    color: '#2a78d6',
    adviceKey: 'menuEngineering.plowHorseAdvice',
  },
  puzzle: {
    labelKey: 'menuEngineering.puzzle',
    color: '#eda100',
    adviceKey: 'menuEngineering.puzzleAdvice',
  },
  dog: {
    labelKey: 'menuEngineering.dog',
    color: '#e34948',
    adviceKey: 'menuEngineering.dogAdvice',
  },
};

export type EngineeredItem<T> = T & { classification: MenuClassification };

export function classifyMenuItems<T extends { popularity: number; profitMargin: number }>(
  items: T[]
): EngineeredItem<T>[] {
  if (items.length === 0) return [];
  const avgPopularity = items.reduce((s, i) => s + i.popularity, 0) / items.length;
  const avgMargin = items.reduce((s, i) => s + i.profitMargin, 0) / items.length;

  return items.map((item) => {
    const highPopularity = item.popularity >= avgPopularity;
    const highMargin = item.profitMargin >= avgMargin;
    let classification: MenuClassification;
    if (highPopularity && highMargin) classification = 'star';
    else if (highPopularity && !highMargin) classification = 'plow-horse';
    else if (!highPopularity && highMargin) classification = 'puzzle';
    else classification = 'dog';
    return { ...item, classification };
  });
}
