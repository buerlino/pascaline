// SPDX-License-Identifier: GPL-3.0-or-later
// A CodeMirror 6 text view for the Python app: the script editor (many lines, line numbers) and the shell's
// input line. Our keypad drives it through TextInput; a physical keyboard works as usual. The system
// keyboard never opens (inputmode=none), as for the MathLive entry line.
import { defaultKeymap, history, historyKeymap, indentWithTab, insertNewlineAndIndent } from "@codemirror/commands";
import * as cmd from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { defaultHighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, keymap, lineNumbers, type Command } from "@codemirror/view";
import type { TextInput } from "../types.ts";

export interface CodeViewOptions {
  parent: HTMLElement;
  doc: string;
  /** Editor: line numbers and many lines. Shell: one input (Enter is onEnter). */
  editor: boolean;
  onChange?(doc: string): void;
  /** Enter (keypad or keyboard). Return true when handled; else a new line with indent is inserted. */
  onEnter?(): boolean;
  /** ▲ / ▼ on the first / last line (the shell recalls earlier input). Return true when handled. */
  onEdge?(dir: "up" | "down"): boolean;
  label: string;
}

/** Our keypad's MathLive command names, as CodeMirror commands. */
const COMMANDS: Record<string, Command> = {
  moveToPreviousChar: cmd.cursorCharLeft,
  moveToNextChar: cmd.cursorCharRight,
  moveUp: cmd.cursorLineUp,
  moveDown: cmd.cursorLineDown,
  moveToMathfieldStart: cmd.cursorLineBoundaryBackward,
  moveToMathfieldEnd: cmd.cursorLineBoundaryForward,
  deleteBackward: cmd.deleteCharBackward,
};

export class CodeView {
  readonly view: EditorView;
  private readonly o: CodeViewOptions;

  constructor(o: CodeViewOptions) {
    this.o = o;
    const enter: Command = (v) => (o.onEnter?.() ?? false) || insertNewlineAndIndent(v);
    const edge =
      (dir: "up" | "down"): Command =>
      (v) => {
        const line = v.state.doc.lineAt(v.state.selection.main.head).number;
        const atEdge = dir === "up" ? line === 1 : line === v.state.doc.lines;
        return atEdge && (o.onEdge?.(dir) ?? false);
      };
    this.view = new EditorView({
      parent: o.parent,
      state: EditorState.create({
        doc: o.doc,
        extensions: [
          ...(o.editor ? [lineNumbers()] : []),
          history(),
          drawSelection(),
          indentUnit.of("    "),
          python(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            { key: "Enter", run: enter },
            { key: "ArrowUp", run: edge("up") },
            { key: "ArrowDown", run: edge("down") },
            indentWithTab,
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.contentAttributes.of({ inputmode: "none", "aria-label": o.label, spellcheck: "false", autocapitalize: "off" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) o.onChange?.(u.state.doc.toString());
          }),
        ],
      }),
    });
  }

  get doc(): string {
    return this.view.state.doc.toString();
  }
  set doc(text: string) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, selection: { anchor: text.length } });
  }

  focus(): void {
    this.view.focus();
  }

  /** A key from our keypad. */
  input(k: TextInput): void {
    const v = this.view;
    if (k.kind === "text") v.dispatch(v.state.replaceSelection(k.text), { scrollIntoView: true, userEvent: "input.type" });
    else if (k.kind === "enter") (this.o.onEnter?.() ?? false) || insertNewlineAndIndent(v);
    else if (k.name === "moveUp" || k.name === "moveDown") {
      const dir = k.name === "moveUp" ? "up" : "down";
      const line = v.state.doc.lineAt(v.state.selection.main.head).number;
      const atEdge = dir === "up" ? line === 1 : line === v.state.doc.lines;
      if (!(atEdge && (this.o.onEdge?.(dir) ?? false))) COMMANDS[k.name]?.(v);
    } else if (k.name === "clear") {
      if (!this.o.editor) this.doc = "";
    } else COMMANDS[k.name]?.(v);
    v.focus();
  }

  /** Select a line (the line of an error) and scroll to it. */
  showLine(n: number): void {
    const doc = this.view.state.doc;
    if (n < 1 || n > doc.lines) return;
    const line = doc.line(n);
    this.view.dispatch({ selection: EditorSelection.range(line.from, line.to), scrollIntoView: true });
  }

  destroy(): void {
    this.view.destroy();
  }
}
