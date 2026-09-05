// Vercel serverless function for every /api/* request, reached via the
// explicit rewrite in vercel.json ("/api/:path*" -> "/api/handler") rather
// than relying on this file's own name for routing — a bracket catch-all
// filename here ([...path].ts) only ever matched a single path segment in
// this project (e.g. /api/foo worked, /api/foo/bar 404'd at the edge
// before reaching this function at all, confirmed live against multiple
// fresh, never-cached URLs). The rewrite sidesteps that entirely: Vercel
// resolves the rewrite target as a fixed function path, and req.url still
// carries the real original path through to the Express app below.
//
// Handed to the same Express app artifacts/api-server runs locally via
// `pnpm start`, built by its own esbuild config (see build.mjs) into
// dist/app.mjs — a plain bundled Express app with no `.listen()` call.
// vercel.json's buildCommand runs that build before Vercel packages this
// function, since dist/ isn't committed to git.
//
// Must be a dynamic import(), not a static one: Vercel compiles this file
// to CommonJS (no "type": "module" at the repo root), and a static
// `import` gets transpiled to `require()`, which cannot load dist/app.mjs
// — a real ES module — throwing ERR_REQUIRE_ESM (also confirmed live). A
// dynamic import() is left untouched by that transpilation.
let appPromise: Promise<(req: any, res: any) => void> | undefined;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    // @ts-ignore - dist/app.mjs is esbuild output with no declaration file
    appPromise = import("../artifacts/api-server/dist/app.mjs").then((m: any) => m.default);
  }
  const app = await appPromise;
  return app(req, res);
}
