// SPDX-License-Identifier: GPL-3.0-or-later
// App icons and splash screens from the project logo (logo/pascaline_back.svg + logo/pascaline_front.svg,
// a 108×108 Android adaptive-icon pair: solid background, mark inside the 66-unit safe circle).
// Writes the PWA icons (app/public/icons/) and the Android launcher icons and splash screens
// (android/app/src/main/res/). Run after changing the logo: node scripts/gen-icons.mjs
// Needs rsvg-convert (librsvg) on the PATH; the generated files are committed, so builds don't need it.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const pwa = join(root, "app/public/icons");
const res = join(root, "android/app/src/main/res");

/** The drawing inside a logo file's root <svg>, with the root's style (fill-rule, line caps) kept on a group. */
function layer(file) {
  const svg = readFileSync(join(root, "logo", file), "utf8");
  const open = /<svg\b[^>]*>/.exec(svg);
  if (!open) throw new Error(`${file}: no <svg> element`);
  const style = /\bstyle="([^"]*)"/.exec(open[0])?.[1] ?? "";
  const body = svg.slice(open.index + open[0].length, svg.lastIndexOf("</svg>"));
  return `<g style="${style}">${body}</g>`;
}
const back = layer("pascaline_back.svg");
const front = layer("pascaline_front.svg");
const bgColour = /fill:\s*(rgb\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(back)?.[1];
if (!bgColour) throw new Error("pascaline_back.svg: no fill colour");

const XMLNS = 'xmlns="http://www.w3.org/2000/svg" xmlns:serif="http://www.serif.com/"';

/** The logo cropped to `view` (x, y, size in the 108 grid); `round` clips it to a circle. */
function icon(view, { round = false, layers = [back, front] } = {}) {
  const [x, y, s] = view;
  const clip = round ? `<clipPath id="c"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s / 2}"/></clipPath>` : "";
  return `<svg ${XMLNS} viewBox="${x} ${y} ${s} ${s}">${clip}<g${round ? ' clip-path="url(#c)"' : ""}>${layers.join("")}</g></svg>`;
}

/** A w×h splash: the background colour with the 108 grid drawn at half the shorter side, centred. */
function splash(w, h) {
  const c = Math.min(w, h) / 2;
  return `<svg ${XMLNS} viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" style="fill:${bgColour}"/><svg x="${(w - c) / 2}" y="${(h - c) / 2}" width="${c}" height="${c}" viewBox="0 0 108 108">${front}</svg></svg>`;
}

function png(svg, w, h, out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, execFileSync("rsvg-convert", ["-w", String(w), "-h", String(h)], { input: svg }));
}

// PWA: "any" icons show the launcher's visible 72-unit square; the maskable one keeps the mark inside
// the 40 % safe radius (mark radius 32.5 of a 90-unit crop = 36 %).
const visible = [18, 18, 72];
writeFileSync(
  join(pwa, "icon.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- SPDX-License-Identifier: GPL-3.0-or-later -->\n<!-- Generated from logo/ by app/scripts/gen-icons.mjs; edit the logo, not this file. -->\n${icon(visible)}\n`,
);
png(icon(visible), 192, 192, join(pwa, "icon-192.png"));
png(icon(visible), 512, 512, join(pwa, "icon-512.png"));
png(icon([9, 9, 90]), 512, 512, join(pwa, "icon-maskable-512.png"));

// Android: adaptive foreground (108 dp) per density, legacy square and round icons (48 dp) for API 24-25.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  png(icon([0, 0, 108], { layers: [front] }), 108 * k, 108 * k, join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  png(icon(visible), 48 * k, 48 * k, join(res, `mipmap-${d}/ic_launcher.png`));
  png(icon(visible, { round: true }), 48 * k, 48 * k, join(res, `mipmap-${d}/ic_launcher_round.png`));
}
const [r, g, b] = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(bgColour)?.slice(1).map(Number) ?? [];
const hex = bgColour.startsWith("#") ? bgColour : `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
writeFileSync(
  join(res, "values/ic_launcher_background.xml"),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${hex}</color>\n</resources>\n`,
);

// Splash screens, at the sizes the Capacitor template uses.
const splashes = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
png(splash(480, 320), 480, 320, join(res, "drawable/splash.png"));
for (const [d, [w, h]] of Object.entries(splashes)) {
  png(splash(w, h), w, h, join(res, `drawable-land-${d}/splash.png`));
  png(splash(h, w), h, w, join(res, `drawable-port-${d}/splash.png`));
}
