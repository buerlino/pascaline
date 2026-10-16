// SPDX-License-Identifier: GPL-3.0-or-later
// On-device probe for measurement builds only (VITE_MEASURE=1, started with ?bench=probe; see main.ts): does the WebView
// give us navigator.clipboard and navigator.share, and does it send pointercancel when the app leaves during a touch
// (A4a). A real tap (adb input tap) on the button is the user gesture both calls need. Output: PASCALINE_BENCH probe lines.
const log = (what: string, data: Record<string, unknown> = {}): void => {
  console.log(`PASCALINE_BENCH probe ${JSON.stringify({ what, t: Math.round(performance.now()), ...data })}`);
};
const msg = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

export function runDeviceProbe(): void {
  document.body.innerHTML = "";
  const btn = document.createElement("button");
  btn.textContent = "PROBE";
  btn.style.cssText = "position:fixed;left:0;top:0;width:100%;height:50%;font-size:48px;touch-action:none";
  const zone = document.createElement("div");
  zone.style.cssText = "position:fixed;left:0;top:50%;width:100%;height:50%;background:#cde;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none";
  zone.textContent = "touch zone";
  zone.addEventListener("contextmenu", (e) => e.preventDefault());
  document.body.append(btn, zone);
  log("env", {
    secure: isSecureContext,
    clipboard: typeof navigator.clipboard,
    writeText: typeof navigator.clipboard?.writeText,
    readText: typeof navigator.clipboard?.readText,
    share: typeof navigator.share,
    canShare: typeof navigator.canShare === "function" ? navigator.canShare({ text: "x" }) : null,
    ua: navigator.userAgent,
  });
  for (const type of ["pointerdown", "pointerup", "pointercancel", "pointerleave"])
    zone.addEventListener(type, (e) => log("pointer", { type, id: (e as PointerEvent).pointerId, pt: (e as PointerEvent).pointerType }));
  zone.addEventListener("lostpointercapture", () => log("lostpointercapture"));
  document.addEventListener("visibilitychange", () => log("visibility", { state: document.visibilityState }));
  addEventListener("blur", () => log("blur"));
  addEventListener("focus", () => log("focus"));
  addEventListener("pagehide", () => log("pagehide"));
  btn.addEventListener("click", () => {
    void (async () => {
      const text = "A4a clipboard probe 12345";
      try {
        await navigator.clipboard.writeText(text);
        log("writeText", { ok: true });
      } catch (e) {
        log("writeText", { ok: false, error: msg(e) });
      }
      try {
        const back = await navigator.clipboard.readText();
        log("readText", { ok: true, same: back === text, got: back.slice(0, 40) });
      } catch (e) {
        log("readText", { ok: false, error: msg(e) });
      }
      try {
        const p = navigator.share({ text: "A4a share probe" });
        log("share-called");
        await p;
        log("share", { ok: true });
      } catch (e) {
        log("share", { ok: false, error: msg(e) });
      }
    })();
  });
  log("ready");
}
