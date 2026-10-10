// SPDX-License-Identifier: GPL-3.0-or-later
// Scratch: show what Compute Engine makes of LaTeX that our keyboard (and users) can produce.
import { ComputeEngine } from "@cortex-js/compute-engine";
const ce = new ComputeEngine();
const inputs = process.argv.length > 2 ? process.argv.slice(2) : [
  "\\frac12+\\sin\\left(x\\right)", "2x", "3\\times4\\div5", "\\sqrt[3]{x}", "x^{2}+\\pi", "\\ln\\left(x\\right)",
  "e^{x}", "\\exponentialE^x", "\\log\\left(x\\right)", "\\int_0^1 x^2 dx", "\\frac{d}{dx}x^2",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}", "\\left|x\\right|", "\\imaginaryI", "2i", "\\sin^{-1}x",
  "x!", "1.5\\times10^{3}", "\\sum_{k=1}^{10}k", "\\operatorname{foo}(x)", "a_1+b", "\\arcsin\\left(x\\right)",
  "2\\left(3+4\\right)", "x=2", "\\sin x\\cos x", "\\sqrt9", "1/2/3", "-x^2", "2^{3^{4}}", "\\frac{1}{2}x",
];
for (const l of inputs) {
  const e = ce.parse(l, { canonical: false });
  console.log(JSON.stringify(l), "=>", JSON.stringify(e.json));
}
