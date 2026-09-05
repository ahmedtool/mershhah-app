// Vercel serverless function catching every /api/* request and handing it
// to the same Express app artifacts/api-server runs locally via `pnpm start`.
// Built by artifacts/api-server's own esbuild config (see build.mjs) into
// dist/app.mjs — a plain bundled Express app with no `.listen()` call, safe
// to import directly here. vercel.json's buildCommand runs that build before
// Vercel packages this function, since dist/ isn't committed to git.
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
