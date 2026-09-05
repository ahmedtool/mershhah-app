// One-off backfill: move existing owner-hosted images (menu item photos,
// offer images, restaurant logos) from Supabase Storage to ImageKit, so old
// and new images all live in one place, each restaurant under its own
// restaurants/<id>/... folder (same layout new uploads already use).
// Admin-owned content (store tools, shared products, delivery-app logos)
// is untouched.
//
// Gets its ImageKit upload signature from the live /api/imagekit/auth
// route instead of needing IMAGEKIT_PRIVATE_KEY locally - only Supabase
// service-role access is needed on this machine.
//
// Usage (from artifacts/api-server):
//   node --env-file=.env scripts/backfill-imagekit.mjs --dry-run
//   node --env-file=.env scripts/backfill-imagekit.mjs
//
// Dry-run only counts rows and prints what would happen — no writes.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_ENDPOINT = process.env.IMAGEKIT_AUTH_ENDPOINT || "https://www.mershhah.com/api/imagekit/auth";
const BUCKET = "restaurant-assets";
const DRY_RUN = process.argv.includes("--dry-run");

function isLegacyPath(value) {
  return !!value && !value.startsWith("http") && !value.startsWith("blob:");
}

function publicSupabaseUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function supabaseSelect(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`select ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update ${table}#${id} failed: ${res.status} ${await res.text()}`);
}

async function getAuthParams() {
  const res = await fetch(AUTH_ENDPOINT);
  if (!res.ok) throw new Error(`imagekit auth failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadToImageKitFromUrl(sourceUrl, folder, fileName) {
  const { token, expire, signature, publicKey } = await getAuthParams();
  const form = new FormData();
  form.append("file", sourceUrl);
  form.append("fileName", fileName);
  form.append("publicKey", publicKey);
  form.append("signature", signature);
  form.append("expire", String(expire));
  form.append("token", token);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");
  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ImageKit upload failed: ${JSON.stringify(data)}`);
  return data.url;
}

async function migrate({ table, select, urlField, idField, folderOf }) {
  const rows = await supabaseSelect(table, `select=${select}&${urlField}=not.is.null`);
  const legacy = rows.filter((r) => isLegacyPath(r[urlField]));
  console.log(`\n${table}.${urlField}: ${rows.length} total, ${legacy.length} still on Supabase`);

  if (DRY_RUN || legacy.length === 0) return { total: rows.length, legacy: legacy.length, ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;
  for (const row of legacy) {
    try {
      const sourceUrl = publicSupabaseUrl(row[urlField]);
      const fileName = row[urlField].split("/").pop() || `${row[idField]}.jpg`;
      const newUrl = await uploadToImageKitFromUrl(sourceUrl, folderOf(row), fileName);
      await supabaseUpdate(table, row[idField], { [urlField]: newUrl });
      ok++;
      console.log(`  ok    ${table}#${row[idField]}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${table}#${row[idField]}:`, err.message);
    }
  }
  return { total: rows.length, legacy: legacy.length, ok, failed };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

  console.log(DRY_RUN ? "=== DRY RUN (no writes) ===" : "=== LIVE RUN (writing) ===");

  const menuItems = await migrate({
    table: "menu_items",
    select: "id,image_url,restaurant_id",
    urlField: "image_url",
    idField: "id",
    folderOf: (r) => `restaurants/${r.restaurant_id}/menu_items`,
  });

  const offers = await migrate({
    table: "offers",
    select: "id,image_url,restaurant_id",
    urlField: "image_url",
    idField: "id",
    folderOf: (r) => `restaurants/${r.restaurant_id}/offers`,
  });

  const logos = await migrate({
    table: "restaurants",
    select: "id,logo",
    urlField: "logo",
    idField: "id",
    folderOf: (r) => `restaurants/${r.id}`,
  });

  console.log("\nSummary:", { menuItems, offers, logos });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
