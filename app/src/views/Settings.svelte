<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import type { AngleUnit, NumberFormat } from "../calc/port.ts";
  import { t, type MessageKey } from "../i18n/index.ts";
  import { hasStrength } from "../input/haptics.ts";
  import { FMT_MODES } from "../state/displayMode.ts";
  import { HAPTIC_MS_RANGE, type EntryMode, type Session } from "../state/session.svelte.ts";

  let { session }: { session: Session } = $props();
  const strengthAvailable = hasStrength();
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

    <fieldset data-testid="fmt-cycle">
      <legend>{t("settings.fmtCycle")}</legend>
      {#each FMT_MODES as mode (mode)}
        <label class="check">
          <input
            type="checkbox"
            data-mode={mode}
            checked={session.settings.fmtCycle.includes(mode)}
            onchange={(e) => session.setFmtMode(mode, e.currentTarget.checked)}
          />
          <span>{t(`settings.fmt.${mode}` as MessageKey)}</span>
        </label>
      {/each}
      <p class="hint">{t("settings.fmtCycle.hint")}</p>
    </fieldset>

    <label>
      <span>{t("settings.fixDecimals")}</span>
      <input
        type="number"
        min="0"
        max="12"
        inputmode="none"
        data-testid="fix-decimals"
        value={session.settings.fixDecimals}
        onchange={(e) => session.setFixDecimals(Number(e.currentTarget.value))}
      />
    </label>

    <fieldset data-testid="haptics">
      <label class="check">
        <input
          type="checkbox"
          data-testid="haptics-on"
          checked={session.settings.haptics.on}
          onchange={(e) => session.setHaptics({ on: e.currentTarget.checked })}
        />
        <span>{t("settings.haptics")}</span>
      </label>
      <label>
        <span>{t("settings.haptics.strength")}: {session.settings.haptics.strength} %</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          data-testid="haptics-strength"
          disabled={!session.settings.haptics.on || !strengthAvailable}
          value={session.settings.haptics.strength}
          oninput={(e) => session.setHaptics({ strength: Number(e.currentTarget.value) })}
        />
      </label>
      <label>
        <span>{t("settings.haptics.ms")}: {session.settings.haptics.ms}</span>
        <input
          type="range"
          min={HAPTIC_MS_RANGE.min}
          max={HAPTIC_MS_RANGE.max}
          step="5"
          data-testid="haptics-ms"
          disabled={!session.settings.haptics.on}
          value={session.settings.haptics.ms}
          oninput={(e) => session.setHaptics({ ms: Number(e.currentTarget.value) })}
        />
      </label>
      {#if !strengthAvailable}<p class="hint">{t("settings.haptics.webNote")}</p>{/if}
    </fieldset>

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
    max-height: 90vh;
    overflow-y: auto;
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
  fieldset {
    border: 1px solid var(--line);
    border-radius: 8px;
    margin: 0;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .check {
    justify-content: flex-start;
  }
  input[type="checkbox"] {
    width: auto;
  }
  input[type="range"] {
    width: 45%;
    padding: 0;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
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
