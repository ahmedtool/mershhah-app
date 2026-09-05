'use client';

import { useEffect, useState } from 'react';
import { FullScreenLoader } from './FullScreenLoader';

/**
 * Renders children only after mount to avoid hydration mismatch between server
 * and client (e.g. theme, auth, or browser-only APIs).
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Same loader as the route/auth gates further down the tree, so this
  // first-paint tick doesn't read as a separate blank screen before "the"
  // loading screen shows up.
  if (!mounted) {
    return <div key="hydration-placeholder" suppressHydrationWarning><FullScreenLoader /></div>;
  }

  // After mount: render content in a new key so it mounts fresh (no hydration of this tree)
  return (
    <div key="hydration-content" suppressHydrationWarning>
      {children}
    </div>
  );
}
