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
          g.strokeStyle = hex(c[5]);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(c[1] + 0.5, c[2] + 0.5);
          g.lineTo(c[3] + 0.5, c[4] + 0.5);
          g.stroke();
          break;
        case "rect":
          g.strokeStyle = hex(c[5]);
          g.lineWidth = 1;
          g.strokeRect(c[1] + 0.5, c[2] + 0.5, Math.max(0, c[3] - 1), Math.max(0, c[4] - 1));
          break;
        case "fillrect":
          g.fillStyle = hex(c[5]);
          g.fillRect(c[1], c[2], c[3], c[4]);
          break;
        case "circle":
        case "fillcircle":
          g.beginPath();
          g.arc(c[1] + 0.5, c[2] + 0.5, Math.max(0, c[3]), 0, 2 * Math.PI);
          if (c[0] === "circle") {
            g.strokeStyle = hex(c[4]);
            g.lineWidth = 1;
            g.stroke();
          } else {
            g.fillStyle = hex(c[4]);
            g.fill();
          }
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

  /** The colour of one pixel as 0xRRGGBB (tests). */
  pixel(x: number, y: number): number {
    const d = this.ctx.getImageData(x, y, 1, 1).data;
    return ((d[0] as number) << 16) | ((d[1] as number) << 8) | (d[2] as number);
  }
}
