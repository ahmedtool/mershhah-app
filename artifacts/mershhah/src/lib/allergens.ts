// Shared between the owner's edit-item allergen picker and the public
// menu's allergen badges, so both always agree on the same fixed set of
// ids/icons/labels - a menu_items.allergens value is one of these ids,
// resolved to a label via t(labelKey) rather than stored as display text,
// which is what makes it render correctly in both Arabic and English.
export const ALLERGEN_META = [
  { id: 'nuts', labelKey: 'menuItem.allergenNuts', icon: '🥜' },
  { id: 'milk', labelKey: 'menuItem.allergenMilk', icon: '🥛' },
  { id: 'eggs', labelKey: 'menuItem.allergenEggs', icon: '🥚' },
  { id: 'wheat', labelKey: 'menuItem.allergenWheat', icon: '🌾' },
  { id: 'fish', labelKey: 'menuItem.allergenFish', icon: '🐟' },
  { id: 'shellfish', labelKey: 'menuItem.allergenShellfish', icon: '🦐' },
  { id: 'soy', labelKey: 'menuItem.allergenSoy', icon: '🫘' },
  { id: 'sesame', labelKey: 'menuItem.allergenSesame', icon: '⚪' },
  { id: 'gluten', labelKey: 'menuItem.allergenGluten', icon: '🍞' },
] as const;
