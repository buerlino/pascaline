// SPDX-License-Identifier: GPL-3.0-or-later
// The Python graphics surface: 320×240 pixels, origin top-left, y down, colours 0xRRGGBB, white at start
// (app/src/python/types.ts). It draws the worker's batched command stream. The canvas element lives as long
// as the app, so drawing goes on while another view is shown; the Plot view only shows it, scaled to fit.
import { GFX_HEIGHT, GFX_WIDTH, type GfxCmd } from "../../python/types.ts";

const hex = (c: number): string => `#${(c & 0xffffff).toString(16).padStart(6, "0")}`;
/** Text sizes in pixels on the 320×240 surface (our choice; the reference's are a G2 question). */
const FONT_PX = { small: 10, medium: 14, large: 18 } as const;

export class GfxSurface {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Commands drawn so far (tests and the bench read it). */
  drawn = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = GFX_WIDTH;
    this.canvas.height = GFX_HEIGHT;
    this.canvas.dataset["testid"] = "py-canvas";
    this.ctx = this.canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    this.ctx.imageSmoothingEnabled = false;
    this.clear(0xffffff);
  }

  clear(c: number): void {
    this.ctx.fillStyle = hex(c);
    this.ctx.fillRect(0, 0, GFX_WIDTH, GFX_HEIGHT);
  }

  draw(batch: readonly GfxCmd[]): void {
    const g = this.ctx;
    for (const c of batch) {
      switch (c[0]) {
        case "clear":
          this.clear(c[1]);
          break;
        case "pixel":
          g.fillStyle = hex(c[3]);
          g.fillRect(c[1], c[2], 1, 1);
          break;
        case "line":
          g.fillStyle = hex(c[5]);
          this.line(c[1], c[2], c[3], c[4]);
          break;
        case "rect":
          g.fillStyle = hex(c[5]);
          if (c[3] > 0 && c[4] > 0) {
            g.fillRect(c[1], c[2], c[3], 1);
            g.fillRect(c[1], c[2] + c[4] - 1, c[3], 1);
            g.fillRect(c[1], c[2], 1, c[4]);
            g.fillRect(c[1] + c[3] - 1, c[2], 1, c[4]);
          }
          break;
        case "fillrect":
          g.fillStyle = hex(c[5]);
          g.fillRect(c[1], c[2], c[3], c[4]);
          break;
        case "circle":
        case "fillcircle":
          g.fillStyle = hex(c[4]);
          this.circle(c[1], c[2], c[3], c[0] === "fillcircle");
          break;
        case "text":
          g.fillStyle = hex(c[4]);
          g.font = `${FONT_PX[c[5]]}px system-ui, sans-serif`;
          g.textBaseline = "top";
          g.fillText(c[3], c[1], c[2]);
          break;
        case "show":
          break;
      }
      this.drawn++;
    }
  }

  /** Bresenham: whole pixels, both ends included, no anti-aliasing (crisp like a calculator screen). */
  private line(x0: number, y0: number, x1: number, y1: number): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4096; n++) {
      this.ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Midpoint circle of radius r around (cx, cy); filled with horizontal spans. */
  private circle(cx: number, cy: number, r: number, fill: boolean): void {
    cx = Math.round(cx);
    cy = Math.round(cy);
    r = Math.round(r);
    if (r < 0) return;
    const g = this.ctx;
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      if (fill) {
        g.fillRect(cx - x, cy + y, 2 * x + 1, 1);
        g.fillRect(cx - x, cy - y, 2 * x + 1, 1);
        g.fillRect(cx - y, cy + x, 2 * y + 1, 1);
        g.fillRect(cx - y, cy - x, 2 * y + 1, 1);
      } else
        for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]] as const)
          g.fillRect(cx + px, cy + py, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }

  /** The colour of one pixel as 0xRRGGBB (tests). */
  pixel(x: number, y: number): number {
    const d = this.ctx.getImageData(x, y, 1, 1).data;
    return ((d[0] as number) << 16) | ((d[1] as number) << 8) | (d[2] as number);
  }
}
