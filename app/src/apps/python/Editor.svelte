<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Symb view of the Python app: the current script in CodeMirror. Menu: Run, scripts, keywords.
  import { untrack } from "svelte";
  import { t } from "../../i18n/index.ts";
  import type { PythonApp } from "./app.svelte.ts";
  import { CodeView } from "./codeView.ts";

  let { app }: { app: PythonApp } = $props();
  let host: HTMLElement | undefined = $state();

  $effect(() => {
    if (!host) return;
    const v = new CodeView({
      parent: host,
      doc: untrack(() => app.script.code),
      editor: true,
      label: t("python.editor"),
      onChange: (code) => app.setCode(code),
    });
    app.attachEditor(v);
    v.focus();
    return () => {
      app.attachEditor(undefined);
      v.destroy();
    };
  });
</script>

<div class="bar">
  <span class="name" data-testid="py-script">{app.script.name}</span>
  {#if app.busy}<span class="state">{t("history.working")}</span>{/if}
</div>
<div class="code" bind:this={host}></div>
{#if app.error}
  <p class="error" role="alert" data-testid="py-error" data-line={app.error.line ?? ""}>
    {app.error.line !== undefined ? t("python.errorLine", { line: String(app.error.line), text: app.error.text }) : app.error.text}
  </p>
{/if}

<style>
  .bar {
    display: flex;
    gap: 10px;
    padding: 4px 10px;
    font-size: 14px;
    color: var(--muted);
  }
  .code {
    flex: 1;
    min-height: 0;
    overflow: auto;
    font-size: 16px;
  }
  .code :global(.cm-editor) {
    height: 100%;
    background: var(--panel);
    color: var(--text);
  }
  .code :global(.cm-scroller) {
    font-family: ui-monospace, "DejaVu Sans Mono", monospace;
  }
  .code :global(.cm-gutters) {
    background: transparent;
    color: var(--muted);
    border: none;
  }
  .code :global(.cm-content) {
    caret-color: var(--text);
  }
  .error {
    margin: 0;
    padding: 6px 10px;
    font-size: 15px;
    color: var(--error);
  }
</style>
