// SPDX-License-Identifier: GPL-3.0-or-later
// The update line (A49): a new version of the web build has installed and waits. pwa.ts sets `ready` and `restart` once
// the service worker reports it; App.svelte shows the line while `ready` holds. Nothing here reloads the page: only
// the Restart button does, so the code is never replaced under a user who is typing.
export const updateLine: { ready: boolean; restart: () => void } = $state({ ready: false, restart: () => {} });
