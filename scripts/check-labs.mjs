import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';
import { solutions } from './test-solutions.mjs';
async function loadTs(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
}
const { challenges } = await loadTs('../lib/challenges.ts');
const { gradeXorCnf } = await loadTs('../lib/cnf.ts');
const { patternFailures } = await loadTs('../lib/pattern-check.ts');
let checks = 0;
function verify(ok, name) { assert.ok(ok, name); checks++; console.log('PASS ' + name); }
function simulate(design, testbench, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./engine-test-worker.mjs', import.meta.url));
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timeout')); }, timeout);
    worker.on('error', (error) => { clearTimeout(timer); reject(error); });
    worker.on('message', (result) => {
      if (result.type === 'TEST_READY') worker.postMessage({ type: 'SOC_RTL_RUN', requestId: 'test', design, testbench, generation: '2005' });
      else if (result.type === 'SOC_RTL_RESULT') { clearTimeout(timer); worker.terminate(); resolve(result); }
    });
  });
}
verify(challenges.length === 26 && new Set(challenges.map((c) => c.id)).size === 26, '26 unique bilingual challenges');
for (const c of challenges) {
  verify(Boolean(c.title.zh && c.title.en && c.description.zh && c.description.en), c.id + ' bilingual content');
  if (c.judge !== 'simulation') continue;
  const design = solutions[c.id]?.(c.starter) ?? c.referenceSolution;
  assert.ok(design, 'Missing fixture: ' + c.id);
  const good = await simulate(design, c.testbench);
  verify(good.ok, c.id + ' reference accepts: ' + (good.ok ? '' : good.console));
  verify(Boolean(good.vcd?.includes('$enddefinitions')), c.id + ' emits VCD');
  const starter = await simulate(c.starter, c.testbench);
  verify(starter.ok === (c.id === 'ppa-width-discipline'), c.id + ' starter verdict: ' + starter.console.slice(-100));
}
const cnf = challenges.find((c) => c.judge === 'cnf');
const correctCnf = 'p cnf 3 4\n1 2 -3 0\n-1 -2 -3 0\n1 -2 3 0\n-1 2 3 0';
for (const locale of ['zh', 'en']) {
  verify(gradeXorCnf(correctCnf, locale).ok, 'CNF accepts XOR in ' + locale);
  for (const input of [cnf.starter, '', 'p cnf 3 1\n1 0', correctCnf + '\np cnf 3 4', correctCnf.replace('3 4', '3 5') + '\n1 0', 'p cnf 3 2\n1 0\n-1 0', 'x'.repeat(33000)]) {
    verify(!gradeXorCnf(input, locale).ok, 'CNF rejects invalid/overconstrained input in ' + locale);
  }
}
const uvm = challenges.find((c) => c.judge === 'pattern');
const correctUvm = solutions[uvm.id](uvm.starter);
verify(patternFailures(correctUvm, uvm.patternRules).length === 0, 'UVM structure accepted');
verify(patternFailures(uvm.starter, uvm.patternRules).length > 0, 'UVM TODO starter rejected');
verify(patternFailures('/*' + correctUvm + '*/', uvm.patternRules).length > 0, 'Comment-only UVM answer rejected');
const checkTask = challenges[0].testbench.match(/task check;[\s\S]*?endtask/)[0];
const scoreboard = challenges.find((c) => c.id === 'verification-scoreboard-debug');
const inertChecker = scoreboard.starter.slice(0, scoreboard.starter.indexOf('//')) + 'always @* error=0;endmodule';
verify(!(await simulate(inertChecker, scoreboard.testbench)).ok, 'Scoreboard must detect injected corruption');
for (const value of ["1'bx", "1'bz", "1'b0"]) {
  const r = await simulate('module unused;endmodule', 'module tb;' + checkTask + ' initial begin check(' + value + ');$display("@@PASS@@");$finish;end endmodule');
  verify(!r.ok && r.phase === 'simulate', 'Four-state checker rejects ' + value);
}
const bad = await simulate('not verilog!', 'module tb;initial $finish;endmodule');
verify(!bad.ok, 'Invalid Verilog rejected');
const watchdog = await simulate('module unused;endmodule', "module tb;reg clk=0;always #5 clk=~clk;initial wait(1'b0);endmodule");
verify(!watchdog.ok && watchdog.console.includes('simulation-time limit reached'), 'Simulation-time watchdog');
console.log('All ' + checks + ' checks passed.');
