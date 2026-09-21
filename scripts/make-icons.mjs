/**
 * Rasterises the brand SVGs in assets/brand/ into the PNGs Expo expects.
 *
 *   node scripts/make-icons.mjs
 *
 * Needs sharp, which is a build-time-only tool — install it on demand rather
 * than carrying it in the app's dependency tree:
 *   npm i -D sharp
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'assets', 'brand');
const assets = join(root, 'assets');

/** Solid-colour PNG, used for the adaptive icon's background layer. */
async function solid(hex, size, out) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: hex,
    },
  })
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function fromSvg(svgName, size, out) {
  const svg = await readFile(join(brand, svgName));
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}

await fromSvg('icon-full.svg', 1024, join(assets, 'icon.png'));
await fromSvg('icon-foreground.svg', 1024, join(assets, 'android-icon-foreground.png'));
await fromSvg('icon-monochrome.svg', 1024, join(assets, 'android-icon-monochrome.png'));
await fromSvg('icon-full.svg', 1024, join(assets, 'splash-icon.png'));
await fromSvg('icon-full.svg', 48, join(assets, 'favicon.png'));
await solid('#0B0B10', 1024, join(assets, 'android-icon-background.png'));
