declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// gtag is loaded async from index.html and may not exist yet (or ever, if
// blocked by an ad/tracker blocker) - every call here has to be defensive.
export function trackPageView(path: string, title: string) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title,
  });
}

export {};
