import { Box, Sparkles, CalendarDays, FileSpreadsheet, Truck, Coins, type LucideIcon } from 'lucide-react';

// A store tool's icon name (tools.icon) is free text chosen by an admin, but
// only ever set to one of these values today. Importing lucide-react's full
// `icons` barrel just to look one up by name pulled in every icon in the
// library (~100KB of unused JS) - this explicit map keeps the same dynamic
// lookup while only bundling the icons actually in use. A tool with a name
// not listed here falls back to Box, same as before.
export const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  Box,
  Sparkles,
  CalendarDays,
  FileSpreadsheet,
  Truck,
  Coins,
};

export function getToolIcon(name: string | null | undefined): LucideIcon {
  return (name && TOOL_ICON_MAP[name]) || Box;
}
