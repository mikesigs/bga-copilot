import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const outdir = "dist";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// The service worker is declared with "type": "module" in the manifest, so it
// can use ESM. Content scripts and the side panel page are loaded as classic
// scripts by Chrome — bundle those as IIFEs so there's no bare import/export
// syntax left for the browser to choke on.
await esbuild.build({
  entryPoints: { background: "src/background.ts" },
  bundle: true,
  outdir,
  format: "esm",
  target: "chrome110",
  sourcemap: true,
});

await esbuild.build({
  entryPoints: {
    content: "src/content.ts",
    sidepanel: "src/sidepanel/index.ts",
  },
  bundle: true,
  outdir,
  format: "iife",
  target: "chrome110",
  sourcemap: true,
});

cpSync("manifest.json", `${outdir}/manifest.json`);
cpSync("src/sidepanel/index.html", `${outdir}/sidepanel.html`);
cpSync("src/sidepanel/style.css", `${outdir}/style.css`);

console.log("Build complete ->", outdir);
