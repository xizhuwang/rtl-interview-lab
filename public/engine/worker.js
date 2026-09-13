// SoC RTL Lab orchestration, updated 2026-09-03; GPL-2.0-or-later.
// Tool binaries are downloaded from their upstream distributor, not republished.
import { loadIcarus } from './runtime-loader.js';
let initIvlpp, initIvl, initVvp;
const MAX_VCD_CHARS = 600000;
const VCD_TRUNCATION_MARKER = '$comment SOC_RTL_WAVEFORM_TRUNCATED $end';
const goldenVcdCache = new Map();

function limitVcd(vcd) {
  if (!vcd || vcd.length <= MAX_VCD_CHARS) return vcd;
  const lastCompleteLine = vcd.lastIndexOf('\n', MAX_VCD_CHARS);
  const cut = lastCompleteLine > 0 ? lastCompleteLine : MAX_VCD_CHARS;
  return `${vcd.slice(0, cut)}\n${VCD_TRUNCATION_MARKER}\n`;
}

function parseChecks(output) {
  return String(output || '')
    .split('\n')
    .map((line) => line.match(/^@@CHECK@@\s+step=(\S+)\s+signal=(\S+)\s+cycle=(\d+)\s+expected=(\S+)\s+actual=(\S+)\s+pass=([01])$/))
    .filter(Boolean)
    .slice(0, 32)
    .map((match) => ({
      step: match[1],
      signal: match[2],
      cycle: Number(match[3]),
      expected: match[4],
      actual: match[5],
      pass: match[6] === '1',
    }));
}

function cleanSimulationConsole(output) {
  return String(output || '')
    .split('\n')
    .filter((line) => !line.startsWith('@@CHECK@@'))
    .join('\n');
}

function firstModuleOutputNames(source) {
  const text = String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n\r]*/g, ' ');
  const moduleMatch = /\bmodule\s+[A-Za-z_$][\w$]*/.exec(text);
  if (!moduleMatch) return [];

  let cursor = moduleMatch.index + moduleMatch[0].length;
  const skipSpace = () => {
    while (/\s/.test(text[cursor] || '')) cursor += 1;
  };
  const skipBalanced = () => {
    if (text[cursor] !== '(') return false;
    let depth = 0;
    for (; cursor < text.length; cursor += 1) {
      if (text[cursor] === '(') depth += 1;
      else if (text[cursor] === ')') {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          return true;
        }
      }
    }
    return false;
  };

  skipSpace();
  if (text[cursor] === '#') {
    cursor += 1;
    skipSpace();
    if (!skipBalanced()) return [];
    skipSpace();
  }
  if (text[cursor] !== '(') return [];
  const portStart = cursor + 1;
  if (!skipBalanced()) return [];
  const header = text.slice(portStart, cursor - 1);

  const parts = [];
  let start = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let index = 0; index <= header.length; index += 1) {
    const char = header[index];
    if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    if ((char === ',' && bracketDepth === 0 && parenDepth === 0) || index === header.length) {
      parts.push(header.slice(start, index));
      start = index + 1;
    }
  }

  const outputs = [];
  let direction = null;
  for (const rawPart of parts) {
    const directionMatch = rawPart.match(/\b(input|output|inout)\b/);
    if (directionMatch) direction = directionMatch[1];
    if (direction !== 'output') continue;
    const declaration = rawPart
      .replace(/\b(input|output|inout|wire|reg|logic|signed|unsigned|tri|supply0|supply1)\b/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .split('=')[0];
    const names = declaration.match(/[A-Za-z_$][\w$]*/g);
    if (names?.length) outputs.push(names[names.length - 1]);
  }
  return [...new Set(outputs)];
}

function parseVcdOutputs(vcd, outputNames) {
  const wanted = new Set(outputNames);
  const scopes = [];
  const candidates = new Map();
  const lines = String(vcd || '').split(/\r?\n/);
  let definitionsEnded = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$scope ')) {
      const match = trimmed.match(/^\$scope\s+\S+\s+(\S+)\s+\$end$/);
      if (match) scopes.push(match[1]);
      continue;
    }
    if (trimmed.startsWith('$upscope')) {
      scopes.pop();
      continue;
    }
    if (trimmed.startsWith('$var ')) {
      const match = trimmed.match(/^\$var\s+\S+\s+(\d+)\s+(\S+)\s+([^\s[]+)/);
      if (!match || !wanted.has(match[3])) continue;
      const signal = match[3];
      const path = `${scopes.join('.')}.${signal}`;
      const score = /(^|\.)dut\./.test(path) ? 2 : scopes.at(-1) === 'tb' ? 1 : 0;
      const previous = candidates.get(signal);
      if (!previous || score > previous.score) {
        candidates.set(signal, {
          code: match[2],
          width: Number(match[1]),
          path,
          score,
        });
      }
      continue;
    }
    if (trimmed.startsWith('$enddefinitions')) {
      definitionsEnded = true;
      break;
    }
  }
  if (!definitionsEnded) return { signals: new Map(), missing: outputNames };

  const codeToSignals = new Map();
  const signals = new Map();
  for (const [name, candidate] of candidates) {
    const aliases = codeToSignals.get(candidate.code) || [];
    aliases.push(name);
    codeToSignals.set(candidate.code, aliases);
    signals.set(name, { width: candidate.width, changes: new Map() });
  }

  let time = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] === '$') continue;
    if (trimmed[0] === '#') {
      const nextTime = Number(trimmed.slice(1));
      if (Number.isFinite(nextTime)) time = nextTime;
      continue;
    }
    let value = null;
    let code = null;
    const scalar = trimmed.match(/^([01xXzZ])(.+)$/);
    const vector = trimmed.match(/^[bB]([01xXzZ]+)\s+(\S+)$/);
    if (vector) {
      value = vector[1].toLowerCase();
      code = vector[2];
    } else if (scalar) {
      value = scalar[1].toLowerCase();
      code = scalar[2].trim();
    }
    const names = code ? codeToSignals.get(code) : null;
    if (names && value !== null) {
      for (const name of names) signals.get(name).changes.set(time, value);
    }
  }
  return {
    signals,
    missing: outputNames.filter((name) => !signals.has(name)),
  };
}

function normalizeVcdValue(value, width) {
  if (value === null || value === undefined) return 'x'.repeat(Math.max(1, width));
  const normalized = String(value).toLowerCase();
  if (/^[xz]$/.test(normalized) && width > 1) return normalized.repeat(width);
  if (/^[01]+$/.test(normalized)) return normalized.padStart(width, '0').slice(-width);
  return normalized.padStart(width, normalized[0] || 'x').slice(-width);
}

function compareGoldenOutputs(currentVcd, goldenVcd, outputNames) {
  if (!goldenVcd || !outputNames.length)
    return { matches: true, comparedSignals: 0, mismatch: null };
  const current = parseVcdOutputs(currentVcd, outputNames);
  const golden = parseVcdOutputs(goldenVcd, outputNames);
  const missing = [...new Set([...current.missing, ...golden.missing])];
  if (missing.length) {
    return {
      matches: false,
      comparedSignals: 0,
      mismatch: { signal: missing[0], time: 0, expected: 'present in Golden VCD', actual: 'missing from waveform' },
    };
  }

  let comparedSignals = 0;
  for (const name of outputNames) {
    const currentSignal = current.signals.get(name);
    const goldenSignal = golden.signals.get(name);
    const width = Math.max(currentSignal.width, goldenSignal.width, 1);
    const times = [...new Set([
      ...currentSignal.changes.keys(),
      ...goldenSignal.changes.keys(),
    ])].sort((a, b) => a - b);
    let currentValue = null;
    let goldenValue = null;
    let started = false;
    let comparedThisSignal = false;
    for (const time of times) {
      if (currentSignal.changes.has(time)) currentValue = currentSignal.changes.get(time);
      if (goldenSignal.changes.has(time)) goldenValue = goldenSignal.changes.get(time);
      const expected = normalizeVcdValue(goldenValue, width);
      const actual = normalizeVcdValue(currentValue, width);
      if (!started && !/[xz]/.test(expected)) started = true;
      if (!started) continue;
      comparedThisSignal = true;
      if (actual !== expected) {
        return {
          matches: false,
          comparedSignals,
          mismatch: { signal: name, time, expected, actual },
        };
      }
    }
    if (comparedThisSignal) comparedSignals += 1;
  }
  return { matches: true, comparedSignals, mismatch: null };
}

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

async function compileAndSimulate(design, testbench, generation) {
  const source = await preprocess([
    { name: 'design.v', source: '`timescale 1ns/1ps\n' + design },
    { name: 'testbench.v', source: '`timescale 1ns/1ps\n' + testbench },
  ]);
  const compiled = await compile(source, generation);
  const diagnostics = compiled.diagnostics
    .split('\n')
    .filter((line) => !/system\.vpi|dynamic linking not enabled/.test(line))
    .join('\n')
    .trim();
  if (!compiled.program) return { diagnostics, result: null };
  return { diagnostics, result: await simulate(compiled.program) };
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
    const generation = event.data.generation || '2012';
    const currentRun = await compileAndSimulate(design, testbench, generation);
    if (!currentRun.result) {
      self.postMessage({
        type: 'SOC_RTL_RESULT',
        requestId: event.data.requestId,
        ok: false,
        phase: 'compile',
        console: currentRun.diagnostics || 'Compilation failed.',
        elapsedMs: performance.now() - started,
      });
      return;
    }
    const result = currentRun.result;
    let goldenVcd = null;
    if (event.data.reference) {
      const cacheKey = `${event.data.challengeId || 'anonymous'}:${generation}`;
      goldenVcd = goldenVcdCache.get(cacheKey) || null;
      if (!goldenVcd) {
        const goldenRun = await compileAndSimulate(
          sanitize(event.data.reference),
          testbench,
          generation,
        );
        if (goldenRun.result) {
          goldenVcd = limitVcd(goldenRun.result.vcd);
          if (goldenVcd) {
            if (goldenVcdCache.size >= 8)
              goldenVcdCache.delete(goldenVcdCache.keys().next().value);
            goldenVcdCache.set(cacheKey, goldenVcd);
          }
        }
      }
    }
    const checks = parseChecks(result.console);
    const outputNames = firstModuleOutputNames(design);
    const currentVcd = limitVcd(result.vcd);
    const goldenComparison = compareGoldenOutputs(currentVcd, goldenVcd, outputNames);
    const testbenchPassed = result.console.includes('@@PASS@@') && !result.console.includes('@@FAIL@@');
    const mismatchMessage = goldenComparison.mismatch
      ? `Golden waveform mismatch: signal=${goldenComparison.mismatch.signal} time=${goldenComparison.mismatch.time} expected=${goldenComparison.mismatch.expected} actual=${goldenComparison.mismatch.actual}`
      : '';
    self.postMessage({
      type: 'SOC_RTL_RESULT',
      requestId: event.data.requestId,
      ok: testbenchPassed && goldenComparison.matches,
      phase: 'simulate',
      console: [currentRun.diagnostics, cleanSimulationConsole(result.console), mismatchMessage].filter(Boolean).join('\n'),
      checks,
      vcd: currentVcd,
      goldenVcd,
      goldenComparedSignals: goldenComparison.comparedSignals,
      goldenMismatch: goldenComparison.mismatch,
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
