const STORAGE_KEY = 'mershhah_visitor_id';

// A random id persisted in this browser's localStorage so repeat visits
// from the same browser can be told apart from genuinely different
// visitors when counting hub_visits - it's a soft signal, not a real
// identity: a different device/browser, private window, or cleared
// storage looks like a brand-new visitor. Chosen over IP-based dedup
// because most visitors open the QR link on mobile data behind
// carrier-grade NAT, where many unrelated people can share one public IP.
export function getVisitorId(): string | null {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
