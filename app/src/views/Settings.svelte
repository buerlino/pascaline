<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { AngleUnit, NumberFormat } from "../calc/port.ts";
  import { t } from "../i18n/index.ts";
  import type { EntryMode, Session } from "../state/session.svelte.ts";

  let { session }: { session: Session } = $props();
</script>

<div class="scrim" role="presentation">
  <div class="panel" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
    <h2>{t("settings.title")}</h2>

    <label>
      <span>{t("settings.digits")}</span>
      <input
        type="number"
        min="1"
        max="15"
        inputmode="none"
        value={session.settings.digits}
        onchange={(e) => session.setDigits(Number(e.currentTarget.value))}
      />
    </label>

    <label>
      <span>{t("settings.angle")}</span>
      <select value={session.settings.angle} onchange={(e) => session.setAngle(e.currentTarget.value as AngleUnit)}>
        <option value="rad">{t("settings.angle.rad")}</option>
        <option value="deg">{t("settings.angle.deg")}</option>
      </select>
    </label>

    <label>
      <span>{t("settings.format")}</span>
      <select value={session.settings.format} onchange={(e) => session.setFormat(e.currentTarget.value as NumberFormat)}>
        <option value="std">{t("settings.format.std")}</option>
        <option value="sci">{t("settings.format.sci")}</option>
        <option value="eng">{t("settings.format.eng")}</option>
      </select>
    </label>

    <label>
      <span>{t("settings.entry")}</span>
      <select value={session.settings.entry} onchange={(e) => session.setEntry(e.currentTarget.value as EntryMode)}>
        <option value="textbook">{t("settings.entry.textbook")}</option>
        <option value="line">{t("settings.entry.line")}</option>
      </select>
    </label>

    <button type="button" class="close" onclick={() => (session.settingsOpen = false)}>{t("settings.close")}</button>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .panel {
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px 20px;
    width: min(92vw, 420px);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  select,
  input {
    font: inherit;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 8px;
    max-width: 55%;
  }
  input {
    width: 5em;
  }
  .close {
    align-self: flex-end;
    font: inherit;
    padding: 8px 16px;
    border-radius: 8px;
    border: 0;
    background: var(--key-enter);
    color: #fff;
  }
</style>
