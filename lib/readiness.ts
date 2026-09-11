import type { Localized, TrackId } from './challenges';

export type BoardImplementationCompetency = {
  id: string;
  title: Localized;
  outcome: Localized;
  challengeIds: string[];
};

// Internal curriculum guardrail. It is intentionally not rendered in the public UI.
export const boardImplementationCompetencies: BoardImplementationCompetency[] = [
  {
    id: 'control',
    title: { zh: '1 · 軟體控制面', en: '1 · Software control plane' },
    outcome: { zh: '能解釋 CPU 如何用 register map、start/status、W1C 與 interrupt 控制加速器。', en: 'Explain how a CPU controls an accelerator through a register map, start/status, W1C, and interrupts.' },
    challengeIds: ['soc-apb-register', 'soc-axi-lite-accelerator', 'soc-w1c-interrupt-status'],
  },
  {
    id: 'data',
    title: { zh: '2 · 資料搬移與記憶體', en: '2 · Data movement and memory' },
    outcome: { zh: '能處理 ready/valid、back-pressure、AXI burst、DMA 位址、CDC 與 SRAM latency。', en: 'Handle ready/valid flow, back-pressure, AXI bursts, DMA addressing, CDC, and SRAM latency.' },
    challengeIds: ['soc-stream-register-slice', 'soc-axi-burst-reader', 'soc-dma-address-generator', 'cdc-async-fifo', 'soc-sram-ip-wrapper'],
  },
  {
    id: 'compute',
    title: { zh: '3 · 混合精度運算核心', en: '3 · Mixed-precision compute' },
    outcome: { zh: '能說清楚 INT8／INT4 packing、signed arithmetic、累加位寬、吞吐量與 back-pressure。', en: 'Explain INT8/INT4 packing, signed arithmetic, accumulator width, throughput, and back-pressure.' },
    challengeIds: ['soc-mixed-precision-dot', 'soc-streaming-llm-tile'],
  },
  {
    id: 'system',
    title: { zh: '4 · 系統排程與驗證證據', en: '4 · Scheduling and verification evidence' },
    outcome: { zh: '能排隊與仲裁多筆工作，並用 bit-true、波形與相對面積資料說明正確性與代價。', en: 'Queue and arbitrate work, then support claims with bit-true checks, waveforms, and relative area evidence.' },
    challengeIds: ['soc-round-robin', 'soc-command-fifo', 'verification-bit-true-requant', 'ppa-width-discipline'],
  },
];

export const speakingChecklist: Record<TrackId, Localized[]> = {
  rtl: [
    { zh: '用一句話說出這個 module 的 cycle-level contract。', en: 'State the module cycle-level contract in one sentence.' },
    { zh: '指出一個最容易漏掉的 boundary case，以及測資如何抓到它。', en: 'Name one easily missed boundary case and how the test catches it.' },
    { zh: '說明 reset、組合邏輯與時序邏輯為何這樣分工。', en: 'Explain the split between reset, combinational, and sequential logic.' },
  ],
  cdc: [
    { zh: '先分類它是 level、pulse、多位元資料還是 pointer crossing。', en: 'Classify the crossing as a level, pulse, multi-bit payload, or pointer.' },
    { zh: '說明亞穩態可能出現在哪一級，以及模擬為何不能證明 CDC 安全。', en: 'Explain where metastability can occur and why simulation cannot prove CDC safety.' },
    { zh: '說出 reset、資料保持與事件速率的使用限制。', en: 'State reset, data-stability, and event-rate assumptions.' },
  ],
  timing: [
    { zh: '從 launch、data path、capture 三部分解釋 violation。', en: 'Explain the violation through launch, data path, and capture.' },
    { zh: '說出修改會如何影響 latency、setup 與 hold。', en: 'Explain how the change affects latency, setup, and hold.' },
    { zh: '指出要用哪些 report／模擬證據確認修正沒有副作用。', en: 'Name the reports or simulation evidence needed to check side effects.' },
  ],
  'cpu-cache': [
    { zh: '先畫出 datapath／state，再說明每拍資料與控制如何移動。', en: 'Sketch the datapath/state and describe cycle-by-cycle movement.' },
    { zh: '說出 correctness corner case，以及它對 IPC／miss rate 的影響。', en: 'Give a correctness corner case and its IPC or miss-rate impact.' },
    { zh: '比較速度、面積、功耗或容量的 trade-off。', en: 'Compare speed, area, power, or capacity trade-offs.' },
  ],
  soc: [
    { zh: '先定義 producer／consumer、valid／ready 與資料何時真正被接受。', en: 'Define producer/consumer roles and the exact valid/ready acceptance event.' },
    { zh: '說明 back-pressure、outstanding transaction、reset 與錯誤處理邊界。', en: 'Explain back-pressure, outstanding transactions, reset, and error boundaries.' },
    { zh: '用波形、bit-true 結果與 throughput／cell count 支持你的設計選擇。', en: 'Support the design with waveforms, bit-true results, and throughput/cell-count evidence.' },
  ],
  verification: [
    { zh: '說明 stimulus、reference model、checker 與 coverage 各自負責什麼。', en: 'Explain the roles of stimulus, reference model, checker, and coverage.' },
    { zh: '區分測試通過、coverage closure 與 formal proof。', en: 'Distinguish test passing, coverage closure, and formal proof.' },
    { zh: '舉一個會造成 false pass／vacuous pass 的情況。', en: 'Give one scenario that causes a false or vacuous pass.' },
  ],
  ppa: [
    { zh: '先說工作負載與 throughput constraint，再談面積。', en: 'State workload and throughput constraints before discussing area.' },
    { zh: '解釋 generic cell count 和真實製程 PPA 的差異。', en: 'Explain generic cell count versus process-specific PPA.' },
    { zh: '說出修改後必須重跑哪些功能與 timing 檢查。', en: 'Name the functional and timing checks to rerun after a change.' },
  ],
  dft: [
    { zh: '說明 fault model、可控制性、可觀察性與 coverage 邊界。', en: 'Explain the fault model, controllability, observability, and coverage boundary.' },
    { zh: '區分 scan、ATPG、MBIST 與 BISR。', en: 'Distinguish scan, ATPG, MBIST, and BISR.' },
    { zh: '指出 functional mode 與 test mode 的 mux／clock／reset 風險。', en: 'Identify mux, clock, and reset risks between functional and test modes.' },
  ],
  'low-power': [
    { zh: '說明動態功耗或漏電功耗由哪個機制下降。', en: 'Explain which mechanism reduces dynamic or leakage power.' },
    { zh: '指出 isolation、retention、clock gating 的正確順序或限制。', en: 'State the ordering or constraints for isolation, retention, and clock gating.' },
    { zh: '說明 RTL 模擬、UPF 驗證與 physical signoff 的差異。', en: 'Distinguish RTL simulation, UPF verification, and physical signoff.' },
  ],
};
