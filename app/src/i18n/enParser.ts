// SPDX-License-Identifier: GPL-3.0-or-later
// R52: the parser's and the emitters' messages (what Home shows for input it cannot read). A table of its own,
// imported by the input modules only, so it rides in the parser chunk and not in the start chunk (decisions M4-3).
// `{name}` placeholders are filled from the values the error site passes. English only so far.
import { SerializeError } from "../input/errors.ts";

export const enParser = {
  "parse.onePoint": "a number has one decimal point",
  "parse.oneComma": "a number has one decimal comma",
  "parse.expected": "expected '{v}'",
  "parse.expectedClosing": "expected closing {kind}",
  "parse.emptyInput": "empty input",
  "parse.unexpectedToken": "unexpected token",
  "parse.needsAVariable": "→ needs a variable name before it (x → x²)",
  "parse.expectedAName": "expected a name after ▶",
  "parse.timesBetweenResults": "put × between two results",
  "parse.timesResultNumber": "put × between a result and a number",
  "parse.ambiguousDoubleSuperscript": "ambiguous double superscript, use braces",
  "parse.unmatchedBracket": "unmatched bracket",
  "parse.expectedTheEvaluate": "expected the evaluate-at bar |",
  "parse.evaluateAtWrite": "evaluate at: write variable = value under the bar",
  "parse.unterminatedGroup": "unterminated group",
  "parse.unexpectedEndOf": "unexpected end of input",
  "parse.timesBetweenNumbers": "put × between two numbers",
  "parse.unsupportedDelimiter": "unsupported delimiter {v}",
  "parse.unexpectedClosingDelimiter": "unexpected closing delimiter",
  "parse.needsAWhole": "ᴇ needs a whole-number exponent after it (1.5ᴇ-3)",
  "parse.theExponentAfter": "the exponent after ᴇ must be a whole number, not {v}",
  "parse.oneExponent": "a number has one ᴇ exponent",
  "parse.putTheNumber": "put the ᴇ number in brackets before raising it to a power",
  "parse.numbersInOther": "0{v}… numbers in other bases are not supported yet: type the value in decimal",
  "parse.unsupportedSubscript": "unsupported subscript {sub}",
  "parse.expectedSubscript": "expected subscript",
  "parse.typeTheNumber": "type the number before ᴇ (1.5ᴇ-3)",
  "parse.unsupportedResultChip": "unsupported result chip {k}",
  "parse.aMixedNumber": "a mixed number needs a whole number before its fraction",
  "parse.needsBrackets": "{text} needs brackets: {text}(…)",
  "parse.unsupportedNameUnits": "unsupported name \\{name}{{text}} (units are not supported yet)",
  "parse.hasNoMeaning": "& has no meaning here yet; for logic use AND (Shift + 6)",
  "parse.isAUnit": "Å is a unit (the ångström): units come with the unit view",
  "parse.unsupportedCommand": "unsupported command \\{name}",
  "parse.needsAnArgument": "\\{name} needs an argument",
  "parse.putItsWhole": "{name}: put its whole argument in the brackets, as {name}(…)",
  "parse.derivativeTheExpression": "derivative: the expression goes after ∂ in the numerator",
  "parse.derivativeExpectedBefore": "derivative: expected ∂ before the variable",
  "parse.derivativeExpectedA": "derivative: expected a variable after ∂",
  "parse.integralNeedsDx": "integral needs dx",
  "parse.integralNeedsBoth": "integral needs both limits",
  "parse.expectedIndexVariable": "expected index variable",
  "parse.expectedLimitVariable": "expected limit variable",
  "parse.expectedTo": "expected \\to",
  "parse.unsupportedEnvironment": "unsupported environment {env}",
  "parse.piecewiseExpectedIf": "piecewise: expected 'if'",
  "parse.expectedEnd": "expected \\end",
  "parse.mismatchedEnd": "mismatched \\end",
  "parse.piecewiseEachLine": "piecewise: each line needs a value and a condition",
  "parse.nonFiniteNumber": "non-finite number",
  "parse.unsupportedNumberLiteral": "unsupported number literal {num}",
  "parse.unsupportedNode": "unsupported node {json}",
  "parse.badChip": "bad chip",
  "parse.parseError": "parse error {json}",
  "parse.emptyParentheses": "empty parentheses",
  "parse.emptyList": "empty list: put its elements between the braces, separated by commas",
  "parse.unsupportedApply": "unsupported Apply {json}",
  "parse.needsLimits": "{head} needs limits",
  "parse.needsVariableNames": "→ needs variable names before it",
  "parse.unsupportedHead": "unsupported head {head}",
  "parse.chipValueIs": "chip value is not a number or expression",
  "parse.chipValueHolds": "chip value holds a test and a string",
  "parse.chipValueHas": "chip value has unbalanced brackets",
  "parse.chipValueHolds2": "chip value holds two tests side by side",
  "parse.chipValueHolds3": "chip value holds a test beside another relation",
  "parse.chipValueHolds4": "chip value holds a test with a missing side",
  "parse.badNumber": "bad number {n}",
  "parse.unknownName": "unknown name {e}",
  "parse.reservedName": "{name} is one of Pascaline's own names",
  "parse.unsupportedNode2": "unsupported node",
  "parse.unsupported": "unsupported {h}",
  "parse.cannotPlot": "cannot plot: {msg}",
  "parse.logicTakes": "{text} takes {count}",
  "parse.atToken": "{msg} at '{tok}'",
  "parse.atEnd": "{msg} at end of input",
  "parse.ansNone": "Ans: no result to use in this view yet",
  "parse.valueMissing": "{what}: its value is missing",
  "parse.slotNeedsNumber": "a unit slot goes right after a number",
  "parse.slotTwice": "unit slot {id} appears twice",
  "parse.toNeedsEndSlot": "→ needs the end slot after it, at the end of the line",
  "parse.pmNeedsNumber": "± goes right after a number: 12.3 ± 0.1",
  "parse.pmNeedsSigma": "± needs a plain number after it: 12.3 ± 0.1",
} as const satisfies Record<string, string>;

export type ParseKey = keyof typeof enParser;
export type ParseVars = Readonly<Record<string, string>>;

/** The English text of a parser message. */
export function parseText(key: ParseKey, vars?: ParseVars): string {
  const m: string = enParser[key];
  return vars ? m.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all) : m;
}

/** A SerializeError for a table key: the English text is its `message`, the key and values ride along. */
export function parseError(key: ParseKey, vars?: ParseVars): SerializeError {
  return new SerializeError(parseText(key, vars), key, vars);
}
