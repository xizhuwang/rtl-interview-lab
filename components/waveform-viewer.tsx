'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle2, GitCompareArrows, XCircle } from 'lucide-react';

type Change = { time: number; value: string };
type Signal = { code: string; name: string; width: number; changes: Change[] };
type Port = { name: string; direction: 'input' | 'output' | 'inout' };
type DisplayRow = { key: string; label: string; signal: Signal; color: string; group: 'input' | 'current' | 'golden' };

const MAX_VCD_PARSE_CHARS = 620000;
const MAX_STORED_CHANGES = 20000;
const MAX_RENDERED_CHANGES = 220;
const MAX_OUTPUT_PAIRS = 7;
const MAX_INPUT_ROWS = 4;

function parseVcd(vcd: string): Signal[] {
  const lines = vcd.slice(0, MAX_VCD_PARSE_CHARS).split(/\r?\n/);
  const scopes: string[] = [];
  const definitions: Array<Omit<Signal, 'changes'>> = [];
  const changesByCode = new Map<string, Change[]>();
  let time = 0;
  let inDefinitions = true;
  let storedChanges = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (inDefinitions) {
      const scope = line.match(/^\$scope\s+\S+\s+(\S+)\s+\$end/);
      if (scope) { scopes.push(scope[1]); continue; }
      if (line.startsWith('$upscope')) { scopes.pop(); continue; }
      const variable = line.match(/^\$var\s+\S+\s+(\d+)\s+(\S+)\s+(.+?)\s+\$end/);
      if (variable) {
        const [, width, code, reference] = variable;
        definitions.push({ code, width: Number(width), name: [...scopes, reference.replace(/\s+\[[^\]]+\]$/, '')].join('.') });
        if (!changesByCode.has(code)) changesByCode.set(code, []);
        continue;
      }
      if (line.startsWith('$enddefinitions')) inDefinitions = false;
      continue;
    }
    if (line[0] === '#') { time = Number(line.slice(1)); continue; }
    const scalar = line.match(/^([01xz])(.+)$/i);
    const vector = line.match(/^b([01xz]+)\s+(.+)$/i);
    const code = scalar?.[2] ?? vector?.[2];
    const value = scalar?.[1] ?? vector?.[1];
    if (code && value && changesByCode.has(code) && storedChanges < MAX_STORED_CHANGES) {
      changesByCode.get(code)?.push({ time, value: value.toLowerCase() });
      storedChanges += 1;
    }
  }

  return definitions
    .map((definition) => ({ ...definition, changes: changesByCode.get(definition.code) ?? [] }))
    .filter((signal) => signal.changes.length && signal.width <= 32);
}

function parsePorts(source: string): Port[] {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const header = clean.match(/\bmodule\s+[A-Za-z_]\w*\s*(?:#\s*\([\s\S]*?\)\s*)?\(([\s\S]*?)\)\s*;/)?.[1] ?? '';
  const ports: Port[] = [];
  let direction: Port['direction'] | null = null;
  for (const part of header.split(',')) {
    const directionMatch = part.match(/\b(input|output|inout)\b/);
    if (directionMatch) direction = directionMatch[1] as Port['direction'];
    const name = part.match(/([A-Za-z_]\w*)\s*$/)?.[1];
    if (direction && name) ports.push({ name, direction });
  }
  for (const declaration of clean.matchAll(/\b(input|output|inout)\b\s+(?:wire\s+|reg\s+|signed\s+|\[[^\]]+\]\s*)*([^;]+);/g)) {
    const declaredDirection = declaration[1] as Port['direction'];
    for (const item of declaration[2].split(',')) {
      const name = item.match(/([A-Za-z_]\w*)\s*$/)?.[1];
      if (name && !ports.some((port) => port.name === name)) ports.push({ name, direction: declaredDirection });
    }
  }
  return ports;
}

function leafName(name: string) {
  return name.split('.').at(-1)?.replace(/\[[^\]]+\]$/, '') ?? name;
}

function findPortSignal(signals: Signal[], port: string) {
  return signals
    .filter((signal) => leafName(signal.name) === port)
    .sort((a, b) => {
      const score = (signal: Signal) => /\.dut\./.test(signal.name) ? 0 : /\.d\./.test(signal.name) ? 1 : signal.name.startsWith('tb.') ? 2 : 3;
      return score(a) - score(b) || a.name.length - b.name.length;
    })[0];
}

function sampledChanges(changes: Change[]) {
  if (changes.length <= MAX_RENDERED_CHANGES) return changes;
  const stride = Math.ceil(changes.length / MAX_RENDERED_CHANGES);
  const sampled = changes.filter((_, index) => index % stride === 0);
  const last = changes.at(-1);
  if (last && sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

function valueAt(changes: Change[], time: number) {
  let value = 'x';
  for (const change of changes) {
    if (change.time > time) break;
    value = change.value;
  }
  return value;
}

function signalsMatch(current: Signal, golden: Signal) {
  let currentIndex = 0;
  let goldenIndex = 0;
  let currentValue = 'x';
  let goldenValue = 'x';
  while (currentIndex < current.changes.length || goldenIndex < golden.changes.length) {
    const nextCurrent = current.changes[currentIndex]?.time ?? Number.POSITIVE_INFINITY;
    const nextGolden = golden.changes[goldenIndex]?.time ?? Number.POSITIVE_INFINITY;
    const time = Math.min(nextCurrent, nextGolden);
    while (current.changes[currentIndex]?.time === time) currentValue = current.changes[currentIndex++].value;
    while (golden.changes[goldenIndex]?.time === time) goldenValue = golden.changes[goldenIndex++].value;
    if (currentValue !== goldenValue) return false;
  }
  return true;
}

export function WaveformViewer({ currentVcd, goldenVcd, design, locale }: { currentVcd: string; goldenVcd: string; design: string; locale: 'zh' | 'en' }) {
  const currentSignals = useMemo(() => parseVcd(currentVcd), [currentVcd]);
  const goldenSignals = useMemo(() => parseVcd(goldenVcd), [goldenVcd]);
  const ports = useMemo(() => parsePorts(design), [design]);
  const comparison = useMemo(() => {
    const outputs = ports.filter((port) => port.direction !== 'input').slice(0, MAX_OUTPUT_PAIRS);
    const pairs = outputs.flatMap((port) => {
      const current = findPortSignal(currentSignals, port.name);
      const golden = findPortSignal(goldenSignals, port.name);
      return current && golden ? [{ port: port.name, current, golden, match: signalsMatch(current, golden) }] : [];
    });
    const inputs = ports
      .filter((port) => port.direction === 'input')
      .map((port) => ({ port: port.name, signal: findPortSignal(currentSignals, port.name) }))
      .filter((item): item is { port: string; signal: Signal } => Boolean(item.signal))
      .sort((a, b) => {
        const priority = (name: string) => /clk|clock/.test(name.toLowerCase()) ? 0 : /rst|reset/.test(name.toLowerCase()) ? 1 : 2;
        return priority(a.port) - priority(b.port);
      })
      .slice(0, MAX_INPUT_ROWS);
    return { pairs, inputs };
  }, [currentSignals, goldenSignals, ports]);

  const rows: DisplayRow[] = [
    ...comparison.inputs.map(({ port, signal }) => ({ key: `input-${port}`, label: `${locale === 'zh' ? '輸入' : 'Input'} · ${port}`, signal, color: '#64748b', group: 'input' as const })),
    ...comparison.pairs.flatMap(({ port, current, golden }) => [
      { key: `current-${port}`, label: `${locale === 'zh' ? '你的' : 'Yours'} · ${port}`, signal: current, color: '#0891b2', group: 'current' as const },
      { key: `golden-${port}`, label: `Golden · ${port}`, signal: golden, color: '#8b5cf6', group: 'golden' as const },
    ]),
  ];
  const waveformLimited = [currentVcd, goldenVcd].some((vcd) => vcd.includes('SOC_RTL_WAVEFORM_TRUNCATED') || vcd.length > MAX_VCD_PARSE_CHARS);
  const timescale = (currentVcd || goldenVcd).match(/\$timescale\s+([^$]+)\$end/)?.[1].trim() ?? 'VCD tick';
  const maxTime = Math.max(1, ...rows.flatMap((row) => row.signal.changes.map((change) => change.time)));
  const plotX = 188;
  const plotWidth = 742;
  const rowHeight = 38;
  const height = 36 + rows.length * rowHeight;
  const xFor = (time: number) => plotX + (time / maxTime) * plotWidth;

  if (!rows.length) return <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{locale === 'zh' ? '模擬已產生波形，但目前找不到可對照的 DUT 輸出腳位。' : 'The simulation produced a waveform, but no comparable DUT output ports were found.'}</section>;

  return <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><GitCompareArrows className="size-4 text-primary" />{locale === 'zh' ? '你的波形 vs Golden 波形' : 'Your waveform vs Golden waveform'}</div>
      <p className="text-xs text-muted-foreground"><span className="text-cyan-600">● {locale === 'zh' ? '你的 RTL' : 'Your RTL'}</span> · <span className="text-violet-600">● Golden</span> · tick = {timescale}</p>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border bg-muted/25 px-4 py-2">
      {comparison.pairs.map((pair) => <span key={pair.port} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[11px] ${pair.match ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'}`}>{pair.match ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}{pair.port}</span>)}
    </div>
    <div className="overflow-x-auto p-3">
      <svg viewBox={`0 0 950 ${height}`} className="min-w-[900px]" aria-label={locale === 'zh' ? '使用者與 Golden 模擬波形比較' : 'User and Golden simulation waveform comparison'}>
        {Array.from({ length: 11 }, (_, index) => {
          const x = plotX + index * (plotWidth / 10);
          return <g key={index}><line x1={x} x2={x} y1={22} y2={height} stroke="currentColor" className="text-border" strokeWidth="1" /><text x={x} y={14} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">{Math.round((maxTime * index) / 10)}</text></g>;
        })}
        {rows.map((row, index) => {
          const y = 34 + index * rowHeight;
          const visibleChanges = sampledChanges(row.signal.changes);
          const separator = row.group === 'current' && index > 0;
          if (row.signal.width === 1) {
            const times = [...new Set([0, ...visibleChanges.map((change) => change.time), maxTime])].sort((a, b) => a - b);
            let path = '';
            times.forEach((sampleTime, sampleIndex) => {
              const value = valueAt(row.signal.changes, sampleTime);
              const level = value === '1' ? y : value === '0' ? y + 18 : y + 9;
              const x = xFor(sampleTime);
              path += sampleIndex === 0 ? `M ${x} ${level}` : ` H ${x} V ${level}`;
            });
            return <g key={row.key}>{separator && <line x1="0" x2="950" y1={y - 8} y2={y - 8} className="text-border" stroke="currentColor" strokeDasharray="3 4" />}<text x="4" y={y + 13} className="fill-foreground font-mono text-[11px]">{row.label.slice(-29)}</text><path d={path} fill="none" stroke={row.color} strokeWidth="2" /></g>;
          }
          const times = [...new Set([0, ...visibleChanges.map((change) => change.time), maxTime])].sort((a, b) => a - b);
          const segments = times.slice(0, -1).map((start, changeIndex) => ({ start, end: times[changeIndex + 1], value: valueAt(row.signal.changes, start) }));
          return <g key={row.key}>{separator && <line x1="0" x2="950" y1={y - 8} y2={y - 8} className="text-border" stroke="currentColor" strokeDasharray="3 4" />}<text x="4" y={y + 13} className="fill-foreground font-mono text-[11px]">{row.label.slice(-29)}</text>{segments.map((segment, segmentIndex) => { const x = xFor(segment.start); const width = Math.max(1, xFor(segment.end) - x); return <g key={segmentIndex}><rect x={x} y={y + 1} width={width} height="18" fill="transparent" stroke={row.color} /><text x={x + 3} y={y + 14} className="font-mono text-[9px]" fill={row.color}>{width > 30 ? (/[xz]/i.test(segment.value) ? `b${segment.value}` : `0x${Number.parseInt(segment.value, 2).toString(16)}`) : ''}</text></g>; })}</g>;
        })}
      </svg>
    </div>
    <p className="flex items-start gap-2 border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground"><Activity className="mt-0.5 size-3.5 shrink-0" />{locale === 'zh' ? '灰色列是兩次模擬共用的輸入；每個 DUT 輸出都以「你的／Golden」相鄰兩列顯示。上方紅色標記代表該輸出至少有一個時間點不一致。' : 'Gray rows are shared inputs. Every DUT output is shown as adjacent Your/Golden rows. A red badge means the output differs at one or more timestamps.'}{waveformLimited ? (locale === 'zh' ? ' 為避免頁面卡頓，圖形只顯示波形前段；判題仍使用完整模擬結果。' : ' To keep the page responsive, the plot shows only an early preview; grading still uses the complete simulation.') : ''}</p>
  </section>;
}
