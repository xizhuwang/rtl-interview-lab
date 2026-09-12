import { memo } from 'react';
import { ArrowDown, ArrowRight, Cable, Network } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { localize, type Locale } from '@/lib/challenges';
import type { SocLearningAid } from '@/lib/soc-learning-aids';

const copy = {
  zh: {
    title: '系統位置與資料流',
    diagram: '簡化系統架構',
    upstream: '上游／輸入來源',
    module: '你要完成的模組',
    downstream: '下游／輸出目的',
    ports: '逐腳位說明',
    signal: '訊號',
    direction: '方向',
    width: '寬度',
    timing: '何時有效／何時取樣',
    purpose: '在系統中的用途',
    paths: '真正的資料路徑',
    operation: '操作',
    source: '來源',
    destination: '目的',
    rule: '規則',
    input: '輸入',
    output: '輸出',
  },
  en: {
    title: 'System position and data flow',
    diagram: 'Simplified system architecture',
    upstream: 'Upstream / sources',
    module: 'Module you implement',
    downstream: 'Downstream / destinations',
    ports: 'Port-by-port contract',
    signal: 'Signal',
    direction: 'Direction',
    width: 'Width',
    timing: 'Validity / sampling rule',
    purpose: 'Purpose in the system',
    paths: 'Actual data paths',
    operation: 'Operation',
    source: 'Source',
    destination: 'Destination',
    rule: 'Rule',
    input: 'Input',
    output: 'Output',
  },
};

export const SocInterfaceGuide = memo(function SocInterfaceGuide({ aid, locale }: { aid: SocLearningAid; locale: Locale }) {
  const text = copy[locale];
  return (
    <section className="soc-interface-guide mt-4 border-t border-border pt-4" aria-labelledby="soc-interface-guide-title">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-amber-500" />
        <h2 id="soc-interface-guide-title" className="text-sm font-semibold text-foreground">
          {text.title}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{localize(aid.context, locale)}</p>

      <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800 dark:text-amber-200">
          {text.diagram}
        </p>
        <div className="grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1.15fr)_32px_minmax(0,1fr)]">
          <ArchitectureColumn title={text.upstream} items={aid.architecture.sources.map((item) => localize(item, locale))} />
          <div className="flex items-center justify-center text-amber-500" aria-hidden="true">
            <ArrowRight className="hidden size-5 md:block" />
            <ArrowDown className="size-5 md:hidden" />
          </div>
          <div className="flex min-h-24 flex-col justify-center rounded-lg border-2 border-amber-400 bg-card px-3 py-3 text-center shadow-sm dark:border-amber-600">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">{text.module}</span>
            <strong className="mt-1 text-sm text-foreground">{localize(aid.architecture.focus, locale)}</strong>
          </div>
          <div className="flex items-center justify-center text-amber-500" aria-hidden="true">
            <ArrowRight className="hidden size-5 md:block" />
            <ArrowDown className="size-5 md:hidden" />
          </div>
          <ArchitectureColumn title={text.downstream} items={aid.architecture.sinks.map((item) => localize(item, locale))} />
        </div>
        <p className="mt-3 border-t border-amber-200 pt-3 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:text-amber-100">
          {localize(aid.architecture.flow, locale)}
        </p>
      </div>

      {aid.dataPaths?.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50/50 dark:border-cyan-900 dark:bg-cyan-950/20">
          <p className="border-b border-cyan-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-900 dark:border-cyan-900 dark:text-cyan-100">
            {text.paths}
          </p>
          <div className="divide-y divide-cyan-200 dark:divide-cyan-900">
            {aid.dataPaths.map((path) => (
              <div key={`${path.source}-${path.destination}`} className="grid gap-1 px-3 py-3 text-xs sm:grid-cols-[7rem_minmax(0,11rem)_minmax(0,1fr)] sm:items-center sm:gap-3">
                <strong className="text-foreground">{localize(path.operation, locale)}</strong>
                <span className="font-mono font-semibold text-cyan-800 dark:text-cyan-200">
                  {path.source} → {path.destination}
                </span>
                <span className="leading-5 text-muted-foreground">{localize(path.rule, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details className="mt-3 overflow-hidden rounded-xl border border-border bg-card" open>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-semibold text-foreground">
          <Cable className="size-4 text-cyan-500" />
          {text.ports}
          <Badge variant="secondary" className="ml-auto">{aid.ports.length}</Badge>
        </summary>
        <div className="border-t border-border">
          <table className="block w-full border-collapse text-left text-xs md:table">
            <thead className="hidden bg-muted/70 text-muted-foreground md:table-header-group">
              <tr>
                <th className="px-3 py-2 font-semibold">{text.signal}</th>
                <th className="px-3 py-2 font-semibold">{text.direction}</th>
                <th className="px-3 py-2 font-semibold">{text.width}</th>
                <th className="px-3 py-2 font-semibold">{text.timing}</th>
                <th className="px-3 py-2 font-semibold">{text.purpose}</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {aid.ports.map((port) => (
                <tr key={port.name} className="block border-t border-border px-3 py-3 align-top first:border-t-0 md:table-row md:px-0 md:py-0 md:first:border-t">
                  <td className="flex items-center gap-2 whitespace-nowrap font-mono font-semibold text-cyan-800 md:table-cell md:px-3 md:py-2.5 dark:text-cyan-200">
                    {port.name}
                    <Badge variant="outline" className={`font-sans md:hidden ${port.direction === 'input' ? 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-200' : 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-200'}`}>
                      {text[port.direction]}
                    </Badge>
                    <span className="ml-auto rounded bg-muted px-2 py-0.5 font-mono text-xs font-normal text-muted-foreground md:hidden">{port.width} bit</span>
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <Badge variant="outline" className={port.direction === 'input' ? 'border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-200' : 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-200'}>
                      {text[port.direction]}
                    </Badge>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-muted-foreground md:table-cell">{port.width}</td>
                  <td className="mt-2 block leading-5 text-muted-foreground md:table-cell md:px-3 md:py-2.5">
                    <span className="block font-semibold text-foreground md:hidden">{text.timing}</span>
                    {localize(port.timing, locale)}
                  </td>
                  <td className="mt-2 block leading-5 text-muted-foreground md:table-cell md:px-3 md:py-2.5">
                    <span className="block font-semibold text-foreground md:hidden">{text.purpose}</span>
                    {localize(port.purpose, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
});

function ArchitectureColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-card px-3 py-3 dark:border-amber-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-foreground">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-muted/60 px-2 py-1.5">{item}</li>
        ))}
      </ul>
    </div>
  );
}
