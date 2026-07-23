'use client';

import { useEffect, useState } from 'react';

/**
 * Renders children only after mount to avoid hydration mismatch between server
 * and client (e.g. theme, auth, or browser-only APIs).
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Server and first client render: same placeholder (key ensures React doesn't hydrate children)
  if (!mounted) {
    return <div key="hydration-placeholder" className="min-h-screen w-full bg-background" suppressHydrationWarning />;
  }

  // After mount: render content in a new key so it mounts fresh (no hydration of this tree)
  return (
    <div key="hydration-content" suppressHydrationWarning>
      {children}
    </div>
  );
}
