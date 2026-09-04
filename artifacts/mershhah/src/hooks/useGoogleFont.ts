'use client';

import { useEffect } from 'react';

// The font actually loaded globally in index.html - loading it again here
// would just duplicate a request the browser already has cached.
const GLOBALLY_LOADED_FONT = 'IBM Plex Sans Arabic';

// Public-menu font choices only get their Google Fonts stylesheet fetched
// when a restaurant actually picked them (src/lib/public-theme.ts's
// FONT_OPTIONS) - loading every option on every page regardless of use was
// the exact waste Lighthouse flagged (fonts nobody's menu uses, shipped to
// every visitor of every page on the site).
const WEIGHTS: Record<string, string> = {
  Cairo: '400;500;600;700;800',
  Tajawal: '400;500;700;800',
};

/**
 * Injects the Google Fonts stylesheet for `fontFamily` if it's one of the
 * non-default public-menu font choices and isn't loaded yet. No-op for the
 * default font (already loaded globally) or an unrecognized value.
 */
export function useGoogleFont(fontFamily: string | null | undefined) {
  useEffect(() => {
    if (!fontFamily || fontFamily === GLOBALLY_LOADED_FONT) return;
    const weights = WEIGHTS[fontFamily];
    if (!weights) return;

    const id = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${weights}&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);
}
