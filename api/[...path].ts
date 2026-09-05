// Vercel serverless function catching every /api/* request and handing it
// to the same Express app artifacts/api-server runs locally via `pnpm start`.
// Built by artifacts/api-server's own esbuild config (see build.mjs) into
// dist/app.mjs — a plain bundled Express app with no `.listen()` call.
// vercel.json's buildCommand runs that build before Vercel packages this
// function, since dist/ isn't committed to git.
//
// This must be a dynamic import(), not a static one: Vercel compiles this
// file to CommonJS (no "type": "module" at the repo root), and a static
// `import` gets transpiled to `require()`, which cannot load dist/app.mjs
// — a real ES module — throwing ERR_REQUIRE_ESM. Confirmed live. A dynamic
// import() is left untouched by that transpilation and works from CommonJS.
let appPromise: Promise<(req: any, res: any) => void> | undefined;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    // @ts-ignore - dist/app.mjs is esbuild output with no declaration file
    appPromise = import("../artifacts/api-server/dist/app.mjs").then((m: any) => m.default);
  }
  const app = await appPromise;
  return app(req, res);
}
