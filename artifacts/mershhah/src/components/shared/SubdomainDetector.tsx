'use client';

import { useEffect } from 'react';

const EXCLUDED_SUBDOMAINS = [
  'www', 'mail', 'ftp', 'smtp', 'pop', 'imap',
  'admin', 'owner', 'api', 'cdn', 'static',
  'app', 'dashboard', 'portal', 'staging', 'dev',
  'beta', 'test', 'demo', 'docs', 'blog',
];

export function getSubdomain(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;

  if (hostname === 'mershhah.com' || hostname === 'localhost') return null;

  const parts = hostname.split('.');
  if (parts.length < 3) return null;

  const subdomain = parts[0];

  if (EXCLUDED_SUBDOMAINS.includes(subdomain)) return null;

  return subdomain;
}

export function SubdomainDetector() {
  useEffect(() => {
    const subdomain = getSubdomain();
    if (subdomain) {
      window.location.replace(`/hub/${subdomain}`);
    }
  }, []);

  return null;
}
