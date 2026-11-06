// SPDX-License-Identifier: GPL-3.0-or-later
// R140: how far apart two colours are for a person with a colour-vision deficiency. Machado, Oliveira & Fernandes (2009)
// matrices at severity 1, applied in linear RGB (clamped to 0..1), then the Euclidean distance in OKLab (Ottosson).
// Used by the theme test (Shift against Alpha, ⚠ against Shift); the report gives the same formula.

export type Mat = readonly [readonly number[], readonly number[], readonly number[]];
export const CVD: Record<string, Mat> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (h: string): number[] => [1, 3, 5].map((i) => {
  const s = parseInt(h.slice(i, i + 2), 16) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});
/** OKLab (Ottosson) of a linear RGB triple. */
function oklab([r, g, b]: number[]): number[] {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const sim = (rgb: number[], m: Mat | null): number[] => (m === null ? rgb : m.map((row) => Math.min(1, Math.max(0, row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!))));
/** OKLab distance of two #rrggbb colours as seen through a colour-vision matrix (null: normal vision). */
export function apart(a: string, b: string, m: Mat | null = null): number {
  const [p, q] = [oklab(sim(lin(a), m)), oklab(sim(lin(b), m))];
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}

