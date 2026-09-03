// SoC RTL Lab orchestration, updated 2026-09-03; GPL-2.0-or-later.
// Tool binaries are downloaded from their upstream distributor, not republished.
import { loadIcarus } from './runtime-loader.js';
let initIvlpp, initIvl, initVvp;

const sanitize = (source) => String(source || '')
  .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
  .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"');

const ivlConfig = (generation) => `basedir:/
module:system.vpi
generation:${generation}
generation:no-specify
out:/out.vvp
iwidth:32
widthcap:65536
functor:cprop
functor:nodangle
flag:DLL=vvp.tgt
`;

async function preprocess(files) {
  const output = [];
  const engine = await initIvlpp({ print: (line) => output.push(line), printErr: () => {} });
  const args = ['-L'];
  for (const file of files) {
    engine.FS.writeFile('/' + file.name, file.source.endsWith('\n') ? file.source : file.source + '\n');
    args.push('/' + file.name);
  }
  engine.callMain(args);
  return output.join('\n') + '\n';
}

async function compile(source, generation) {
  const errors = [];
  const engine = await initIvl({ print: () => {}, printErr: (line) => errors.push(line) });
  engine.FS.writeFile('/ivl.conf', ivlConfig(generation));
  engine.FS.writeFile('/src.v', source);
  engine.callMain(['-C/ivl.conf', '--', '/src.v']);
  let program = null;
  try { program = engine.FS.readFile('/out.vvp'); } catch { /* Compilation diagnostics are returned below. */ }
  return { program, diagnostics: errors.join('\n') };
}

async function simulate(program) {
  const output = [];
  const engine = await initVvp({ print: (line) => output.push(line), printErr: (line) => output.push(line) });
  engine.FS.writeFile('/sim.vvp', program);
  engine.callMain(['/sim.vvp']);
  let vcd = null;
  try { vcd = engine.FS.readFile('/dump.vcd', { encoding: 'utf8' }); } catch { /* Simulations may finish without a VCD. */ }
  return { console: output.join('\n'), vcd };
}

let yosysRun = null;
async function synthesize(source, generation) {
  if (!yosysRun) {
    const yosys = await import('https://cdn.jsdelivr.net/npm/@yowasp/yosys@0.65.176-dev.1145/gen/bundle.js');
    yosysRun = yosys.runYosys;
  }
  let log = '';
  const read = generation === '2005' ? 'read_verilog design.v; ' : 'read_verilog -sv design.v; ';
  const script = read + 'synth -auto-top -flatten; delete t:$scopeinfo; opt_clean; write_json out.json';
  const output = await yosysRun(
    ['-q', '-p', script],
    { 'design.v': new TextEncoder().encode(source) },
    { stdout: (value) => { log += String(value); }, stderr: (value) => { log += String(value); } },
  );
  if (!output?.['out.json']) throw new Error(log || 'No synthesized netlist was produced.');
  const raw = output['out.json'];
  const jsonText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
  const netlist = JSON.parse(jsonText);
  const counts = {};
  let total = 0;
  Object.values(netlist.modules || {}).forEach((module) => {
    Object.values(module.cells || {}).forEach((cell) => {
      counts[cell.type] = (counts[cell.type] || 0) + 1;
      total += 1;
    });
  });
  return { total, counts };
}

self.addEventListener('message', async (event) => {
  if (event.data?.type === 'SOC_RTL_ENGINE_PING') {
    self.postMessage({ type: 'SOC_RTL_ENGINE_READY' });
    return;
  }
  if (event.data?.type === 'SOC_RTL_SYNTH') {
    const started = performance.now();
    try {
      const result = await synthesize(sanitize(event.data.design), event.data.generation || '2012');
      const reference = event.data.reference
        ? await synthesize(sanitize(event.data.reference), event.data.generation || '2012')
        : null;
      self.postMessage({
        type: 'SOC_RTL_SYNTH_RESULT', requestId: event.data.requestId, ok: true, ...result,
        referenceTotal: reference?.total ?? null, referenceCounts: reference?.counts ?? null,
        elapsedMs: performance.now() - started,
      });
    } catch (error) {
      self.postMessage({ type: 'SOC_RTL_SYNTH_RESULT', requestId: event.data.requestId, ok: false, console: error?.message || String(error), elapsedMs: performance.now() - started });
    }
    return;
  }
  if (event.data?.type !== 'SOC_RTL_RUN') return;
  const started = performance.now();
  try {
    ({ initIvlpp, initIvl, initVvp } = await loadIcarus());
    const design = sanitize(event.data.design);
    const testbench = sanitize(event.data.testbench).replace(
      /module\s+tb\s*;/,
      '$&\ninitial begin $dumpfile("/dump.vcd"); $dumpvars(0, tb); end\ninitial begin #10000; $display("@@FAIL@@ simulation-time limit reached"); $finish; end\n',
    );
    const source = await preprocess([
      { name: 'design.v', source: '`timescale 1ns/1ps\n' + design },
      { name: 'testbench.v', source: '`timescale 1ns/1ps\n' + testbench },
    ]);
    const compiled = await compile(source, event.data.generation || '2012');
    const diagnostics = compiled.diagnostics
      .split('\n')
      .filter((line) => !/system\.vpi|dynamic linking not enabled/.test(line))
      .join('\n')
      .trim();
    if (!compiled.program) {
      self.postMessage({
        type: 'SOC_RTL_RESULT',
        requestId: event.data.requestId,
        ok: false,
        phase: 'compile',
        console: diagnostics || 'Compilation failed.',
        elapsedMs: performance.now() - started,
      });
      return;
    }
    const result = await simulate(compiled.program);
    self.postMessage({
      type: 'SOC_RTL_RESULT',
      requestId: event.data.requestId,
      ok: result.console.includes('@@PASS@@') && !result.console.includes('@@FAIL@@'),
      phase: 'simulate',
      console: [diagnostics, result.console].filter(Boolean).join('\n'),
      vcd: result.vcd,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    self.postMessage({
      type: 'SOC_RTL_RESULT',
      requestId: event.data.requestId,
      ok: false,
      phase: 'engine',
      console: error?.message || String(error),
      elapsedMs: performance.now() - started,
    });
  }
});
