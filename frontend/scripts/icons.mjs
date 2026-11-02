// The app icons are the official IYF Delhi emblem (see ../brand/README.md), never drawn by code.
// This copies them from ../brand into public/ (npm run icons).
import { copyFileSync } from 'node:fs';
const brand = new URL('../../brand/', import.meta.url), pub = new URL('../public/', import.meta.url);
for (const f of ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png']) copyFileSync(new URL('app-icons/' + f, brand), new URL('icons/' + f, pub));
for (const f of ['favicon-32.png', 'favicon-48.png', 'favicon-192.png', 'apple-touch-icon.png', 'og-image.jpg']) copyFileSync(new URL('web/' + f, brand), new URL('brand/' + f, pub));
console.log('icons copied from brand/');
