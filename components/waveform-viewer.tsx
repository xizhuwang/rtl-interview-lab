'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';

type Change = { time: number; value: string };
type Signal = { code: string; name: string; width: number; changes: Change[] };

function parseVcd(vcd: string): Signal[] {
  const lines = vcd.split(/\r?\n/);
  const scopes: string[] = [];
  const signals = new Map<string, Signal>();
  let time = 0;
  let definitions = true;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (definitions) {
      const scope = line.match(/^\$scope\s+\S+\s+(\S+)\s+\$end/);
      if (scope) { scopes.push(scope[1]); continue; }
      if (line.startsWith('$upscope')) { scopes.pop(); continue; }
      const variable = line.match(/^\$var\s+\S+\s+(\d+)\s+(\S+)\s+(.+?)\s+\$end/);
      if (variable) {
        const [, width, code, reference] = variable;
        signals.set(code, { code, width: Number(width), name: [...scopes, reference.replace(/\s+\[[^\]]+\]$/, '')].join('.'), changes: [] });
        continue;
      }
      if (line.startsWith('$enddefinitions')) definitions = false;
      continue;
    }
    if (line[0] === '#') { time = Number(line.slice(1)); continue; }
    const scalar = line.match(/^([01xz])(.+)$/i);
    if (scalar && signals.has(scalar[2])) signals.get(scalar[2])?.changes.push({ time, value: scalar[1].toLowerCase() });
    const vector = line.match(/^b([01xz]+)\s+(.+)$/i);
    if (vector && signals.has(vector[2])) signals.get(vector[2])?.changes.push({ time, value: vector[1].toLowerCase() });
  }

  const priority = (signal: Signal) => {
    const name = signal.name.toLowerCase();
    if (name.includes('expected')) return 0;
    if (/(pulse|valid|ready|error|done|busy|grant|count|control|sum|\.y$)/.test(name)) return 1;
    if (name.endsWith('.clk') || name.includes('clock')) return 2;
    if (name.startsWith('tb.')) return 3;
    return 5;
  };
  return [...signals.values()]
    .filter((signal) => signal.changes.length && signal.width <= 32)
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, 10);
}

function valueAt(changes: Change[], time: number) {
  let value = 'x';
  for (const change of changes) {
    if (change.time > time) break;
    value = change.value;
  }
  return value;
}

export function WaveformViewer({ vcd, locale }: { vcd: string; locale: 'zh' | 'en' }) {
  const signals = useMemo(() => parseVcd(vcd), [vcd]);
  const timescale = vcd.match(/\$timescale\s+([^$]+)\$end/)?.[1].trim() ?? 'VCD tick';
  const maxTime = Math.max(1, ...signals.flatMap((signal) => signal.changes.map((change) => change.time)));
  const plotX = 170;
  const plotWidth = 760;
  const rowHeight = 42;
  const height = 38 + signals.length * rowHeight;
  const xFor = (time: number) => plotX + (time / maxTime) * plotWidth;

  if (!signals.length) return null;

  return <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-primary" />{locale === 'zh' ? '編譯後波形' : 'Simulation waveform'}</div>
      <p className="text-xs text-muted-foreground">{locale === 'zh' ? '紫色為 expected_*；青色為 DUT／測試訊號' : 'Purple: expected_* · Cyan: DUT/test signals'} · tick = {timescale}</p>
    </div>
    <div className="overflow-x-auto p-3">
      <svg viewBox={`0 0 950 ${height}`} className="min-w-[900px]" aria-label={locale === 'zh' ? '模擬波形圖' : 'Simulation waveform plot'}>
        {Array.from({ length: 11 }, (_, index) => {
          const x = plotX + index * (plotWidth / 10);
          return <g key={index}><line x1={x} x2={x} y1={24} y2={height} stroke="currentColor" className="text-border" strokeWidth="1" /><text x={x} y={15} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">{Math.round((maxTime * index) / 10)}</text></g>;
        })}
        {signals.map((signal, index) => {
          const y = 38 + index * rowHeight;
          const expected = signal.name.toLowerCase().includes('expected');
          const color = expected ? '#8b5cf6' : '#0891b2';
          const shortName = signal.name.replace(/^tb\./, '').replace(/\.(dut|d)\./, '.');
          if (signal.width === 1) {
            const times = [...new Set([0, ...signal.changes.map((change) => change.time), maxTime])].sort((a, b) => a - b);
            let path = '';
            times.forEach((sampleTime, sampleIndex) => {
              const value = valueAt(signal.changes, sampleTime);
              const level = value === '1' ? y : value === '0' ? y + 20 : y + 10;
              const x = xFor(sampleTime);
              if (sampleIndex === 0) path = `M ${x} ${level}`;
              else path += ` H ${x} V ${level}`;
            });
            return <g key={signal.code}><text x="4" y={y + 14} className="fill-foreground font-mono text-[11px]">{shortName.slice(-23)}</text><path d={path} fill="none" stroke={color} strokeWidth="2" /></g>;
          }
          const segments = signal.changes.map((change, changeIndex) => ({ start: change.time, end: signal.changes[changeIndex + 1]?.time ?? maxTime, value: change.value }));
          return <g key={signal.code}><text x="4" y={y + 14} className="fill-foreground font-mono text-[11px]">{shortName.slice(-23)}</text>{segments.map((segment, segmentIndex) => { const x = xFor(segment.start); const width = Math.max(1, xFor(segment.end) - x); return <g key={segmentIndex}><rect x={x} y={y + 2} width={width} height="20" fill="transparent" stroke={color} /><text x={x + 3} y={y + 16} className="font-mono text-[9px]" fill={color}>{width > 28 ? (/[xz]/i.test(segment.value) ? `b${segment.value}` : `0x${Number.parseInt(segment.value, 2).toString(16)}`) : ''}</text></g>;})}</g>;
        })}
      </svg>
    </div>
    <p className="border-t border-border px-4 py-3 text-xs leading-5 text-muted-foreground">{locale === 'zh' ? '波形來自同一次瀏覽器內模擬。若題目的 testbench 提供 expected_* golden 訊號，會一起顯示以協助逐拍比對。' : 'Waveforms come from the same in-browser simulation. When a testbench exposes expected_* golden signals, they appear for cycle-by-cycle comparison.'}</p>
  </section>;
}
