'use client';

import { useEffect } from 'react';

const SITE_NAME = 'مرشح';
const DEFAULT_DESCRIPTION =
  'مرشح: الواجهة الرقمية الموحدة للمطاعم والمقاهي في السعودية — منيو تفاعلي، مساعد ذكاء اصطناعي للعملاء، عروض ترويجية، وأدوات نمو وتحليلات لصاحب المطعم، برابط واحد أو QR.';

function upsertMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertOgMeta(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Sets this page's <title> and meta description (+ matching Open Graph tags
 * for link previews) on mount. The SPA ships one static index.html with no
 * per-route metadata at all, so every page otherwise looks identical to
 * search engines and to link-unfurlers (WhatsApp, Twitter, etc).
 */
export function useDocumentMeta(title?: string, description: string = DEFAULT_DESCRIPTION) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;
    upsertMeta('description', description);
    upsertOgMeta('og:title', fullTitle);
    upsertOgMeta('og:description', description);
  }, [title, description]);
}
