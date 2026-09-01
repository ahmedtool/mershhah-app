// Inline hex gradients, not Tailwind utility classes — a class name built
// from a DB value at runtime (e.g. `from-${name}-500`) is invisible to
// Tailwind's build-time scanner and would silently emit no CSS at all.
const GRADIENTS: Record<string, [string, string]> = {
  blue: ['#60a5fa', '#1d4ed8'],
  emerald: ['#34d399', '#047857'],
  green: ['#4ade80', '#15803d'],
  purple: ['#c084fc', '#7e22ce'],
  pink: ['#f472b6', '#be185d'],
  amber: ['#fbbf24', '#b45309'],
  yellow: ['#facc15', '#a16207'],
  red: ['#f87171', '#b91c1c'],
  indigo: ['#818cf8', '#4338ca'],
  teal: ['#2dd4bf', '#0f766e'],
  orange: ['#fb923c', '#c2410c'],
  cyan: ['#22d3ee', '#0e7490'],
  rose: ['#fb7185', '#be123c'],
  violet: ['#a78bfa', '#6d28d9'],
  primary: ['#4b5563', '#111827'],
  gray: ['#9ca3af', '#374151'],
};

export function colorNameFrom(twClass: string | undefined): string {
  const m = (twClass || '').match(/(?:text|bg)-([a-z]+)-\d+/);
  return m ? m[1] : 'primary';
}

export function toolGradient(tool: { color?: string; bg_color?: string }): string {
  const [from, to] = GRADIENTS[colorNameFrom(tool.color || tool.bg_color)] || GRADIENTS.primary;
  return `linear-gradient(135deg, ${from}, ${to})`;
}
