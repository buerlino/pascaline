// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S17): does Giac's regroup stop at its interrupt? G58's REGROUP_MAX (app/src/engine/numeric.ts) says it does
// not (r16 A.3). Times simplify, regroup and factor of a 55 kB polynomial under `timeout 0.05`, `ckevery 1`.
//   GIAC_OUT=<abs dir> node tools/probes/regroup-interrupt.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const { giac } = await loadNodeGiac();
console.log("text length", giac.eval("qq:=expand((x+y+z+w+1)^14)").length);
for (const f of ["simplify(qq)", "regroup(qq)", "factor(qq)"]) {
  giac.eval("timeout 0.05");
  giac.eval("ckevery 1");
  const t = performance.now();
  const r = giac.eval(f);
  console.log(f, `${(performance.now() - t).toFixed(0)} ms`, r.slice(0, 50));
}
giac.eval("timeout 15");
