import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Supabase Storage object keys reject non-ASCII characters (Arabic file
// names, emoji, etc.) and some punctuation - upload paths built from a raw
// user-supplied file.name fail with "Invalid key" the moment the name has
// any of that. The original name is kept separately for display, so the
// storage path itself just needs to be a valid, collision-safe key.
export function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_')
}
