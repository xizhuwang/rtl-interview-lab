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
const { formatCodeForEditor } = await loadTs('../lib/code-format.ts');
const { gradeXorCnf } = await loadTs('../lib/cnf.ts');
const { patternFailures } = await loadTs('../lib/pattern-check.ts');
const { learningContext } = await loadTs('../lib/learning-context.ts');
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
verify(challenges.length === 33 && new Set(challenges.map((c) => c.id)).size === 33, '33 unique bilingual challenges');
verify(challenges.filter(c=>c.track==='dft').length===3, 'Three DFT exercises');
verify(challenges.filter(c=>c.track==='low-power').length===4, 'Four low-power exercises');
for (const c of challenges) {
  verify(Boolean(c.title.zh && c.title.en && c.description.zh && c.description.en), c.id + ' bilingual content');
  if(c.track==='dft'||c.track==='low-power') {
    const context=learningContext[c.id];
    verify(c.language==='Verilog-2005' && c.judge==='simulation' && c.hints.length===3
      && [...c.specs,...c.hints,...c.testGroups,context.why,context.roles].every(v=>v.zh&&v.en&&!/[\u4e00-\u9fff]/.test(v.en)), c.id+' three bilingual hints, rationale and role mapping');
  }
  const formattedStarter = formatCodeForEditor(c.starter, c.language);
  if (c.language === 'Verilog-2005') {
    verify(!/^\s*module[^\n]*,[^\n]*\);/m.test(formattedStarter), c.id + ' readable module port layout');
  }
  if (c.judge !== 'simulation') continue;
  const rawDesign = solutions[c.id]?.(c.starter) ?? c.referenceSolution;
  assert.ok(rawDesign, 'Missing fixture: ' + c.id);
  const design = formatCodeForEditor(rawDesign, c.language);
  const good = await simulate(design, c.testbench);
  verify(good.ok, c.id + ' reference accepts: ' + (good.ok ? '' : good.console));
  verify(Boolean(good.vcd?.includes('$enddefinitions')), c.id + ' emits VCD');
  const starter = await simulate(formattedStarter, c.testbench);
  verify(starter.ok === (c.id === 'ppa-width-discipline'), c.id + ' starter verdict: ' + starter.console.slice(-100));
}
const publicVisibleText = JSON.stringify({
  challenges: challenges.map(({ title, description, specs, hints, testGroups }) => ({ title, description, specs, hints, testGroups })),
  learningContext,
});
verify(!/(?:面試|interview|王璽鑄|MediaTek|Realtek|Qualcomm|Phison|NVIDIA|TSMC|聯發科|瑞昱|群聯|威宏|創星|台積電)/i.test(publicVisibleText), 'Public exercise text contains no interview source, employer name or personal name');
// Deliberately broken versions must fail in simulation, not merely fail compilation.
const mutationCases = [
  ['dft-scan-capture','reverse scan direction','{q[6:0],scan_in}','{scan_in,q[7:1]}'],
  ['dft-scan-capture','wrong scan tap','scan_out=q[7]','scan_out=q[0]'],
  ['dft-scan-capture','functional enable masks scan','else if(scan_en)','else if(scan_en&&!func_en)'],
  ['dft-sram-mbist','clear sticky failure after a good read',"if(rdata!=8'hff)fail<=1;","fail<=(rdata!=8'hff);"],
  ['dft-sram-mbist','write wrong test pattern',"state==W1?8'hff:8'h00","8'h00"],
  ['dft-sram-mbist','compare stale read output','R0:state<=C0;',"R0:begin if(rdata!=8'h00)fail<=1;state<=C0;end"],
  ['dft-spare-row-remap','ignore repair enable','repair_en&&(addr==bad_row)','(addr==bad_row)'],
  ['dft-spare-row-remap','never write spare','spare_we=spare_en&&write',"spare_we=1'b0"],
  ['dft-spare-row-remap','write outside request','normal_we=normal_en&&write','normal_we=write&&!hit'],
  ['lp-glitch-free-clock-gate','raw combinational gate','always @* if(!clk) gate_en=en|test_en;','always @* gate_en=en|test_en;'],
  ['lp-glitch-free-clock-gate','scan clock blocked','gate_en=en|test_en','gate_en=en'],
  ['lp-glitch-free-clock-gate','miss late-low enable update','always @* if(!clk)','always @(negedge clk)'],
  ['lp-operand-isolation','clear instead of hold on bubbles','op_a<=a;op_b<=b;end end','op_a<=a;op_b<=b;end else begin op_a<=0;op_b<=0;end end'],
  ['lp-operand-isolation','stale valid during idle','out_valid<=in_valid;','if(in_valid)out_valid<=1;'],
  ['lp-operand-isolation','mask only output','assign product=op_a*op_b;',"assign product=out_valid?op_a*op_b:16'h0000;"],
  ['lp-retention-register','lose shadow while off','else if(!power_on)q<=0;','else if(!power_on)begin q<=0;saved<=0;end'],
  ['lp-retention-register','save incoming write not old state','else if(save)saved<=q;','else if(save)saved<=wdata;'],
  ['lp-retention-register','restore zeros','else if(restore)q<=saved;','else if(restore)q<=0;'],
  ['lp-power-sequencer','cut power with outstanding work','RUN:if(sleep_req)state<=DRAIN;','RUN:if(sleep_req)state<=OFF;'],
  ['lp-power-sequencer','ignore drain acknowledgement','DRAIN:if(idle)state<=SAVE;','DRAIN:state<=SAVE;'],
  ['lp-power-sequencer','ignore power good','RAMP:if(power_good)state<=RESTORE;','RAMP:state<=RESTORE;'],
  ['lp-power-sequencer','release isolation during restore','state!=RUN&&state!=DRAIN&&state!=SAVE','state!=RUN&&state!=DRAIN&&state!=SAVE&&state!=RESTORE'],
];
for(const [id,name,before,after] of mutationCases) {
  const c=challenges.find(c=>c.id===id);
  const correct=solutions[id](c.starter);
  assert.ok(correct.includes(before), 'Mutation target not found: '+name);
  const result=await simulate(correct.replace(before,after),c.testbench);
  verify(!result.ok && result.phase==='simulate', id+' rejects '+name+': '+result.console.slice(-100));
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
