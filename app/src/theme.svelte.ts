// SPDX-License-Identifier: GPL-3.0-or-later
// The brightness the page is in (index.html sets data-brightness on <html>; R50e will change it from Settings).
let current = $state<"dark" | "light">(document.documentElement.dataset["brightness"] === "light" ? "light" : "dark");
new MutationObserver(() => {
  current = document.documentElement.dataset["brightness"] === "light" ? "light" : "dark";
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-brightness"] });
export const brightness = (): "dark" | "light" => current;
