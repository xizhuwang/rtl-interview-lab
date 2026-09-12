'use client';

import { useState } from 'react';

type Locale = 'zh' | 'en';

const cycles = [
  {
    phase: { zh: '閒置', en: 'Idle' },
    edge: 'C0',
    values: ['0', '0', '–', '–', '–', '0x00000000', '–'],
    note: {
      zh: '沒有傳輸。control 保持 reset 後的 0。',
      en: 'No transfer. control remains zero after reset.',
    },
  },
  {
    phase: { zh: '寫入 Setup', en: 'Write setup' },
    edge: 'C1',
    values: ['1', '0', '1', '0x00', '0x12345678', '0x00000000', '–'],
    note: {
      zh: 'Master 先放好位址、方向與 PWDATA；PENABLE 尚未拉高，不能寫入。',
      en: 'The master presents address, direction, and PWDATA. PENABLE is still low, so no write occurs.',
    },
  },
  {
    phase: { zh: '寫入 Access', en: 'Write access' },
    edge: 'C2',
    values: ['1', '1', '1', '0x00', '0x12345678', '0x12345678', '–'],
    note: {
      zh: 'PSEL、PENABLE、PWRITE、PREADY 同時為 1；C2 上升緣完成 transfer，PWDATA 才寫進 control。',
      en: 'PSEL, PENABLE, PWRITE, and PREADY are all high. The C2 rising edge completes the transfer and captures PWDATA into control.',
    },
  },
  {
    phase: { zh: '讀取 Setup', en: 'Read setup' },
    edge: 'C3',
    values: ['1', '0', '0', '0x00', '–', '0x12345678', '0x12345678'],
    note: {
      zh: '切換成 read。組合式 read mux 已經把 control 放到 PRDATA，不必等待下一個 clock 才更新。',
      en: 'The bus switches to a read. The combinational read mux already places control on PRDATA without waiting for another clock.',
    },
  },
  {
    phase: { zh: '讀取 Access', en: 'Read access' },
    edge: 'C4',
    values: ['1', '1', '0', '0x00', '–', '0x12345678', '0x12345678'],
    note: {
      zh: 'PREADY=1，所以 master 在 C4 上升緣完成讀取；PRDATA 必須在這個 edge 之前就穩定。',
      en: 'Because PREADY is high, the master completes the read at C4. PRDATA must already be stable before this edge.',
    },
  },
];

const signals = ['PSEL', 'PENABLE', 'PWRITE', 'PADDR', 'PWDATA', 'control', 'PRDATA'];

export function ApbTimingGuide({ locale }: { locale: Locale }) {
  const [selected, setSelected] = useState(2);
  const current = cycles[selected];

  return (
    <section className="apb-timing mt-4 rounded-xl border border-violet-200 bg-violet-50/45 p-3 dark:border-violet-900 dark:bg-violet-950/15">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {locale === 'zh' ? 'APB 逐拍時序：點選一拍查看事件' : 'APB cycle timing: select a cycle'}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {locale === 'zh'
              ? '每欄顯示在該上升緣取樣的值；輸入是 edge 前的值，control 則顯示 edge 後的更新結果。'
              : 'Each column shows values sampled at that rising edge. Inputs are pre-edge values; control shows the post-edge update.'}
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-1 font-mono text-[11px] font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">
          PREADY = 1
        </span>
      </div>

      <div className="apb-timing-scroll mt-3 overflow-x-auto rounded-lg border border-violet-200 bg-card dark:border-violet-900">
        <table className="w-full min-w-[680px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-24 border-b border-r border-border bg-card px-2 py-2 text-left">Signal</th>
              {cycles.map((cycle, index) => (
                <th key={cycle.edge} className={`border-b border-border p-1.5 ${selected === index ? 'bg-violet-100 dark:bg-violet-900/55' : 'bg-muted/40'}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    aria-label={`${cycle.edge}: ${cycle.phase[locale]}`}
                    className="w-full rounded px-2 py-1 text-left hover:bg-violet-100 dark:hover:bg-violet-900"
                  >
                    <span className="block font-mono font-bold">{cycle.edge}</span>
                    <span className="mt-0.5 block font-sans font-medium">{cycle.phase[locale]}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((signal, signalIndex) => (
              <tr key={signal}>
                <th className="sticky left-0 z-10 border-r border-t border-border bg-card px-2 py-2 text-left font-mono font-semibold text-cyan-700 dark:text-cyan-200">{signal}</th>
                {cycles.map((cycle, cycleIndex) => (
                  <td key={cycle.edge} className={`border-t border-border px-2 py-2 text-center font-mono ${selected === cycleIndex ? 'bg-violet-100/70 font-semibold text-foreground dark:bg-violet-900/35' : 'text-muted-foreground'}`}>
                    {cycle.values[signalIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-violet-200 bg-card p-3 dark:border-violet-900">
        <p className="font-mono text-xs font-bold text-violet-700 dark:text-violet-200">
          {current.edge} · {current.phase[locale]}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{current.note[locale]}</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {locale === 'zh'
          ? '關鍵感覺：write 在 Access 結束的 edge 改變 control；read 則要在 Access 結束前把 PRDATA 準備好。'
          : 'Key intuition: a write changes control at the end-of-access edge, while a read must prepare PRDATA before that edge.'}
      </p>
    </section>
  );
}
