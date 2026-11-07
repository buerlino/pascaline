// SPDX-License-Identifier: GPL-3.0-or-later
// The drawn icons of the views (R82f2 status line, R83 Menu title): fixed markup, no user text, drawn through {@html}.
const svg = (body: string): string => `<svg viewBox="0 0 16 14" fill="none" stroke="currentColor" stroke-width="1.4">${body}</svg>`;

export const ICONS = {
  home: svg('<path d="M2.5 7.5 8 2.5l5.5 5M4 6.5v6h8v-6" stroke-linejoin="round"/>'),
  cas: '<span class="math">∫</span>',
  symb: '<span class="math">ƒ=</span>',
  plot: svg('<path d="M1 13h14M2 1v12"/><path d="M3 11c3-9 6-9 11-8" stroke-width="1.6" stroke-linecap="round"/>'),
  num: svg('<rect x="1" y="1" width="14" height="12" rx="1.5"/><path d="M6 1v12M1 5h14M1 9h14"/>'),
} as const;

export type IconId = keyof typeof ICONS;
