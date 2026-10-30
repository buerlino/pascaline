<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // The update line (A49): a new version of the web build waits. Only the button reloads the page.
  import { t } from "../i18n/index.ts";
  /** The engine's start note is on screen: sit under it. */
  let { restart, lower = false }: { restart: () => void; lower?: boolean } = $props();
</script>

<p class="updatenote" class:lower role="status" data-testid="update-note">
  {t("update.ready")}
  <button type="button" data-testid="update-restart" onclick={restart}>{t("update.restart")}</button>
</p>

<style>
  .updatenote {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
    margin: 0;
    padding: 4px 6px 4px 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
  }
  .lower {
    top: 48px;
  }
  button {
    margin-left: 6px;
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: transparent;
    color: var(--shift);
    font: inherit;
    font-weight: 700;
  }
</style>
