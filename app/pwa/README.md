# pwa/

`sw.js` is the offline worker's template (`vite-plugin-pwa-lite.ts` fills it in and writes `dist/sw.js`). `kill/sw.js` is the kill switch for a deployed worker that misbehaves.

**Switch it off:** run the Pages workflow by hand on the deployed tag with the input `kill` set (the run refuses any ref that is not a tag, in its first step, with the message "A kill run needs the release tag"; the `github-pages` environment's tag rule applies too):

```
gh workflow run pages --ref v0.1.0 -f kill=true
```

The run builds the tag and checks its version (the golden gate is skipped: the tag passed it, and a slow runner must not block the switch-off), then copies `app/pwa/kill/sw.js` over `app/dist/sw.js` before the upload (a run takes as long as a deploy, up to 90 minutes; watch it with `gh run watch`). Each browser's next update check installs the kill worker; it deletes our caches and unregisters, and the next load comes from the network.

**Put the real worker back:** fix the cause, tag the fix, and let the normal tag run deploy (or `gh workflow run pages --ref <fixed tag>` without `kill`). Its `dist/sw.js` has a new cache name, so browsers install it again.
