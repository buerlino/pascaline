// SPDX-License-Identifier: GPL-3.0-or-later
// A49: a new version of the web build waits. src/pwa.ts (a lazy chunk) sets `restart`; the status line (App.svelte)
// shows its Restart button while it is set. Only a tap on that button calls it. Set again, the newest worker wins.
export const updateOffer = $state<{ restart: (() => void) | null }>({ restart: null });
