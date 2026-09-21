import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import ts from 'typescript';
import { solutions } from './test-solutions.mjs';
async function loadTs(path) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  if (path.endsWith('/challenges.ts')) {
    const cpuModule = await loadTs('../lib/cpu-cache-challenges.ts');
    const socAcceleratorModule = await loadTs(
      '../lib/soc-accelerator-challenges.ts',
    );
    source = source.replace(
      "import { cpuCacheChallenges } from './cpu-cache-challenges';",
      `const cpuCacheChallenges=${JSON.stringify(cpuModule.cpuCacheChallenges)};`,
    );
    source = source.replace(
      "import { socAcceleratorChallenges } from './soc-accelerator-challenges';",
      `const socAcceleratorChallenges=${JSON.stringify(socAcceleratorModule.socAcceleratorChallenges)};`,
    );
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  );
}
const { challenges } = await loadTs('../lib/challenges.ts');
const { formatCodeForEditor } = await loadTs('../lib/code-format.ts');
const { gradeXorCnf } = await loadTs('../lib/cnf.ts');
const { patternFailures } = await loadTs('../lib/pattern-check.ts');
const { learningContext } = await loadTs('../lib/learning-context.ts');
const { goldenPatterns } = await loadTs('../lib/golden-patterns.ts');
const { socLearningAids } = await loadTs('../lib/soc-learning-aids.ts');
const { boardImplementationCompetencies } = await loadTs('../lib/readiness.ts');
const workerSource = await readFile(
  new URL('../public/engine/worker.js', import.meta.url),
  'utf8',
);
const waveformSource = await readFile(
  new URL('../components/waveform-viewer.tsx', import.meta.url),
  'utf8',
);
const pageSource = await readFile(
  new URL('../app/page.tsx', import.meta.url),
  'utf8',
);
let checks = 0;
function verify(ok, name) {
  assert.ok(ok, name);
  checks++;
  console.log('PASS ' + name);
}
function simulate(
  design,
  testbench,
  timeout = 15000,
  reference = '',
  challengeId = '',
) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./engine-test-worker.mjs', import.meta.url),
    );
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Worker timeout'));
    }, timeout);
    worker.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.on('message', (result) => {
      if (result.type === 'TEST_READY')
        worker.postMessage({
          type: 'SOC_RTL_RUN',
          requestId: 'test',
          design,
          reference,
          challengeId,
          testbench,
          generation: '2005',
        });
      else if (result.type === 'SOC_RTL_RESULT') {
        clearTimeout(timer);
        worker.terminate();
        resolve(result);
      }
    });
  });
}
verify(
  challenges.length === 48 && new Set(challenges.map((c) => c.id)).size === 48,
  '48 unique bilingual challenges',
);
verify(
  challenges.filter((c) => c.track === 'dft').length === 3,
  'Three DFT exercises',
);
verify(
  challenges.filter((c) => c.track === 'low-power').length === 4,
  'Four low-power exercises',
);
verify(
  challenges.filter((c) => /^soc-(?:cpu|cache)-/.test(c.id)).length === 9,
  'Nine CPU and cache exercises',
);
verify(
  challenges.filter((c) => c.track === 'cpu-cache').length === 9,
  'CPU/cache is an independent track',
);
verify(
  challenges.filter((c) => c.track === 'soc').length === 11,
  'Eleven SoC and accelerator exercises',
);
verify(
  /MAX_VCD_CHARS\s*=\s*600000/.test(workerSource) &&
    /limitVcd\(result\.vcd\)/.test(workerSource),
  'Worker caps waveform transfer size',
);
verify(
  /MAX_STORED_CHANGES\s*=\s*20000/.test(waveformSource) &&
    /MAX_RENDERED_CHANGES\s*=\s*220/.test(waveformSource),
  'Waveform renderer caps parse and SVG work',
);
verify(
  /function parseChecks\(output\)/.test(workerSource) &&
    /checks,/.test(workerSource),
  'Worker returns structured expected/actual checks',
);
verify(
  /goldenVcdCache/.test(workerSource) && /goldenVcd,/.test(workerSource),
  'Worker simulates and caches a separate Golden waveform',
);
verify(
  /compareGoldenOutputs\(currentVcd, goldenVcd, outputNames\)/.test(
    workerSource,
  ) && /testbenchPassed && goldenComparison\.matches/.test(workerSource),
  'Verdict requires full DUT-output waveform equality with Golden',
);
verify(
  /Your waveform vs Golden waveform/.test(waveformSource) &&
    /definitions\.push/.test(waveformSource),
  'Waveform viewer preserves VCD aliases and renders paired traces',
);
verify(
  /visor:\s*20[\s\S]*crystal:\s*20[\s\S]*drone:\s*50/.test(pageSource),
  'Starter profiles receive 20 visors, 20 crystals, and 50 companions',
);
verify(
  /schemaVersion,\s*'6'/.test(pageSource) && /normalized - 30/.test(pageSource),
  'Schema v6 preserves the original starter-grant migration',
);
verify(
  /Math\.floor\(equipmentCatalog\[instance\.id\]\.cost \/ 2\)/.test(pageSource),
  'Equipment resale returns half of the current shop price',
);
verify(
  /equipmentUpgradeChance\s*=\s*\[1, 0\.8, 0\.65, 0\.45, 0\.3\]/.test(
    pageSource,
  ) &&
    /before >= 2 \? before - 1 : before/.test(pageSource) &&
    /hammer: Math\.max\(0, previous\.hammer - 1\)/.test(pageSource) &&
    /application\/x-equipment-uid/.test(pageSource),
  'Equipment forging supports drag/drop and consumes a hammer with protected low stars',
);
verify(
  pageSource.indexOf('{text.equipment}') <
    pageSource.indexOf('className={`forge-station') &&
    pageSource.indexOf('className={`forge-station') <
      pageSource.indexOf('{text.shopEquipment}'),
  'Forge and owned-equipment actions live in the backpack while the shop is purchase-only',
);
verify(
  /type EquipmentInstance = \{[\s\S]*uid: string;[\s\S]*stars: number;/.test(
    pageSource,
  ) &&
    /setEquipmentInventory\(\(previous\) => \[\.\.\.previous, instance\]\)/.test(
      pageSource,
    ) &&
    /equipmentInventory\.map\(\(instance, index\)/.test(pageSource) &&
    /const ownedCount = equipmentInventory\.filter/.test(pageSource) &&
    /setEquippedEquipmentUids\(/.test(pageSource) &&
    /\[item\.slot\]: equipped[\s\S]*\? null[\s\S]*: uid/.test(pageSource),
  'Duplicate equipment copies keep independent stars, equip, forge, and resale state',
);
verify(
  /type EquipmentSlot = 'weapon' \| 'relic'/.test(pageSource) &&
    /equippedEquipmentUids: 'soc-rtl-lab:equipped-equipment-uids'/.test(
      pageSource,
    ) &&
    /equipment\.map\(\(instance\)/.test(pageSource) &&
    /equipment-wearable-sprite\.webp/.test(pageSource),
  'Companion supports a persistent two-slot wearable equipment loadout',
);
verify(
  /dailyProgress:\s*'soc-rtl-lab:daily-progress'/.test(pageSource) &&
    /rewardCredits: previous\.rewardCredits \+ 50 \+ \(milestone \? 150 : 0\)/.test(
      pageSource,
    ) &&
    /previous\.rewardCredits \+ 80/.test(pageSource),
  'Daily check-in, seven-day milestone, and rotating RTL review rewards persist locally',
);
verify(
  /dailyReviewActive\s*\?\s*dailyReview\.draft/.test(pageSource) &&
    /setDailyReview\(\{[\s\S]*draft: formatCodeForEditor/.test(pageSource) &&
    /dailyReviewNoAids/.test(pageSource),
  'Daily review starts from a temporary fresh draft and hides solved aids',
);
verify(
  /const logicAnalogy: Record<TrackId, \{ zh: string; en: string \}>/.test(
    pageSource,
  ) &&
    /challenge\.hints\s*\.slice\(0, 2\)/.test(pageSource) &&
    /logicAnalogy\[challenge\.track\]\[locale\]/.test(pageSource) &&
    /<LogicBriefCard challenge=\{current\} locale=\{locale\}/.test(
      pageSource,
    ) &&
    /!dailyReviewNoAids && !logicUnlocked/.test(pageSource),
  'Timing Crystal uses plain-language analogies and task-specific reasoning',
);
verify(
  /roll < 0\.62[\s\S]*roll < 0\.77/.test(pageSource),
  'BOSS drops favor consumables over equipment',
);
verify(
  /aidUnlocks\.logic\.includes\(current\.id\)/.test(pageSource) &&
    /aidUnlocks\.golden\.includes\(current\.id\)/.test(pageSource) &&
    /aidUnlocks\.hints\[current\.id\]/.test(pageSource),
  'Learning-aid unlocks persist per challenge',
);
verify(
  /goldenPattern && !goldenUnlocked/.test(pageSource) &&
    /goldenPattern && goldenUnlocked/.test(pageSource),
  'Golden patterns require a Debug Visor unlock',
);
const socChallenges = challenges.filter((c) => c.track === 'soc');
verify(
  Object.keys(socLearningAids).length === socChallenges.length,
  'Every SoC exercise has exactly one interface guide',
);
verify(
  socChallenges.every((c) => socLearningAids[c.id]),
  'Every SoC exercise maps to a system architecture guide',
);
function starterPorts(starter) {
  const header =
    starter.match(/module\s+[A-Za-z_]\w*\s*\(([\s\S]*?)\);/)?.[1] ?? '';
  return [
    ...new Set(
      header
        .split(',')
        .map((part) => part.match(/([A-Za-z_]\w*)\s*$/)?.[1])
        .filter(Boolean),
    ),
  ];
}
for (const c of socChallenges) {
  const aid = socLearningAids[c.id];
  const documentedPorts = new Set(
    aid.ports.map((port) => port.name.replace(/\[.*$/, '')),
  );
  const missingPorts = starterPorts(c.starter).filter(
    (port) => !documentedPorts.has(port),
  );
  verify(
    missingPorts.length === 0,
    c.id +
      ' documents every top-level port' +
      (missingPorts.length ? ': ' + missingPorts.join(', ') : ''),
  );
  verify(
    Boolean(
      aid.context.zh &&
      aid.context.en &&
      aid.architecture.focus.zh &&
      aid.architecture.focus.en &&
      aid.architecture.flow.zh &&
      aid.architecture.flow.en &&
      aid.architecture.sources.length &&
      aid.architecture.sinks.length,
    ),
    c.id + ' has bilingual architecture and data flow',
  );
  verify(
    aid.ports.length > 0 &&
      aid.ports.every(
        (port) =>
          port.name &&
          port.width &&
          port.timing.zh &&
          port.timing.en &&
          port.purpose.zh &&
          port.purpose.en,
      ),
    c.id + ' has complete bilingual port contracts',
  );
  verify(
    c.hints.length === 3 &&
      c.hints.every(
        (hint) => hint.zh && hint.en && !/[\u4e00-\u9fff]/.test(hint.en),
      ),
    c.id + ' has three concrete bilingual hints',
  );
}
const goldenPatternIds = Object.keys(goldenPatterns);
verify(
  goldenPatternIds.length >= 15,
  'Golden behavior patterns cover complex timing exercises',
);
verify(
  goldenPatternIds.every((id) => challenges.some((c) => c.id === id)),
  'Every golden behavior pattern maps to a challenge',
);
for (const id of goldenPatternIds) {
  const p = goldenPatterns[id];
  verify(
    Boolean(p.title.zh && p.title.en && p.summary.zh && p.summary.en),
    id + ' golden pattern is bilingual',
  );
  verify(
    p.columns.length >= 4 &&
      p.rows.length >= 4 &&
      p.rows.every((row) => row.length === p.columns.length),
    id + ' golden table is rectangular',
  );
}
const competencyIds = boardImplementationCompetencies.flatMap(
  (stage) => stage.challengeIds,
);
verify(
  competencyIds.length === 14 &&
    competencyIds.every((id) => challenges.some((c) => c.id === id)),
  'Board implementation competency set is complete',
);
for (const c of challenges) {
  verify(
    Boolean(c.title.zh && c.title.en && c.description.zh && c.description.en),
    c.id + ' bilingual content',
  );
  if (
    c.track === 'dft' ||
    c.track === 'low-power' ||
    c.track === 'cpu-cache' ||
    c.order >= 43
  ) {
    const context = learningContext[c.id];
    verify(
      c.language === 'Verilog-2005' &&
        c.judge === 'simulation' &&
        c.hints.length === 3 &&
        [
          ...c.specs,
          ...c.hints,
          ...c.testGroups,
          context.why,
          context.roles,
        ].every((v) => v.zh && v.en && !/[\u4e00-\u9fff]/.test(v.en)),
      c.id + ' three bilingual hints, rationale and role mapping',
    );
  }
  const formattedStarter = formatCodeForEditor(c.starter, c.language);
  if (c.language === 'Verilog-2005') {
    verify(
      !/^\s*module[^\n]*,[^\n]*\);/m.test(formattedStarter),
      c.id + ' readable module port layout',
    );
  }
  if (c.judge !== 'simulation') continue;
  const rawDesign = solutions[c.id]?.(c.starter) ?? c.referenceSolution;
  assert.ok(rawDesign, 'Missing fixture: ' + c.id);
  const design = formatCodeForEditor(rawDesign, c.language);
  const good = await simulate(design, c.testbench, 20000, design, c.id);
  verify(
    good.ok,
    c.id + ' reference accepts: ' + (good.ok ? '' : good.console),
  );
  verify(Boolean(good.vcd?.includes('$enddefinitions')), c.id + ' emits VCD');
  verify(
    good.goldenComparedSignals > 0,
    c.id + ' activates declared-output comparison against a Golden run',
  );
  const starter = await simulate(formattedStarter, c.testbench);
  verify(
    starter.ok === (c.id === 'ppa-width-discipline'),
    c.id + ' starter verdict: ' + starter.console.slice(-100),
  );
}
const publicVisibleText = JSON.stringify({
  challenges: challenges.map(
    ({ title, description, specs, hints, testGroups }) => ({
      title,
      description,
      specs,
      hints,
      testGroups,
    }),
  ),
  learningContext,
  goldenPatterns,
  socLearningAids,
});
verify(
  !/(?:面試|interview|王璽鑄|MediaTek|Realtek|Qualcomm|Phison|NVIDIA|TSMC|聯發科|瑞昱|群聯|威宏|創星|台積電)/i.test(
    publicVisibleText,
  ),
  'Public exercise text contains no interview source, employer name or personal name',
);
// Deliberately broken versions must fail in simulation, not merely fail compilation.
const mutationCases = [
  [
    'soc-cpu-register-file',
    'drop register writes',
    'else if(we&&waddr!=0)',
    "else if(1'b0&&we&&waddr!=0)",
  ],
  [
    'soc-cpu-forwarding',
    'let old WB data override EX/MEM',
    'else if(wb_regwrite&&wb_rd!=0&&wb_rd==ex_rs1)forward_a=1;',
    'if(wb_regwrite&&wb_rd!=0&&wb_rd==ex_rs1)forward_a=1;',
  ],
  [
    'soc-cpu-hazard-control',
    'drop branch flush priority',
    'if(branch_taken)begin',
    "if(1'b0&&branch_taken)begin",
  ],
  [
    'soc-cpu-branch-predictor',
    'wrap strongly taken to not taken',
    "update&&actual_taken&&state!=2'b11",
    'update&&actual_taken',
  ],
  [
    'soc-cache-direct-mapped',
    'ignore tag during lookup',
    '(tags[req_index]==req_addr[31:4])',
    "1'b1",
  ],
  [
    'soc-cache-two-way',
    'ignore way one hit',
    'assign hit=hit0||hit1;',
    'assign hit=hit0;',
  ],
  [
    'soc-cache-fully-associative',
    'skip entry three',
    'if(req&&valid[3]&&tags[3]==req_tag)',
    "if(1'b0&&req&&valid[3]&&tags[3]==req_tag)",
  ],
  [
    'soc-cache-lru',
    'share replacement state across sets',
    'lru[touch_set]<=~touch_way',
    'lru[0]<=~touch_way',
  ],
  [
    'soc-cache-miss-fsm',
    'skip dirty write-back',
    'next=victim_dirty?WRITEBACK:REFILL',
    'next=REFILL',
  ],
  [
    'dft-scan-capture',
    'reverse scan direction',
    '{q[6:0],scan_in}',
    '{scan_in,q[7:1]}',
  ],
  ['dft-scan-capture', 'wrong scan tap', 'scan_out=q[7]', 'scan_out=q[0]'],
  [
    'dft-scan-capture',
    'functional enable masks scan',
    'else if(scan_en)',
    'else if(scan_en&&!func_en)',
  ],
  [
    'dft-sram-mbist',
    'clear sticky failure after a good read',
    "if(rdata!=8'hff)fail<=1;",
    "fail<=(rdata!=8'hff);",
  ],
  [
    'dft-sram-mbist',
    'write wrong test pattern',
    "state==W1?8'hff:8'h00",
    "8'h00",
  ],
  [
    'dft-sram-mbist',
    'compare stale read output',
    'R0:state<=C0;',
    "R0:begin if(rdata!=8'h00)fail<=1;state<=C0;end",
  ],
  [
    'dft-spare-row-remap',
    'ignore repair enable',
    'repair_en&&(addr==bad_row)',
    '(addr==bad_row)',
  ],
  [
    'dft-spare-row-remap',
    'never write spare',
    'spare_we=spare_en&&write',
    "spare_we=1'b0",
  ],
  [
    'dft-spare-row-remap',
    'write outside request',
    'normal_we=normal_en&&write',
    'normal_we=write&&!hit',
  ],
  [
    'lp-glitch-free-clock-gate',
    'raw combinational gate',
    'always @* if(!clk) gate_en=en|test_en;',
    'always @* gate_en=en|test_en;',
  ],
  [
    'lp-glitch-free-clock-gate',
    'scan clock blocked',
    'gate_en=en|test_en',
    'gate_en=en',
  ],
  [
    'lp-glitch-free-clock-gate',
    'miss late-low enable update',
    'always @* if(!clk)',
    'always @(negedge clk)',
  ],
  [
    'lp-operand-isolation',
    'clear instead of hold on bubbles',
    'op_a<=a;op_b<=b;end end',
    'op_a<=a;op_b<=b;end else begin op_a<=0;op_b<=0;end end',
  ],
  [
    'lp-operand-isolation',
    'stale valid during idle',
    'out_valid<=in_valid;',
    'if(in_valid)out_valid<=1;',
  ],
  [
    'lp-operand-isolation',
    'mask only output',
    'assign product=op_a*op_b;',
    "assign product=out_valid?op_a*op_b:16'h0000;",
  ],
  [
    'lp-retention-register',
    'lose shadow while off',
    'else if(!power_on)q<=0;',
    'else if(!power_on)begin q<=0;saved<=0;end',
  ],
  [
    'lp-retention-register',
    'save incoming write not old state',
    'else if(save)saved<=q;',
    'else if(save)saved<=wdata;',
  ],
  [
    'lp-retention-register',
    'restore zeros',
    'else if(restore)q<=saved;',
    'else if(restore)q<=0;',
  ],
  [
    'lp-power-sequencer',
    'cut power with outstanding work',
    'RUN:if(sleep_req)state<=DRAIN;',
    'RUN:if(sleep_req)state<=OFF;',
  ],
  [
    'lp-power-sequencer',
    'ignore drain acknowledgement',
    'DRAIN:if(idle)state<=SAVE;',
    'DRAIN:state<=SAVE;',
  ],
  [
    'lp-power-sequencer',
    'ignore power good',
    'RAMP:if(power_good)state<=RESTORE;',
    'RAMP:state<=RESTORE;',
  ],
  [
    'lp-power-sequencer',
    'release isolation during restore',
    'state!=RUN&&state!=DRAIN&&state!=SAVE',
    'state!=RUN&&state!=DRAIN&&state!=SAVE&&state!=RESTORE',
  ],
];
for (const [id, name, before, after] of mutationCases) {
  const c = challenges.find((c) => c.id === id);
  const correct = solutions[id](c.starter);
  assert.ok(correct.includes(before), 'Mutation target not found: ' + name);
  const result = await simulate(correct.replace(before, after), c.testbench);
  verify(
    !result.ok && result.phase === 'simulate',
    id + ' rejects ' + name + ': ' + result.console.slice(-100),
  );
}
const cnf = challenges.find((c) => c.judge === 'cnf');
const correctCnf = 'p cnf 3 4\n1 2 -3 0\n-1 -2 -3 0\n1 -2 3 0\n-1 2 3 0';
for (const locale of ['zh', 'en']) {
  verify(gradeXorCnf(correctCnf, locale).ok, 'CNF accepts XOR in ' + locale);
  for (const input of [
    cnf.starter,
    '',
    'p cnf 3 1\n1 0',
    correctCnf + '\np cnf 3 4',
    correctCnf.replace('3 4', '3 5') + '\n1 0',
    'p cnf 3 2\n1 0\n-1 0',
    'x'.repeat(33000),
  ]) {
    verify(
      !gradeXorCnf(input, locale).ok,
      'CNF rejects invalid/overconstrained input in ' + locale,
    );
  }
}
const uvm = challenges.find((c) => c.judge === 'pattern');
const correctUvm = solutions[uvm.id](uvm.starter);
verify(
  patternFailures(correctUvm, uvm.patternRules).length === 0,
  'UVM structure accepted',
);
verify(
  patternFailures(uvm.starter, uvm.patternRules).length > 0,
  'UVM TODO starter rejected',
);
verify(
  patternFailures('/*' + correctUvm + '*/', uvm.patternRules).length > 0,
  'Comment-only UVM answer rejected',
);
const checkTask = challenges[0].testbench.match(
  /task check;[\s\S]*?endtask/,
)[0];
const scoreboard = challenges.find(
  (c) => c.id === 'verification-scoreboard-debug',
);
const inertChecker =
  scoreboard.starter.slice(0, scoreboard.starter.indexOf('//')) +
  'always @* error=0;endmodule';
verify(
  !(await simulate(inertChecker, scoreboard.testbench)).ok,
  'Scoreboard must detect injected corruption',
);
for (const value of ["1'bx", "1'bz", "1'b0"]) {
  const r = await simulate(
    'module unused;endmodule',
    'module tb;' +
      checkTask +
      ' initial begin check(' +
      value +
      ');$display("@@PASS@@");$finish;end endmodule',
  );
  verify(
    !r.ok && r.phase === 'simulate',
    'Four-state checker rejects ' + value,
  );
}
const bad = await simulate(
  'not verilog!',
  'module tb;initial $finish;endmodule',
);
verify(!bad.ok, 'Invalid Verilog rejected');
const dualChallenge = challenges.find((c) => c.id === 'rtl-edge-pulse');
const dualReference = solutions[dualChallenge.id](dualChallenge.starter);
const dual = await simulate(
  dualReference,
  dualChallenge.testbench,
  20000,
  dualReference,
  dualChallenge.id,
);
verify(
  dual.ok && Boolean(dual.vcd) && Boolean(dual.goldenVcd),
  'One request returns both user and Golden VCD data',
);
const roundRobin = challenges.find((c) => c.id === 'soc-round-robin');
const roundRobinReference = solutions[roundRobin.id](roundRobin.starter);
const falsePassCandidate = roundRobinReference.replace(
  'always @*case(req)',
  'always @*if(!clk)grant=0;else case(req)',
);
const legacyRoundRobinResult = await simulate(
  falsePassCandidate,
  roundRobin.testbench,
);
const strictRoundRobinResult = await simulate(
  falsePassCandidate,
  roundRobin.testbench,
  20000,
  roundRobinReference,
  roundRobin.id,
);
verify(
  legacyRoundRobinResult.ok,
  'Round-robin regression fixture exposes the former checkpoint-only false pass',
);
verify(
  !strictRoundRobinResult.ok &&
    strictRoundRobinResult.goldenMismatch?.signal === 'grant',
  'Round-robin Golden waveform mismatch is rejected with the failing output',
);
const watchdog = await simulate(
  'module unused;endmodule',
  "module tb;reg clk=0;always #5 clk=~clk;initial wait(1'b0);endmodule",
);
verify(
  !watchdog.ok && watchdog.console.includes('simulation-time limit reached'),
  'Simulation-time watchdog',
);
console.log('All ' + checks + ' checks passed.');
