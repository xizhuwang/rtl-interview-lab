import type { Localized } from './challenges';

export type GoldenPattern = {
  title: Localized;
  summary: Localized;
  columns: Localized[];
  rows: GoldenCell[][];
  notes?: Localized[];
};

export type GoldenCell = string | Localized;

const t = (zh: string, en: string): Localized => ({ zh, en });

const pattern = (
  title: Localized,
  summary: Localized,
  columns: Localized[],
  rows: GoldenCell[][],
  notes: Localized[] = [],
): GoldenPattern => ({ title, summary, columns, rows, notes });

export const goldenPatterns: Record<string, GoldenPattern> = {
  'soc-apb-register': pattern(
    { zh: 'Golden pattern：寫入與讀取是兩條不同路徑', en: 'Golden pattern: write and read use different paths' },
    { zh: 'control 是真正保存資料的暫存器；PRDATA 只是依 PADDR 選出目前要回給 CPU 的值。', en: 'control is stored state; PRDATA is only the value currently selected by PADDR for the CPU.' },
    [{ zh: '操作', en: 'Operation' }, { zh: 'PADDR', en: 'PADDR' }, { zh: '來源', en: 'Source' }, { zh: '目的', en: 'Destination' }, { zh: '預期結果', en: 'Expected result' }],
    [
      [t('寫入 control', 'Write control'), '0x00', 'PWDATA=0x12345678', 'control', 'control=0x12345678'],
      [t('讀回 control', 'Read control'), '0x00', 'control', 'PRDATA', 'PRDATA=0x12345678'],
      [t('讀取 status', 'Read status'), '0x04', 'status=0xCAFE1234', 'PRDATA', 'PRDATA=0xCAFE1234'],
      [t('讀取非法位址', 'Read unmapped address'), '0x08', '—', 'PRDATA', 'PRDATA=0x00000000'],
      [t('嘗試寫 status', 'Attempt to write status'), '0x04', 'PWDATA=0', t('不可改變 control/status', 'Must not change control/status'), 'control=0x12345678'],
    ],
    [{ zh: '一句話記法：PWDATA 只負責「寫進 control」；status 或 control 才會經由 PRDATA「讀回 CPU」。', en: 'Shortcut: PWDATA writes only into control; status or control is read back to the CPU through PRDATA.' }],
  ),
  'cdc-2ff-level': pattern(
    { zh: 'Golden pattern：目的端兩級取樣', en: 'Golden pattern: two destination samples' },
    { zh: '下表的 D1、D2 是 async_in 改變後的前兩個 clk_dst 上升沿；不模擬真實亞穩態，只檢查數位模型的兩級延遲。', en: 'D1 and D2 are the first two clk_dst rising edges after async_in changes. The digital model checks two stages, not analog metastability.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'async_in', en: 'async_in' }, { zh: '第一級', en: 'stage 1' }, { zh: 'sync_out', en: 'sync_out' }],
    [
      [t('Reset', 'Reset'), '0', '0', '0'],
      [t('非同步輸入改變', 'Async input changes'), '1', '0', '0'],
      ['D1 ↑', '1', '1', '0'],
      ['D2 ↑', '1', '1', '1'],
    ],
  ),
  'cdc-reset-release': pattern(
    { zh: 'Golden pattern：立即進 reset、兩拍後離開', en: 'Golden pattern: immediate assertion, two-edge release' },
    { zh: 'arst_n 拉低不需要等待時脈；拉高後則必須完整通過兩個目的端暫存器。', en: 'arst_n asserts without a clock, while release must pass through both destination registers.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'arst_n', en: 'arst_n' }, { zh: 'sync[1:0]', en: 'sync[1:0]' }, { zh: 'srst_n', en: 'srst_n' }],
    [
      [t('非同步 Assert', 'Async assert'), '0', '00', '0'],
      [t('兩拍之間 Deassert', 'Deassert between edges'), '1', '00', '0'],
      ['D1 ↑', '1', '01', '0'],
      ['D2 ↑', '1', '11', '1'],
    ],
  ),
  'cdc-toggle-pulse': pattern(
    { zh: 'Golden pattern：一個事件只產生一個目的端 pulse', en: 'Golden pattern: one destination pulse per event' },
    { zh: '目的端延遲會隨兩個 clock 的相位而變，但輸出 pulse 必須恰好維持一個 clk_dst 週期。', en: 'Latency varies with clock phase, but dst_pulse must last exactly one clk_dst cycle.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'src_pulse', en: 'src_pulse' }, { zh: 'src toggle', en: 'src toggle' }, { zh: '同步後 toggle', en: 'synced toggle' }, { zh: 'dst_pulse', en: 'dst_pulse' }],
    [
      [t('閒置', 'Idle'), '0', '0', '0', '0'],
      [t('來源端事件', 'Source event'), t('1（1 個 src 週期）', '1 (1 src cycle)'), '1', '0', '0'],
      [t('目的端同步到變化', 'Destination observes toggle'), '0', '1', '1', '1'],
      [t('下一個 D 上升沿', 'Next D edge'), '0', '1', '1', '0'],
    ],
    [{ zh: '兩個來源事件若快到讓 toggle 在目的端看到前又翻回去，事件仍可能遺失；這正是本題的輸入間隔限制。', en: 'If two source events toggle twice before the destination observes them, an event can still be lost; that is this exercise\'s spacing contract.' }],
  ),
  'cdc-handshake-bus': pattern(
    { zh: 'Golden pattern：closed-loop 多位元傳輸', en: 'Golden pattern: closed-loop multi-bit transfer' },
    { zh: '這是事件順序，不是固定 clock 數。S 表示 clk_src edge、D 表示 clk_dst edge；同步器延遲會隨兩個 clock 的相位改變。', en: 'This is event order, not a fixed cycle count. S means a clk_src edge and D a clk_dst edge; synchronizer latency depends on clock phase.' },
    [{ zh: '階段', en: 'Stage' }, { zh: 'src_send', en: 'src_send' }, { zh: 'src_data／保持值', en: 'src_data / held value' }, { zh: 'src_busy', en: 'src_busy' }, { zh: 'dst_valid', en: 'dst_valid' }, { zh: 'dst_data', en: 'dst_data' }],
    [
      [t('閒置', 'Idle'), '0', '—', '0', '0', t('前值／0', 'Previous / 0')],
      [t('S1 接受 A5', 'S1 accepts A5'), '1', t('A5 → 保持 A5', 'A5 → hold A5'), '1', '0', t('前值', 'Previous')],
      [t('D 同步 request', 'D synchronizes request'), '0', t('保持 A5', 'Hold A5'), '1', '0', t('前值', 'Previous')],
      [t('D 取樣', 'D captures'), '0', t('保持 A5', 'Hold A5'), '1', t('1（1 個 D 週期）', '1 (1 D cycle)'), 'A5'],
      [t('D 回送 acknowledge', 'D acknowledges'), '0', t('保持 A5', 'Hold A5'), '1', '0', 'A5'],
      [t('S 同步到 ack', 'S observes ack'), '0', t('此 edge 後可解除保持', 'May release after this edge'), '0', '0', 'A5'],
      [t('回到閒置', 'Return to idle'), '0', t('允許下一筆資料', 'Next value allowed'), '0', '0', 'A5'],
    ],
    [
      { zh: '只有 src_send && !src_busy 的來源端上升沿會接受新 transaction；busy=1 時的新 src_send 不可覆寫目前資料。', en: 'Only a source edge with src_send && !src_busy accepts a transaction. A send while busy must not overwrite the held data.' },
      { zh: '目的端只能在同步後的 request 到達且 bus 已穩定時取樣一次；不要把 8 個 data bits 各自當成獨立 CDC。', en: 'Capture once only after the synchronized request arrives and the bus has settled. Do not treat the eight data bits as independent CDC signals.' },
    ],
  ),
  'timing-pipeline-path': pattern(
    { zh: 'Golden pattern：資料與 valid 同步走兩級', en: 'Golden pattern: data and valid move through two stages' },
    { zh: '表格數值為每個上升沿之後觀察到的輸出；連續輸入不可產生 bubble。', en: 'Values are observed after each rising edge. Back-to-back inputs must not create a bubble.' },
    [{ zh: '上升沿', en: 'Rising edge' }, { zh: '輸入', en: 'Input' }, { zh: 'in_valid', en: 'in_valid' }, { zh: 'out_valid', en: 'out_valid' }, { zh: 'y', en: 'y' }],
    [
      ['C0', '(1+2)+(3+4)=10', '1', '0', '—'],
      ['C1', '(255+1)+(2+3)=261', '1', '1', '10'],
      ['C2', 'bubble', '0', '1', '261'],
      ['C3', 'bubble', '0', '0', t('不檢查', 'Don\'t care')],
    ],
  ),
  'timing-valid-retime': pattern(
    { zh: 'Golden pattern：bubble 也必須跟著 pipeline', en: 'Golden pattern: pipeline bubbles with valid' },
    { zh: '每筆 a*b+c 與它的 valid 必須穿過相同數量的 registers。', en: 'Each a*b+c result and its valid bit must cross the same number of registers.' },
    [{ zh: '上升沿', en: 'Rising edge' }, { zh: '輸入 transaction', en: 'Input transaction' }, { zh: 'out_valid', en: 'out_valid' }, { zh: '有效輸出', en: 'Valid output' }],
    [
      ['C0', '3*4+5 = 17', '0', '—'],
      ['C1', 'bubble', '1', '17'],
      ['C2', '9*2+1 = 19', '0', '—'],
      ['C3', 'bubble', '1', '19'],
      ['C4', 'bubble', '0', '—'],
    ],
  ),
  'soc-axi-lite-accelerator': pattern(
    { zh: 'Golden pattern：AW 與 W 分開抵達仍完成一次 write', en: 'Golden pattern: one write with independent AW and W arrival' },
    { zh: 'AXI4-Lite 五個 channel 獨立握手。此例先收到 address，隔拍才收到 data；兩者都保存後才更新 register。', en: 'AXI4-Lite channels handshake independently. Here the address arrives first and data later; the register updates only after both are captured.' },
    [{ zh: '週期', en: 'Cycle' }, { zh: 'AWVALID/AWREADY', en: 'AWVALID/AWREADY' }, { zh: 'WVALID/WREADY', en: 'WVALID/WREADY' }, { zh: '動作', en: 'Action' }, { zh: 'BVALID', en: 'BVALID' }],
    [
      ['C0', '1/1', '0/1', t('保存位址 0x00', 'Capture address 0x00'), '0'],
      ['C1', '0/0', '1/1', t('保存 data bit0=1；執行 write', 'Capture data bit0=1; commit write'), '1'],
      ['C2', '0/0', '0/0', t('accel_start 在本拍為 1', 'accel_start=1 for this cycle'), t('維持至 BREADY', 'Hold until BREADY')],
      ['C3', '0/0', '0/0', t('response 被接受', 'Response accepted'), '0'],
    ],
  ),
  'soc-axi-burst-reader': pattern(
    { zh: 'Golden pattern：四拍 AXI read burst', en: 'Golden pattern: four-beat AXI read burst' },
    { zh: '以 beats=4 為例，ARLEN 必須送 3。R channel 被 back-pressure 時，資料只能在 RVALID && RREADY 才算接受。', en: 'For beats=4, ARLEN must be 3. An R beat is accepted only on RVALID && RREADY.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'ARVALID', en: 'ARVALID' }, { zh: 'ARLEN', en: 'ARLEN' }, { zh: 'RVALID/RREADY', en: 'RVALID/RREADY' }, { zh: '接受 beat', en: 'Accepted beat' }, { zh: 'done', en: 'done' }],
    [
      [t('開始', 'Start'), t('1，直到 ready', '1 until ready'), '3', '0/1', '—', '0'],
      ['R0', '0', '3', '1/1', '0', '0'],
      [t('R1 被 back-pressure', 'R1 stalled'), '0', '3', '1/0', t('—（保持）', '— (hold)'), '0'],
      [t('R1 被接受', 'R1 accepted'), '0', '3', '1/1', '1', '0'],
      ['R2', '0', '3', '1/1', '2', '0'],
      ['R3 + RLAST', '0', '3', '1/1', '3', t('Pulse 一拍', '1-cycle pulse')],
    ],
  ),
  'cdc-async-fifo': pattern(
    { zh: 'Golden pattern：寫入與讀出順序', en: 'Golden pattern: write/read ordering' },
    { zh: 'W 與 R 是彼此非同步的上升沿。旗標可能因 pointer 同步器延遲而晚幾拍更新，但資料順序永遠不能改變。', en: 'W and R are asynchronous rising edges. Flags may update a few cycles later because of pointer synchronization, but data ordering must never change.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'w_en/wdata', en: 'w_en/wdata' }, { zh: 'r_en', en: 'r_en' }, { zh: 'full', en: 'full' }, { zh: 'empty', en: 'empty' }, { zh: '有效 rdata', en: 'Valid rdata' }],
    [
      [t('Reset', 'Reset'), '0/—', '0', '0', '1', '—'],
      [t('W0 接受 A1', 'W0 accepts A1'), '1/A1', '0', '0', t('1 → 稍後為 0', '1 → later 0'), '—'],
      [t('W1 接受 B2', 'W1 accepts B2'), '1/B2', '0', '0', '0', '—'],
      [t('R0 讀出', 'R0 pops'), '0/—', '1', '0', '0', 'A1'],
      [t('R1 讀出', 'R1 pops'), '0/—', '1', '0', '0 → 1', 'B2'],
      [t('Empty 時嘗試讀取', 'Read attempted while empty'), '0/—', '1', '0', '1', t('不執行 pop', 'No pop')],
    ],
    [{ zh: 'full 時的 write 與 empty 時的 read 都不得移動 pointer。full 在 write domain 產生，empty 在 read domain 產生。', en: 'A write while full and a read while empty must not advance pointers. Generate full in the write domain and empty in the read domain.' }],
  ),
  'soc-sram-ip-wrapper': pattern(
    { zh: 'Golden pattern：同步 SRAM read latency', en: 'Golden pattern: synchronous SRAM read latency' },
    { zh: '控制器在上升沿送出 request；教學 macro 的 Q 在同一個 edge 後 0.35 ns 更新。rvalid 必須與這個有效資料時間對齊。', en: 'The controller presents a request at a rising edge. The educational macro updates Q 0.35 ns after that edge, and rvalid must align with the valid data.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'req/write', en: 'req/write' }, { zh: 'CEN_n/WEN_n', en: 'CEN_n/WEN_n' }, { zh: '動作', en: 'Action' }, { zh: 'rvalid/rdata', en: 'rvalid/rdata' }],
    [
      ['C0 ↑', '1/1', '0/0', t('寫入 0x11223344', 'Write 0x11223344'), '0/—'],
      ['C1 ↑', '1/0', '0/1', t('取樣 read address', 'Sample read address'), t('0 → edge 後為 1', '0 → 1 after edge')],
      ['C1 + 0.35 ns', '—', '—', t('Macro Q 更新', 'Macro Q updates'), '1/0x11223344'],
      ['C2 ↑', '0/0', '1/1', t('無 request', 'No request'), t('0／前值', '0 / previous')],
    ],
  ),
  'soc-stream-register-slice': pattern(
    { zh: 'Golden pattern：back-pressure 下保持輸出', en: 'Golden pattern: hold output under back-pressure' },
    { zh: '只要 m_valid=1 且 m_ready=0，輸出 transaction 必須完全不動；下游接受舊資料的同一拍可以補入新資料。', en: 'While m_valid=1 and m_ready=0, the output transaction must remain unchanged. A new item may refill the slot in the same cycle the old item is consumed.' },
    [{ zh: '週期', en: 'Cycle' }, { zh: 's_valid/s_ready', en: 's_valid/s_ready' }, { zh: 's_data', en: 's_data' }, { zh: 'm_valid/m_ready', en: 'm_valid/m_ready' }, { zh: 'm_data', en: 'm_data' }],
    [
      [t('C0：buffer 為空', 'C0: buffer empty'), '1/1', 'A', '0/0', '—'],
      [t('C1：被 back-pressure', 'C1: stalled'), '1/0', 'B', '1/0', t('保持 A', 'Hold A')],
      [t('C2：被 back-pressure', 'C2: stalled'), '1/0', 'C', '1/0', t('保持 A', 'Hold A')],
      [t('C3：consume + refill', 'C3: consume + refill'), '1/1', 'D', '1/1', t('A 被接受；載入 D', 'A accepted; load D')],
      ['C4', '0/1', '—', '1/1', t('D 被接受', 'D accepted')],
    ],
  ),
  'soc-dma-address-generator': pattern(
    { zh: 'Golden pattern：只有 handshake 才前進位址', en: 'Golden pattern: advance address only on handshake' },
    { zh: 'base=0x1000、count=3、stride=0x10。addr_ready=0 時 addr、valid、last 必須保持。', en: 'Example: base=0x1000, count=3, stride=0x10. Hold addr, valid, and last while addr_ready=0.' },
    [{ zh: '週期', en: 'Cycle' }, { zh: 'addr_valid/ready', en: 'addr_valid/ready' }, { zh: 'addr', en: 'addr' }, { zh: 'last', en: 'last' }, { zh: 'done', en: 'done' }],
    [
      [t('C0：開始', 'C0: start'), '1/0', '0x1000', '0', '0'],
      [t('C1：停住', 'C1: stalled'), '1/0', t('0x1000（保持）', '0x1000 (hold)'), '0', '0'],
      [t('C2：接受', 'C2: accept'), '1/1', '0x1000', '0', '0'],
      [t('C3：接受', 'C3: accept'), '1/1', '0x1010', '0', '0'],
      [t('C4：接受最後一筆', 'C4: accept last'), '1/1', '0x1020', '1', t('Pulse 一拍', '1-cycle pulse')],
    ],
  ),
  'soc-command-fifo': pattern(
    { zh: 'Golden pattern：同拍 push/pop', en: 'Golden pattern: simultaneous push and pop' },
    { zh: 'FIFO 內原本有 A、B；同拍輸出 A 並輸入 C 時，level 不變，下一筆輸出仍是 B。', en: 'The FIFO initially holds A and B. If A is popped while C is pushed in the same cycle, level is unchanged and B remains next.' },
    [{ zh: '事件', en: 'Event' }, { zh: 'enq_valid/ready', en: 'enq_valid/ready' }, { zh: 'deq_valid/ready', en: 'deq_valid/ready' }, { zh: 'deq_data', en: 'deq_data' }, { zh: 'level 後', en: 'level after' }],
    [
      [t('初始：[A, B]', 'Initial: [A, B]'), '0/1', '1/0', 'A', '2'],
      [t('Push C + pop A', 'Push C + pop A'), '1/1', '1/1', t('A 被接受', 'A accepted'), '2'],
      [t('下一拍', 'Next'), '0/1', '1/0', 'B', '2'],
      [t('Pop B', 'Pop B'), '0/1', '1/1', t('B 被接受', 'B accepted'), '1'],
      [t('下一拍', 'Next'), '0/1', '1/0', 'C', '1'],
    ],
  ),
  'soc-cache-miss-fsm': pattern(
    { zh: 'Golden pattern：blocking cache miss 流程', en: 'Golden pattern: blocking cache miss flow' },
    { zh: 'clean miss 直接 refill；dirty victim 必須先 write-back。等待 memory 時 request 保持，不能接受第二筆 CPU request。', en: 'A clean miss refills directly; a dirty victim writes back first. Hold the memory request while waiting and reject a second CPU request.' },
    [{ zh: '狀態／事件', en: 'State / event' }, { zh: 'busy', en: 'busy' }, { zh: 'writeback_req', en: 'writeback_req' }, { zh: 'refill_req', en: 'refill_req' }, { zh: 'cpu_ready', en: 'cpu_ready' }],
    [
      [t('IDLE + dirty miss', 'IDLE + dirty miss'), '0 → 1', '0', '0', '0'],
      [t('WRITEBACK 等待', 'WRITEBACK wait'), '1', '1', '0', '0'],
      [t('WRITEBACK 被接受', 'WRITEBACK accepted'), '1', '1', '0', '0'],
      [t('REFILL 等待', 'REFILL wait'), '1', '0', '1', '0'],
      [t('REFILL 被接受', 'REFILL accepted'), '1', '0', '1', '0'],
      ['RESPOND', '1', '0', '0', t('1（1 拍）', '1 (1 cycle)')],
      ['IDLE', '0', '0', '0', '0'],
    ],
  ),
  'soc-streaming-llm-tile': pattern(
    { zh: 'Golden pattern：tile 的 transaction 邊界', en: 'Golden pattern: tile transaction boundaries' },
    { zh: 'start 只在 idle 接受；輸入 stream 依 ready/valid 消耗，最後一筆計算後才送出結果。輸出被擋住時結果必須保持。', en: 'Accept start only while idle, consume input beats through ready/valid, and produce a result only after the final computation. Hold the result while stalled.' },
    [{ zh: '階段', en: 'Stage' }, { zh: 'in_valid/ready', en: 'in_valid/ready' }, { zh: 'busy', en: 'busy' }, { zh: 'out_valid/ready', en: 'out_valid/ready' }, { zh: '要求', en: 'Requirement' }],
    [
      [t('閒置 + start', 'Idle + start'), '0/0', '0 → 1', '0/0', t('保存設定', 'Capture configuration')],
      [t('接受 beat 0', 'Consume beat 0'), '1/1', '1', '0/0', t('累加一次', 'Accumulate once')],
      [t('輸入 bubble', 'Input bubble'), '0/1', '1', '0/0', t('狀態不變', 'State unchanged')],
      [t('接受最後一拍', 'Consume last beat'), '1/1', '1', '0/0', t('完成累加', 'Finish accumulation')],
      [t('輸出被 back-pressure', 'Output stalled'), '0/0', '1', '1/0', t('保持結果', 'Hold result')],
      [t('輸出被接受', 'Output accepted'), '0/0', '1 → 0', '1/1', t('done pulse 一拍', 'One-cycle done pulse')],
    ],
  ),
};
