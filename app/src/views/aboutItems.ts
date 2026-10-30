// SPDX-License-Identifier: GPL-3.0-or-later
// Settings › Help and about (R87, docs/05 3.4 section 7): About Pascaline (version, licence, source, credits) and the
// parts we use with their licences, each licence's full text a level that scrolls. The data is a lazy chunk
// (aboutData.svelte.ts); a level reads it when it is drawn and shows "Loading…" until it arrives.
import type { MenuItem, SubMenu } from "../apps/types.ts";
import { aboutText as t } from "../i18n/enAbout.ts";
import { aboutData, aboutLoading, type AboutData } from "./aboutData.svelte.ts";

export const REPO_URL = "https://github.com/buerlino/pascaline";
const LICENCE = "GPL-3.0-or-later";

const LOADING: MenuItem[] = [{ id: "loading", label: t("loading"), keep: true }];

/** A submenu whose rows are built on the first look at it, from the data (the placeholder row while it loads). */
function lazy(title: string, rows: (d: AboutData) => MenuItem[], extra?: Partial<SubMenu>): SubMenu {
  return {
    title,
    remember: false,
    ...extra,
    get items() {
      const d = aboutData();
      return d ? rows(d) : LOADING;
    },
    loading: aboutLoading,
  } as SubMenu;
}

/** A level that is a text to read. */
const textLevel = (id: string, text: string): SubMenu => ({ title: id, items: [], text, remember: false });

/** A licence's row: its text opens as a level; a licence without a file here says so and stays. */
function licenceRow(d: AboutData, id: string): MenuItem {
  const text = d.licences[id];
  return text === undefined
    ? { id, label: id, hint: t("noText"), keep: true }
    : { id, label: id, submenu: textLevel(id, text) };
}

/** The part's name without its parenthesis, and a version that starts with a digit up to its first "(" or ",". */
export function partLabel(name: string, version: string): string {
  const n = name.replace(/`/g, "").split(" (")[0] ?? name;
  const v = (version.split(/ \(|, /)[0] ?? "").replace(/`/g, "");
  return /^\d/.test(v) ? `${n} ${v}` : n;
}

function partRows(d: AboutData): MenuItem[] {
  return d.parts.map((p, i): MenuItem => {
    const label = partLabel(p.name, p.version);
    const known = p.ids.filter((id) => d.licences[id] !== undefined);
    const base = {
      id: `p${i}`,
      label,
      hint: p.licence,
      preview: `${p.copyright || t("copyright")}\n${p.source}`,
    };
    if (known.length === 0) return { ...base, keep: true };
    if (known.length === 1) return { ...base, submenu: textLevel(known[0] as string, d.licences[known[0] as string] as string) };
    return { ...base, submenu: { title: label, items: known.map((id) => licenceRow(d, id)), remember: false, longPreview: true } };
  });
}

function aboutRows(d: AboutData): MenuItem[] {
  return [
    { id: "version", label: t("version"), keep: true, value: d.version },
    { id: "licence", label: t("licence"), hint: LICENCE, submenu: textLevel(LICENCE, d.licences[LICENCE] ?? "") },
    { id: "source", label: t("source"), hint: REPO_URL, keep: true },
    { id: "credits", label: t("credits"), submenu: { title: t("credits"), items: [], text: t("credits.text"), remember: false } },
  ];
}

/** The rows of the Help and about section. (R15c4 adds "Show the first-start tips" above them.) */
export function helpItems(): MenuItem[] {
  return [
    { id: "about", label: t("title"), hint: t("hint"), submenu: lazy(t("aboutTitle"), aboutRows) },
    { id: "parts", label: t("parts"), hint: t("partsHint"), submenu: lazy(t("partsTitle"), partRows, { longPreview: true }) },
  ];
}
