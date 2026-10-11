// SPDX-License-Identifier: GPL-3.0-or-later
// The Plot board on screen, for measurement code (FPS overlay, scripted zoom and pan in ?bench builds)
// and tests. Normal code never reads it.

export interface PlotBoardHandle {
  setBoundingBox(box: [number, number, number, number], keepAspectRatio?: boolean): unknown;
  getBoundingBox(): number[];
}

export const plotHook: { board: PlotBoardHandle | undefined } = { board: undefined };
