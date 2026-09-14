'use client';
import { useEffect } from 'react';

// iOS Safari's rubber-band overscroll (dragging past the top/bottom of the
// page) reveals whatever sits behind the scrollable content - normally the
// default white <html>/<body> background - so pulling past the edge of a
// themed public page flashed plain white instead of the restaurant's own
// background color. Mirrors the same tint getPublicThemeStyle() applies to
// the page's own wrapper, but on the document root so it shows during
// overscroll too.
export function usePublicPageBackground(secondaryColor?: string | null) {
  useEffect(() => {
    const secondary = secondaryColor || '#f8fafc';
    const bg = `color-mix(in srgb, ${secondary} 25%, white)`;
    const root = document.documentElement;
    const prevRoot = root.style.background;
    const prevBody = document.body.style.background;
    root.style.background = bg;
    document.body.style.background = bg;
    return () => {
      root.style.background = prevRoot;
      document.body.style.background = prevBody;
    };
  }, [secondaryColor]);
}
