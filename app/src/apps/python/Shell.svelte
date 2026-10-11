<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Num view of the Python app: the output history and an input line. Enter runs the input (a block that
  // ends in ":" goes on until an empty line); ▲ ▼ recall earlier inputs.
  import { tick } from "svelte";
  import { t } from "../../i18n/index.ts";
  import type { PythonApp } from "./app.svelte.ts";
  import { CodeView } from "./codeView.ts";

  let { app }: { app: PythonApp } = $props();
  let host: HTMLElement | undefined = $state();
  let scroller: HTMLElement | undefined = $state();

  $effect(() => {
    if (!host) return;
    const v = new CodeView({
      parent: host,
      doc: "",
      editor: false,
      label: t("python.shell"),
      onEnter: () => app.shellEnter(),
      onEdge: (dir) => app.shellRecall(dir),
    });
    app.attachShell(v);
    v.focus();
    return () => {
      app.attachShell(undefined);
      v.destroy();
    };
  });

  // Keep the newest output in view.
  $effect(() => {
    void app.transcript.length;
    void app.transcript.at(-1)?.text;
    void tick().then(() => {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  });
</script>

<div class="out" bind:this={scroller} data-testid="py-transcript">
  {#if app.status === "loading"}<p class="note">{t("python.loading")}</p>{/if}
  {#if app.status === "failed"}<p class="err" role="alert">{t("python.failed", { reason: app.failure })}</p>{/if}
  {#if app.transcript.length === 0 && app.status === "ready"}<p class="note">{t("python.shellEmpty")}</p>{/if}
  {#each app.transcript as line (line.id)}
    <pre class={line.kind} data-kind={line.kind}>{line.kind === "in" ? `>>> ${line.text.replace(/\n/g, "\n... ")}` : line.text}</pre>
  {/each}
</div>
<div class="input" data-testid="py-input" data-busy={app.busy}>
  <span class="prompt">&gt;&gt;&gt;</span>
  <div class="field" bind:this={host}></div>
</div>

<style>
  .out {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 6px 10px;
    font-family: ui-monospace, "DejaVu Sans Mono", monospace;
    font-size: 15px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font: inherit;
  }
  .in {
    color: var(--muted);
  }
  .err {
    color: var(--error);
  }
  .note {
    margin: 2px 0;
    color: var(--muted);
    font-style: italic;
  }
  .input {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 4px 10px;
    border-top: 1px solid var(--muted);
    font-family: ui-monospace, "DejaVu Sans Mono", monospace;
    font-size: 16px;
  }
  .prompt {
    color: var(--muted);
    padding-top: 4px;
  }
  .field {
    flex: 1;
    min-width: 0;
    max-height: 30vh;
    overflow: auto;
  }
  .field :global(.cm-editor) {
    background: transparent;
    color: var(--text);
  }
  .field :global(.cm-editor.cm-focused) {
    outline: none;
  }
  .field :global(.cm-content) {
    caret-color: var(--text);
    font-family: inherit;
  }
</style>
