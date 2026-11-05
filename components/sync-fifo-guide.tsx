import type { Locale } from '@/lib/challenges';

// Requests and acceptance are sampled at the edge. State is shown after it.
const trace = [
  ['E0', '—', '0', '0 / 0', '0', '0 / 0', '0 / 1', '0', '00'],
  ['E1', 'A1', '0', '1 / 0', '1', '1 / 0', '0 / 0', '0', '00'],
  ['E2', 'B2', '0', '1 / 0', '2', '2 / 0', '0 / 0', '0', '00'],
  ['E3', 'C3', '0', '1 / 0', '3', '3 / 0', '0 / 0', '0', '00'],
  ['E4', 'D4', '0', '1 / 0', '4', '0 / 0', '1 / 0', '0', '00'],
  ['E5', 'E5', '1', '0 / 1', '3', '0 / 1', '0 / 0', '1', 'A1'],
  ['E6', 'E5', '1', '1 / 1', '3', '1 / 2', '0 / 0', '1', 'B2'],
  ['E7', '—', '1', '0 / 1', '2', '1 / 3', '0 / 0', '1', 'C3'],
  ['E8', '—', '1', '0 / 1', '1', '1 / 0', '0 / 0', '1', 'D4'],
  ['E9', '—', '1', '0 / 1', '0', '1 / 1', '0 / 1', '1', 'E5'],
  ['E10', 'F6', '1', '1 / 0', '1', '2 / 1', '0 / 0', '0', 'E5'],
  ['E11', '—', '1', '0 / 1', '0', '2 / 2', '0 / 1', '1', 'F6'],
];

export function SyncFifoGuide({ locale, reference }: { locale: Locale; reference: string }) {
  const zh = locale === 'zh';
  const columns = [zh ? '上升沿' : 'Edge', zh ? '寫入請求（hex）' : 'Write request (hex)',
    'rd_en', 'push / pop', 'count', 'wptr / rptr', 'full / empty', 'rd_valid', 'rd_data (hex)'];
  return (
    <section className="mt-4 min-w-0 space-y-2 border-t border-border pt-4"
      aria-label={zh ? '單時脈 FIFO 白板練習' : 'Synchronous FIFO whiteboard practice'}>
      <h3 className="text-sm font-semibold">{zh ? '白板練習' : 'Whiteboard practice'}</h3>
      <p className="text-sm text-muted-foreground">
        {zh
          ? '先寫 wptr、rptr、count、push、pop。兩個指標相等時，比較 count 是 0 還是 4。再自己推一次有 3 筆資料、同拍讀寫的情況。'
          : 'Start with wptr, rptr, count, push, and pop. When the pointers match, distinguish count 0 from count 4. Then trace a simultaneous read and write with three entries queued.'}
      </p>
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {zh ? '逐拍時序圖（E0–E11）' : 'Cycle trace (E0–E11)'}
        </summary>
        <p className="my-2 text-xs text-muted-foreground">
          {zh
            ? 'E0 為同步 reset。寫入請求欄的「—」代表 wr_en = 0。請求與 push / pop 在上升沿取樣，count 到 rd_data 都是拍後值。'
            : 'E0 applies synchronous reset. A dash means wr_en = 0. Requests and acceptance are sampled at the edge. All values from count through rd_data are post-edge.'}
        </p>
        <div className="overflow-x-auto" tabIndex={0} role="region"
          aria-label={zh ? '可水平捲動的 FIFO 時序表' : 'Scrollable FIFO timing table'}>
          <table className="w-full whitespace-nowrap text-center font-mono text-xs">
            <thead className="bg-muted">
              <tr>{columns.map((column) => <th key={column} scope="col" className="px-2 py-2 font-medium">{column}</th>)}</tr>
            </thead>
            <tbody>
              {trace.map(([edge, ...values]) => (
                <tr key={edge} className="border-b border-border">
                  <th scope="row" className="px-2 py-1.5 font-medium">{edge}</th>
                  {values.map((value, i) => <td key={i} className="px-2 py-1.5">{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>{zh ? 'E4 寫滿，wptr 回到 0。E5 拍前已滿，因此只讀出 A1。' : 'E4 fills the FIFO and wraps wptr to 0. E5 starts full and reads A1 only.'}</li>
          <li>{zh ? 'E6 重送 E5，同拍讀出 B2。兩個指標都前進，count 仍是 3。' : 'E6 retries the byte E5 and reads B2. Both pointers advance while count stays at 3.'}</li>
          <li>{zh ? 'E9 讀出最後一筆後，empty 和 rd_valid 都是 1。E10 拍前空，只寫入 F6。' : 'After E9, empty and rd_valid are both high because the last entry was read. E10 starts empty and only writes F6.'}</li>
        </ul>
      </details>
      <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {zh ? '完整參考 RTL 與解法' : 'Complete RTL and explanation'}
        </summary>
        <p className="my-2 text-xs text-muted-foreground">
          {zh
            ? '讀寫各用一個 if，讓同拍操作能各自更新。用 case 更新 count，10 加一、01 減一。兩位元指標加一自然從 3 回到 0。'
            : 'Use independent if blocks for read and write. Update count with a case: increment on 10 and decrement on 01. Two-bit pointer addition wraps from 3 to 0.'}
        </p>
        <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs leading-relaxed"><code>{reference}</code></pre>
      </details>
    </section>
  );
}
