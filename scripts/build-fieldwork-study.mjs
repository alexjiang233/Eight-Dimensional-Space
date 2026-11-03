import { loadCatalog } from '../site/content-loader.mjs';
import { mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSite,
  validateCatalog,
} from "../site/render.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "site");
const option = (name) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = resolve(root, option('output') || '.local-run/site');
const assets = option('assets-dir') ? resolve(root, option('assets-dir')) : null;
// --base=/Eight-Dimensional-Space/ emits URLs for a GitHub Pages project site.
// Default "/" keeps local preview and the test suite on the root path.
const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const base = baseArg ? baseArg.slice("--base=".length) || "/" : "/";
const mount = base === "/" ? "" : base.endsWith("/") ? base.slice(0, -1) : base;
const data = await loadCatalog();
validateCatalog(data);
for (const media of data.media) {
  if (media.kind === "embed") continue;
  const file = assets ? join(assets, media.src.slice(1)) : media.src.startsWith("/photos/")
    ? join(root, ".local-run/photo-site/media", media.src.slice(8))
    : media.src.startsWith("/media/")
    ? join(root, ".local-run/case-study/media", media.src.slice(7))
    : join(root, ".local-run/opening-study/media", media.src.slice(7));
  await stat(file);
  if (assets) {
    const target = join(output, media.src.slice(1));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  }
}
if (assets) {
  const fontDir = join(output, 'fonts/fieldwork');
  await mkdir(fontDir, { recursive: true });
  for (const name of ['sans.woff2', 'OFL.txt'])
    await copyFile(join(assets, 'fonts/fieldwork', name), join(fontDir, name));
}
const pages = createSite(data, { base });
for (const [url, html] of pages) {
  const target = join(output, url, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
for (const name of [
  "app.css",
  "editorial.css",
  "app.js",
  "responsive.html",
])
  await copyFile(join(source, name), join(output, name));
await writeFile(
  join(output, "index.html"),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${mount}/editorial/"><title>八维空间</title><a href="${mount}/editorial/">进入八维空间</a></html>`,
);
await writeFile(
  join(output, "route-manifest.json"),
  JSON.stringify(
    {
      routes: [...pages.keys()],
      base: mount || "/",
      events: data.events.length,
      works: data.works.length,
      members: data.members.length,
    },
    null,
    2,
  ),
);
await writeFile(join(output, '.nojekyll'), '');
await writeFile(join(output, '404.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到 · 八维空间</title><h1>页面未找到</h1><p>页面可能已调整位置。</p><a href="${mount}/editorial/">返回首页</a></html>`);
console.log(
  `Built ${pages.size} pages, ${data.events.length} events, ${data.works.length} works, ${data.members.length} credited people (base "${mount || "/"}").`,
);
