import { MOCK_USERS, MOCK_RESTAURANTS, MOCK_SUBSCRIPTIONS, MOCK_MENU_ITEMS, MOCK_OFFERS, MOCK_BRANCHES, MOCK_REVIEWS, MOCK_TOOLS, MOCK_PLANS, MOCK_APPLICATIONS, MOCK_TICKETS } from './mock-data';

// ── localStorage Keys ───────────────────────────────────────────────────────
const LS_SESSION = 'mershhah_mock_session';
const LS_PROFILES = 'mershhah_mock_profiles';
const LS_RESTAURANTS = 'mershhah_mock_restaurants';
const LS_SUBSCRIPTIONS = 'mershhah_mock_subscriptions';
const LS_MENU_ITEMS = 'mershhah_mock_menu_items';
const LS_OFFERS = 'mershhah_mock_offers';
const LS_BRANCHES = 'mershhah_mock_branches';
const LS_REVIEWS = 'mershhah_mock_reviews';
const LS_TOOLS = 'mershhah_mock_tools';
const LS_PLANS = 'mershhah_mock_plans';
const LS_ACTIVITIES = 'mershhah_mock_activities';
const LS_TICKETS = 'mershhah_mock_tickets';
const LS_ANNOUNCEMENTS = 'mershhah_mock_announcements';
const LS_STORAGE = 'mershhah_mock_storage';
const LS_PUBLIC_PAGES = 'mershhah_mock_public_pages';
const LS_APPLICATIONS = 'mershhah_mock_applications';
const LS_MENU_INTERACTIONS = 'mershhah_mock_menu_interactions';
const LS_HUB_VISITS = 'mershhah_mock_hub_visits';

// ── Helpers ─────────────────────────────────────────────────────────────────
function readStore<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function initStore() {
  if (!localStorage.getItem(LS_PROFILES)) {
    const profiles = Object.values(MOCK_USERS).map((u) => u.profile);
    writeStore(LS_PROFILES, profiles);
  }
  if (!localStorage.getItem(LS_RESTAURANTS)) writeStore(LS_RESTAURANTS, MOCK_RESTAURANTS);
  if (!localStorage.getItem(LS_SUBSCRIPTIONS)) writeStore(LS_SUBSCRIPTIONS, MOCK_SUBSCRIPTIONS);
  if (!localStorage.getItem(LS_MENU_ITEMS)) writeStore(LS_MENU_ITEMS, MOCK_MENU_ITEMS);
  if (!localStorage.getItem(LS_OFFERS)) writeStore(LS_OFFERS, MOCK_OFFERS);
  if (!localStorage.getItem(LS_BRANCHES)) writeStore(LS_BRANCHES, MOCK_BRANCHES);
  if (!localStorage.getItem(LS_REVIEWS)) writeStore(LS_REVIEWS, MOCK_REVIEWS);
  if (!localStorage.getItem(LS_TOOLS)) writeStore(LS_TOOLS, MOCK_TOOLS);
  if (!localStorage.getItem(LS_PLANS)) writeStore(LS_PLANS, MOCK_PLANS);
  if (!localStorage.getItem(LS_ACTIVITIES)) writeStore(LS_ACTIVITIES, []);
  const existingTickets = readStore(LS_TICKETS, []);
  const fixedTickets = existingTickets.map((t: any, i: number) => ({
    ...t,
    id: t.id || `ticket-old-${i}-${Date.now()}`,
  }));
  if (fixedTickets.length === 0) {
    writeStore(LS_TICKETS, MOCK_TICKETS);
  } else {
    writeStore(LS_TICKETS, fixedTickets);
  }
  if (!localStorage.getItem(LS_ANNOUNCEMENTS)) writeStore(LS_ANNOUNCEMENTS, []);
  if (!localStorage.getItem(LS_PUBLIC_PAGES)) writeStore(LS_PUBLIC_PAGES, []);
  if (!localStorage.getItem(LS_APPLICATIONS)) writeStore(LS_APPLICATIONS, MOCK_APPLICATIONS);
  if (!localStorage.getItem(LS_MENU_INTERACTIONS)) writeStore(LS_MENU_INTERACTIONS, []);
  if (!localStorage.getItem(LS_HUB_VISITS)) writeStore(LS_HUB_VISITS, []);
}

// Run on module load
initStore();

// ── Mock Storage Helpers ────────────────────────────────────────────────────
function readStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, string>) {
  try {
    localStorage.setItem(LS_STORAGE, JSON.stringify(data));
  } catch (e) {
    const keys = Object.keys(data);
    if (keys.length > 10) {
      const trimmed: Record<string, string> = {};
      const recent = keys.slice(-8);
      for (const k of recent) trimmed[k] = data[k];
      localStorage.setItem(LS_STORAGE, JSON.stringify(trimmed));
    }
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 400;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Auth State ──────────────────────────────────────────────────────────────
type AuthListener = (event: string, session: any) => void;
const authListeners: Set<AuthListener> = new Set();

function notifyAuth(event: string, session: any) {
  authListeners.forEach((cb) => cb(event, session));
}

function getSession() {
  try {
    const raw = localStorage.getItem(LS_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session: any) {
  if (session) {
    localStorage.setItem(LS_SESSION, JSON.stringify(session));
  } else {
    localStorage.removeItem(LS_SESSION);
  }
}

// ── Table Map ───────────────────────────────────────────────────────────────
const TABLE_LS_KEY: Record<string, string> = {
  profiles: LS_PROFILES,
  restaurants: LS_RESTAURANTS,
  subscriptions: LS_SUBSCRIPTIONS,
  menu_items: LS_MENU_ITEMS,
  offers: LS_OFFERS,
  branches: LS_BRANCHES,
  reviews: LS_REVIEWS,
  tools: LS_TOOLS,
  plans: LS_PLANS,
  activity: LS_ACTIVITIES,
  tickets: LS_TICKETS,
  support_tickets: LS_TICKETS,
  announcements: LS_ANNOUNCEMENTS,
  public_pages: LS_PUBLIC_PAGES,
  applications: LS_APPLICATIONS,
  menu_item_interactions: LS_MENU_INTERACTIONS,
  hub_visits: LS_HUB_VISITS,
};

// ── Query Builder ───────────────────────────────────────────────────────────
type FilterOp = { field: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like'; value: any };

class MockQueryBuilder {
  private table: string;
  private filters: FilterOp[] = [];
  private selectFields: string | null = null;
  private singleMode = false;
  private orderField: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: 'neq', value });
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push({ field, op: 'gt', value });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ field, op: 'gte', value });
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push({ field, op: 'lt', value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ field, op: 'lte', value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: 'in', value: values });
    return this;
  }

  like(field: string, pattern: string) {
    this.filters.push({ field, op: 'like', value: pattern });
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.singleMode = true;
    return this;
  }

  async then(resolve: any, reject?: any) {
    try {
      const result = this.execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else resolve({ data: null, error: { message: String(err) } });
    }
  }

  execute(): { data: any; error: any } {
    const lsKey = TABLE_LS_KEY[this.table];
    if (!lsKey) return { data: null, error: { message: `Unknown table: ${this.table}` } };

    let rows = readStore(lsKey, []);

    // Apply filters
    for (const f of this.filters) {
      rows = rows.filter((row: any) => {
        const val = row[f.field];
        switch (f.op) {
          case 'eq': return val === f.value;
          case 'neq': return val !== f.value;
          case 'gt': return val > f.value;
          case 'gte': return val >= f.value;
          case 'lt': return val < f.value;
          case 'lte': return val <= f.value;
          case 'in': return f.value.includes(val);
          case 'like': {
            const regex = new RegExp(f.value.replace(/%/g, '.*'), 'i');
            return regex.test(String(val));
          }
          default: return true;
        }
      });
    }

    // Order
    if (this.orderField) {
      rows.sort((a: any, b: any) => {
        const aVal = a[this.orderField!];
        const bVal = b[this.orderField!];
        if (aVal < bVal) return this.orderAsc ? -1 : 1;
        if (aVal > bVal) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    // Limit
    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    // Single mode
    if (this.singleMode) {
      if (rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      return { data: rows[0], error: null };
    }

    return { data: rows, error: null };
  }
}

class MockInsertBuilder {
  private table: string;
  private rows: any[] = [];

  constructor(table: string, data: any | any[]) {
    this.table = table;
    this.rows = Array.isArray(data) ? data : [data];
  }

  select(_fields: string = '*') {
    return this;
  }

  single() {
    return this;
  }

  async then(resolve: any) {
    const result = this.execute();
    resolve(result);
  }

  execute(): { data: any; error: any } {
    const lsKey = TABLE_LS_KEY[this.table];
    if (!lsKey) return { data: null, error: { message: `Unknown table: ${this.table}` } };

    const existing = readStore(lsKey, []);
    const rowsWithIds = this.rows.map((row) => ({
      id: row.id || `${this.table}-${crypto.randomUUID().slice(0, 8)}`,
      ...row,
    }));
    existing.push(...rowsWithIds);
    writeStore(lsKey, existing);

    return { data: rowsWithIds.length === 1 ? rowsWithIds[0] : rowsWithIds, error: null };
  }
}

class MockUpdateBuilder {
  private table: string;
  private updates: any;
  private filters: FilterOp[] = [];

  constructor(table: string, data: any) {
    this.table = table;
    this.updates = data;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: 'in', value: values });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: 'neq', value });
    return this;
  }

  select(_fields: string = '*') {
    return this;
  }

  single() {
    return this;
  }

  async then(resolve: any) {
    const result = this.execute();
    resolve(result);
  }

  execute(): { data: any; error: any } {
    const lsKey = TABLE_LS_KEY[this.table];
    if (!lsKey) return { data: null, error: { message: `Unknown table: ${this.table}` } };

    let rows = readStore(lsKey, []);
    let updated: any[] = [];

    rows = rows.map((row: any) => {
      const match = this.filters.every((f) => {
        const val = row[f.field];
        switch (f.op) {
          case 'eq': return val === f.value;
          case 'in': return Array.isArray(f.value) && f.value.includes(val);
          case 'neq': return val !== f.value;
          default: return true;
        }
      });
      if (match) {
        const newRow = { ...row, ...this.updates };
        updated.push(newRow);
        return newRow;
      }
      return row;
    });

    writeStore(lsKey, rows);
    return { data: updated.length === 1 ? updated[0] : updated, error: null };
  }
}

class MockDeleteBuilder {
  private table: string;
  private filters: FilterOp[] = [];

  constructor(table: string) {
    this.table = table;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: 'in', value: values });
    return this;
  }

  async then(resolve: any) {
    const result = this.execute();
    resolve(result);
  }

  execute(): { data: any; error: any } {
    const lsKey = TABLE_LS_KEY[this.table];
    if (!lsKey) return { data: null, error: { message: `Unknown table: ${this.table}` } };

    let rows = readStore(lsKey, []);
    const before = rows.length;

    rows = rows.filter((row: any) => {
      return !this.filters.every((f) => {
        if (f.op === 'in') return Array.isArray(f.value) && f.value.includes(row[f.field]);
        return row[f.field] === f.value;
      });
    });

    writeStore(lsKey, rows);

    return { data: null, error: null, count: before - rows.length };
  }
}

// ── Mock Supabase Client ────────────────────────────────────────────────────
export const mockSupabase = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const userEntry = MOCK_USERS[email];
      if (!userEntry || userEntry.password !== password) {
        return { data: { user: null, session: null }, error: { message: 'الإيميل أو كلمة المرور غير صحيحة.' } };
      }

      const profile = userEntry.profile;
      const session = { user: { id: profile.id, email: profile.email }, access_token: 'mock-token-' + Date.now() };
      setSession(session);
      notifyAuth('SIGNED_IN', session);

      return { data: { user: session.user, session }, error: null };
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
      const existing = MOCK_USERS[email];
      if (existing) {
        return { data: { user: null, session: null }, error: { message: 'البريد الإلكتروني مسجل مسبقاً.' } };
      }

      const userId = 'user-' + crypto.randomUUID().slice(0, 8);
      const fullName = options?.data?.full_name || email.split('@')[0];

      const newProfile = {
        id: userId,
        full_name: fullName,
        email,
        phone_number: null,
        role: email.includes('admin') ? 'admin' : 'owner',
        account_status: 'active' as const,
        restaurant_name: null,
        restaurant_id: null,
        admin_permissions: email.includes('admin')
          ? ['dashboard', 'management', 'financials', 'store-management', 'applications', 'announcements', 'support', 'team', 'workflow', 'sales']
          : [],
        ai_trial_used: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to store
      const profiles = readStore(LS_PROFILES, []);
      profiles.push(newProfile);
      writeStore(LS_PROFILES, profiles);

      // Also save to MOCK_USERS for future logins
      MOCK_USERS[email] = { password, profile: newProfile };

      const session = { user: { id: userId, email }, access_token: 'mock-token-' + Date.now() };
      setSession(session);
      notifyAuth('SIGNED_IN', session);

      return { data: { user: session.user, session }, error: null };
    },

    async getSession() {
      const session = getSession();
      return { data: { session }, error: null };
    },

    async signOut() {
      setSession(null);
      notifyAuth('SIGNED_OUT', null);
      return { error: null };
    },

    async resetPasswordForEmail(email: string) {
      if (MOCK_USERS[email]) {
        return { data: {}, error: null };
      }
      return { data: {}, error: null }; // Don't reveal if email exists
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  from(table: string) {
    return {
      select: (fields?: string) => new MockQueryBuilder(table).select(fields || '*'),
      insert: (data: any) => new MockInsertBuilder(table, data),
      update: (data: any) => new MockUpdateBuilder(table, data),
      delete: () => new MockDeleteBuilder(table),
      upsert: (data: any) => {
        const rows = Array.isArray(data) ? data : [data];
        const lsKey = TABLE_LS_KEY[table];
        if (!lsKey) return { data: null, error: { message: `Unknown table: ${table}` } };

        const existing = readStore(lsKey, []);
        for (const row of rows) {
          const idx = existing.findIndex((r: any) => r.id === row.id);
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...row };
          } else {
            existing.push(row);
          }
        }
        writeStore(lsKey, existing);
        return { data: rows.length === 1 ? rows[0] : rows, error: null };
      },
    };
  },

  channel(_name: string) {
    return {
      on: function () { return this; },
      subscribe: function (_cb?: any) { return this; },
    };
  },

  removeChannel(_ch: any) {},

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, options?: { upsert?: boolean }) {
          try {
            const dataUrl = await fileToDataUrl(file);
            const storage = readStorage();
            const key = `${bucket}/${path}`;
            
            if (storage[key] && !options?.upsert) {
              return { data: null, error: { message: 'File already exists' } };
            }
            
            storage[key] = dataUrl;
            writeStorage(storage);
            
            return { data: { path }, error: null };
          } catch (err) {
            return { data: null, error: { message: String(err) } };
          }
        },

        getPublicUrl(path: string) {
          const storage = readStorage();
          const key = `${bucket}/${path}`;
          const dataUrl = storage[key] || '';
          
          return { data: { publicUrl: dataUrl } };
        },

        remove(paths: string[]) {
          const storage = readStorage();
          for (const path of paths) {
            const key = `${bucket}/${path}`;
            delete storage[key];
          }
          writeStorage(storage);
          return { data: null, error: null };
        },
      };
    },
  },
};
