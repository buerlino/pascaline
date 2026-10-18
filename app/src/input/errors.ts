// SPDX-License-Identifier: GPL-3.0-or-later
// The error the parser and the emitters throw for input they cannot turn into maths. Kept apart from emit.ts so
// the start chunk can recognise it without loading the parser chunk (decisions M4-3). It is made from a key of the
// parser's message table (i18n/enParser.ts, via parseError); `message` is the English text Home shows.
export class SerializeError extends Error {
  /** The message key and its values (i18n/enParser.ts); undefined for an error made without the table. */
  readonly key: string | undefined;
  readonly vars: Readonly<Record<string, string>> | undefined;
  constructor(message: string, key?: string, vars?: Readonly<Record<string, string>>) {
    super(message);
    this.key = key;
    this.vars = vars;
  }
}

/** The text to show for anything a parse or an emit threw: a SerializeError's message, else the error as text. */
export function parseFailText(e: unknown): string {
  return e instanceof SerializeError ? e.message : String(e);
}
