import type { Localized } from './challenges';

export type SocPortDirection = 'input' | 'output';

export type SocPortGuide = {
  name: string;
  direction: SocPortDirection;
  width: string;
  timing: Localized;
  purpose: Localized;
};

export type SocLearningAid = {
  context: Localized;
  architecture: {
    sources: Localized[];
    focus: Localized;
    sinks: Localized[];
    flow: Localized;
  };
  dataPaths?: {
    operation: Localized;
    source: string;
    destination: string;
    rule: Localized;
  }[];
  ports: SocPortGuide[];
};

const t = (zh: string, en: string): Localized => ({ zh, en });
const p = (
  name: string,
  direction: SocPortDirection,
  width: string,
  timingZh: string,
  timingEn: string,
  purposeZh: string,
  purposeEn: string,
): SocPortGuide => ({
  name,
  direction,
  width,
  timing: t(timingZh, timingEn),
  purpose: t(purposeZh, purposeEn),
});

export const socLearningAids: Record<string, SocLearningAid> = {
  'soc-apb-register': {
    context: t(
      '這個模組位在 CPU 的 APB interconnect 與加速器控制邏輯之間。CPU 透過位址 0x00 寫入或讀回 control，並從 0x04 讀取硬體提供的 status。',
      'This block sits between the CPU APB interconnect and accelerator control logic. Software reads or writes control at 0x00 and reads hardware status at 0x04.',
    ),
    architecture: {
      sources: [t('CPU／APB master', 'CPU / APB master'), t('加速器 status', 'Accelerator status')],
      focus: t('APB 暫存器模組（本題）', 'APB register block (this task)'),
      sinks: [t('control 暫存器', 'Control register'), t('CPU read data', 'CPU read data')],
      flow: t('CPU 在 setup phase 給位址，access phase 令 PSEL=PENABLE=1；本題不插入 wait state。', 'The CPU presents an address in setup, then asserts PSEL and PENABLE in access. This task inserts no wait state.'),
    },
    dataPaths: [
      {
        operation: t('寫入 0x00', 'Write 0x00'),
        source: 'PWDATA',
        destination: 'control',
        rule: t('只在合法 write transfer 的 PCLK 上升沿更新並保存。', 'Update and store only on the PCLK edge of a legal write transfer.'),
      },
      {
        operation: t('讀取 0x00', 'Read 0x00'),
        source: 'control',
        destination: 'PRDATA',
        rule: t('組合式讀回先前保存的 control；PRDATA 本身不是儲存暫存器。', 'Combinationally return the stored control value; PRDATA is not storage.'),
      },
      {
        operation: t('讀取 0x04', 'Read 0x04'),
        source: 'status',
        destination: 'PRDATA',
        rule: t('直接讀回加速器提供的唯讀狀態；PWDATA 不會流向 status。', 'Return the read-only accelerator status; PWDATA never flows into status.'),
      },
    ],
    ports: [
      p('PCLK', 'input', '1', '所有暫存器在上升沿更新', 'Registers update on the rising edge', 'APB clock', 'APB clock'),
      p('PRESETn', 'input', '1', '低有效；在 PCLK 上升沿取樣', 'Active-low; sampled on PCLK rising edges', '清除 control 暫存器', 'Clears the control register'),
      p('PSEL', 'input', '1', 'setup 與 access phase 皆為 1', 'High in both setup and access phases', '選到這個 APB slave', 'Selects this APB slave'),
      p('PENABLE', 'input', '1', '只在 access phase 為 1', 'High only in the access phase', '與 PSEL 一起表示 transfer 正在完成', 'With PSEL, marks the transfer access phase'),
      p('PWRITE', 'input', '1', 'transfer 期間保持；1=write、0=read', 'Held through the transfer; 1=write, 0=read', '選擇讀或寫', 'Selects read versus write'),
      p('PADDR', 'input', '8', 'transfer 期間保持穩定', 'Stable throughout the transfer', '選擇 0x00 control、0x04 status 或未對應位址', 'Selects 0x00 control, 0x04 status, or an unmapped address'),
      p('PWDATA', 'input', '32', 'write transfer 期間有效', 'Valid during a write transfer', 'CPU 要寫入 control 的資料', 'Data written by the CPU into control'),
      p('status', 'input', '32', '由加速器提供；read mux 組合讀取', 'Provided by the accelerator; read combinationally', '唯讀硬體狀態，不可被 APB write 改變', 'Read-only hardware state; APB writes must not change it'),
      p('PRDATA', 'output', '32', 'read address decode 的組合輸出', 'Combinational output of read address decode', '回傳 control、status，非法位址回 0', 'Returns control or status; zero for unmapped addresses'),
      p('PREADY', 'output', '1', '本題固定為 1', 'Always 1 in this task', '表示 slave 不插入 wait state', 'Indicates the slave inserts no wait states'),
      p('control', 'output', '32', '合法 0x00 write 的 PCLK 上升沿更新', 'Updates on a legal 0x00 write edge', '送往加速器的軟體控制設定', 'Software control state sent to the accelerator'),
    ],
  },
  'soc-round-robin': {
    context: t('兩個 master 共用一個硬體資源時，arbiter 決定本拍誰能前進，並用歷史狀態避免其中一路長期飢餓。', 'When two masters share one resource, the arbiter selects who may advance and uses history to prevent starvation.'),
    architecture: {
      sources: [t('Master 0 request', 'Master 0 request'), t('Master 1 request', 'Master 1 request')],
      focus: t('Round-robin arbiter（本題）', 'Round-robin arbiter (this task)'),
      sinks: [t('共享 SRAM／BUS／加速器', 'Shared SRAM / bus / accelerator')],
      flow: t('req 表示需求，grant 是 one-hot 許可；只有實際發出 grant 才改變下一次 tie 的優先權。', 'req expresses demand and grant is a one-hot permission. Change tie priority only after an actual grant.'),
    },
    ports: [
      p('clk', 'input', '1', '狀態在上升沿更新', 'State updates on the rising edge', 'Arbiter clock', 'Arbiter clock'),
      p('rst_n', 'input', '1', '低有效；在 clk 上升沿取樣', 'Active-low; sampled on clk rising edges', '初始化 grant 與公平性歷史', 'Initializes grant and fairness history'),
      p('req[0]', 'input', '1', '在每個週期表示 master 0 需要資源', 'Requests the resource for master 0 each cycle', 'Master 0 的需求', 'Demand from master 0'),
      p('req[1]', 'input', '1', '在每個週期表示 master 1 需要資源', 'Requests the resource for master 1 each cycle', 'Master 1 的需求', 'Demand from master 1'),
      p('grant[0]', 'output', '1', '與 grant[1] 不可同時為 1', 'Must not be high with grant[1]', '允許 master 0 使用共享資源', 'Allows master 0 to use the shared resource'),
      p('grant[1]', 'output', '1', '與 grant[0] 不可同時為 1', 'Must not be high with grant[0]', '允許 master 1 使用共享資源', 'Allows master 1 to use the shared resource'),
    ],
  },
  'soc-axi-lite-accelerator': {
    context: t('這是 ARM CPU 看得到的 memory-mapped 控制面，不搬運大量 tensor。CPU 寫入工作參數、發出 start，再讀取 status；真正資料流由 DMA／AXI master 處理。', 'This is the ARM-visible memory-mapped control plane, not the tensor data path. Software writes job parameters, starts the engine, and reads status; DMA/AXI masters move bulk data.'),
    architecture: {
      sources: [t('ARM CPU', 'ARM CPU'), t('AXI4-Lite interconnect', 'AXI4-Lite interconnect'), t('加速器 done', 'Accelerator done')],
      focus: t('AXI4-Lite CSR block（本題）', 'AXI4-Lite CSR block (this task)'),
      sinks: [t('src/dst/length 設定', 'src/dst/length configuration'), t('accel_start', 'accel_start'), t('CPU response', 'CPU response')],
      flow: t('AW、W、B、AR、R 是五條獨立 channel；位址與寫入資料可以不同拍抵達，response 也必須等對方 ready 才能撤掉。', 'AW, W, B, AR, and R are independent channels. Address and write data may arrive in different cycles, and responses remain asserted until accepted.'),
    },
    ports: [
      p('ACLK', 'input', '1', '所有 AXI 狀態在上升沿更新', 'All AXI state updates on rising edges', 'AXI4-Lite clock', 'AXI4-Lite clock'),
      p('ARESETn', 'input', '1', '低有效；在 ACLK 上升沿取樣', 'Active-low; sampled on ACLK rising edges', '清除 channel pending flags、responses 與 CSR', 'Clears pending flags, responses, and CSRs'),
      p('AWVALID', 'input', '1', '與 AWREADY 同為 1 才接受', 'Accepted only with AWREADY high', 'CPU 宣告 write address 有效', 'CPU marks the write address valid'),
      p('AWADDR', 'input', '6', 'AWVALID=1 時有效，handshake 時鎖住', 'Valid with AWVALID; capture on handshake', '要寫入的 CSR byte address', 'Byte address of the target CSR'),
      p('AWREADY', 'output', '1', '能接受一筆新 write address 時為 1', 'High when a new write address can be accepted', '對 AW channel 的 back-pressure', 'Back-pressure for the AW channel'),
      p('WVALID', 'input', '1', '與 WREADY 同為 1 才接受', 'Accepted only with WREADY high', 'CPU 宣告 write data 有效', 'CPU marks write data valid'),
      p('WDATA', 'input', '32', 'WVALID=1 時有效，handshake 時鎖住', 'Valid with WVALID; capture on handshake', '寫入 CSR 的資料', 'Data written into the CSR'),
      p('WREADY', 'output', '1', '能接受一筆新 write data 時為 1', 'High when new write data can be accepted', '對 W channel 的 back-pressure', 'Back-pressure for the W channel'),
      p('BVALID', 'output', '1', 'address 與 data 都收到並完成 write 後拉高，直到 BREADY', 'Assert after address and data are committed; hold until BREADY', '宣告 write response 有效', 'Marks the write response valid'),
      p('BREADY', 'input', '1', '與 BVALID handshake 後結束 response', 'Completes the response with BVALID', 'CPU 接受 write response', 'CPU accepts the write response'),
      p('ARVALID', 'input', '1', '與 ARREADY 同為 1 才接受', 'Accepted only with ARREADY high', 'CPU 宣告 read address 有效', 'CPU marks the read address valid'),
      p('ARADDR', 'input', '6', 'AR handshake 時鎖住', 'Captured on the AR handshake', '要讀取的 CSR byte address', 'Byte address of the CSR to read'),
      p('ARREADY', 'output', '1', '能接受新 read address 時為 1', 'High when a new read address can be accepted', '對 AR channel的 back-pressure', 'Back-pressure for the AR channel'),
      p('RVALID', 'output', '1', 'RDATA 準備好後拉高，直到 RREADY', 'Assert when RDATA is ready; hold until RREADY', '宣告 read response 有效', 'Marks read response data valid'),
      p('RDATA', 'output', '32', 'RVALID=1 且未 handshake 時保持不變', 'Stable while RVALID is high and not accepted', '依 ARADDR 回傳 CSR 值', 'Returns the CSR value selected by ARADDR'),
      p('RREADY', 'input', '1', '與 RVALID handshake 後結束 response', 'Completes the response with RVALID', 'CPU 接受 read data', 'CPU accepts read data'),
      p('accel_done', 'input', '1', '由加速器送入；讀 STATUS 時觀察', 'Provided by the accelerator; observed through STATUS', '工作完成狀態', 'Accelerator completion state'),
      p('accel_start', 'output', '1', '寫 CTRL[0]=1 後只 pulse 一個 ACLK', 'One-ACLK pulse after writing CTRL[0]=1', '啟動一筆加速器工作', 'Starts one accelerator job'),
      p('src_addr', 'output', '32', '寫 0x08 後保持', 'Held after a write to 0x08', '來源 buffer 位址設定', 'Source buffer address configuration'),
      p('dst_addr', 'output', '32', '寫 0x0C 後保持', 'Held after a write to 0x0C', '目的 buffer 位址設定', 'Destination buffer address configuration'),
      p('length', 'output', '32', '寫 0x10 後保持', 'Held after a write to 0x10', '工作長度設定', 'Job length configuration'),
    ],
  },
  'soc-axi-burst-reader': {
    context: t('這是加速器的資料面 AXI read master：先向 DDR/HBM 提交一筆 burst 位址要求，再把回傳的 RDATA 轉成內部 ready/valid stream。', 'This is the accelerator data-plane AXI read master: issue one burst request to DDR/HBM, then convert returned RDATA beats into an internal ready/valid stream.'),
    architecture: {
      sources: [t('控制器 start/base/beats', 'Controller start/base/beats'), t('DDR/HBM AXI R channel', 'DDR/HBM AXI R channel')],
      focus: t('AXI burst reader（本題）', 'AXI burst reader (this task)'),
      sinks: [t('AXI AR channel', 'AXI AR channel'), t('加速器 input stream', 'Accelerator input stream')],
      flow: t('先完成 ARVALID/ARREADY，之後每個 RVALID/RREADY 才算收到一拍；最後一拍還必須同時看到 RLAST。', 'Complete ARVALID/ARREADY first. Each R beat transfers only on RVALID/RREADY, and completion additionally requires RLAST on the final beat.'),
    },
    ports: [
      p('ACLK', 'input', '1', '上升沿更新 FSM', 'FSM updates on rising edges', 'AXI clock', 'AXI clock'),
      p('ARESETn', 'input', '1', '低有效', 'Active-low', '回到 idle 並清除 valid/busy/done', 'Returns to idle and clears valid/busy/done'),
      p('start', 'input', '1', '只在 idle 接受', 'Accepted only while idle', '要求開始一筆 read burst', 'Requests one read burst'),
      p('base_addr', 'input', '32', '接受 start 時鎖住', 'Captured with an accepted start', 'burst 起始 byte address', 'Starting byte address of the burst'),
      p('beats', 'input', '8', '接受 start 時鎖住；ARLEN=beats-1', 'Captured with start; ARLEN=beats-1', '要求的資料拍數', 'Requested number of data beats'),
      p('ARVALID', 'output', '1', '送出後保持到 ARREADY', 'Held until ARREADY after assertion', 'AXI read address request 有效', 'Marks the AXI read address request valid'),
      p('ARREADY', 'input', '1', '與 ARVALID 同拍為 1 才接受 request', 'Accepts the request with ARVALID', '記憶體端接受 AR request', 'Memory accepts the AR request'),
      p('ARADDR', 'output', '32', 'ARVALID 等待期間保持', 'Stable while ARVALID waits', '送往記憶體的起始位址', 'Starting address sent to memory'),
      p('ARLEN', 'output', '8', 'ARVALID 等待期間保持', 'Stable while ARVALID waits', 'AXI 編碼的 burst 長度：beats-1', 'AXI burst-length encoding: beats-1'),
      p('RVALID', 'input', '1', '與 RREADY 同為 1 才接收', 'A beat transfers only with RREADY', '記憶體宣告 RDATA/RLAST 有效', 'Memory marks RDATA/RLAST valid'),
      p('RREADY', 'output', '1', 'receive state 且 stream_ready 時為 1', 'High in receive state when stream_ready is high', '把內部 back-pressure 傳回記憶體', 'Propagates internal back-pressure to memory'),
      p('RDATA', 'input', '32', 'RVALID=1 時有效；handshake 時交給 stream', 'Valid with RVALID; forwarded on handshake', '記憶體回傳的一拍資料', 'One returned memory data beat'),
      p('RLAST', 'input', '1', '與最後一拍 RDATA 同時有效', 'Valid with the final RDATA beat', '標示 burst 最後一拍', 'Marks the final burst beat'),
      p('stream_valid', 'output', '1', '通常由 receive state && RVALID 產生', 'Usually receive-state && RVALID', '宣告 stream_data 可被運算單元接收', 'Marks stream_data valid for the compute unit'),
      p('stream_ready', 'input', '1', '由下游運算單元提供', 'Provided by downstream compute', '下游能否接收本拍資料', 'Whether downstream can accept this beat'),
      p('stream_data', 'output', '32', 'stream_valid=1 時有效，stall 時保持來源 RDATA', 'Valid with stream_valid; held upstream during stalls', '內部資料流 payload', 'Internal stream payload'),
      p('busy', 'output', '1', 'start 接受後到 RLAST handshake 期間為 1', 'High from accepted start through RLAST handshake', '控制器目前有未完成工作', 'Indicates an in-flight transfer'),
      p('done', 'output', '1', 'RLAST handshake 後 pulse 一拍', 'One-cycle pulse after RLAST handshake', '通知控制邏輯工作完成', 'Notifies control logic of completion'),
    ],
  },
  'soc-sram-ip-wrapper': {
    context: t('Wrapper 把上層好用的 req/write/byte_en 介面翻譯成 SRAM compiler 常見的低有效控制腳，並對齊同步讀取的 clock-to-Q。', 'The wrapper translates a friendly req/write/byte_en interface into common active-low SRAM macro pins and aligns the synchronous read clock-to-Q behavior.'),
    architecture: {
      sources: [t('DMA／cache／accelerator', 'DMA / cache / accelerator')],
      focus: t('SRAM port adapter（本題）', 'SRAM port adapter (this task)'),
      sinks: [t('edu_sram_1rw_256x32', 'edu_sram_1rw_256x32'), t('rdata/rvalid', 'rdata/rvalid')],
      flow: t('上層 request 先轉成 CEN_n/WEN_n/BWEN_n/A/D；macro 在 clock edge 取樣，讀資料於 edge 後 0.35 ns 出現在 Q。', 'Translate the request into CEN_n/WEN_n/BWEN_n/A/D. The macro samples on the edge and produces read Q 0.35 ns later.'),
    },
    ports: [
      p('clk', 'input', '1', 'macro 與 wrapper 共用上升沿', 'Shared rising edge for macro and wrapper', 'SRAM port clock', 'SRAM port clock'),
      p('rst_n', 'input', '1', '低有效；reset 時不可啟動 macro', 'Active-low; macro must be disabled during reset', '清除 rvalid 並阻擋 request', 'Clears rvalid and blocks requests'),
      p('req', 'input', '1', '上升沿接受一次 memory operation', 'One memory operation is accepted on a rising edge', '上層提出讀或寫要求', 'Upstream read/write request'),
      p('write', 'input', '1', 'req=1 時有效；1=write、0=read', 'Valid with req; 1=write, 0=read', '選擇 memory operation 類型', 'Selects the memory operation type'),
      p('byte_en', 'input', '4', 'write request 時每 bit 控制一個 byte lane', 'Each bit controls one byte lane on writes', '1 表示該 byte 要更新；wrapper 需反相成 BWEN_n', '1 updates that byte; invert for BWEN_n'),
      p('addr', 'input', '8', 'req 上升沿由 macro 取樣', 'Sampled by the macro on the request edge', '256 words 中的 word address', 'Word address among 256 entries'),
      p('wdata', 'input', '32', 'write request 上升沿取樣', 'Sampled on a write-request edge', '要寫入 SRAM 的資料', 'Data written into SRAM'),
      p('rdata', 'output', '32', 'read edge 後 0.35 ns 更新', 'Updates 0.35 ns after the read edge', '直接連接 macro Q', 'Connects directly to macro Q'),
      p('rvalid', 'output', '1', '接受 read request 的同一上升沿註冊', 'Registered on the same edge that accepts a read', '表示 edge 後的 rdata 是本次 read response', 'Marks rdata as the response to that read'),
    ],
  },
  'soc-stream-register-slice': {
    context: t('Register slice 放在兩個 ready/valid 模組之間，用一格暫存器切斷長 data path，同時保持完整的 back-pressure 語意。', 'A register slice sits between ready/valid blocks, using one registered slot to break a long data path while preserving back-pressure semantics.'),
    architecture: {
      sources: [t('DMA／前級運算', 'DMA / upstream compute')],
      focus: t('一格 elastic register slice（本題）', 'One-entry elastic register slice (this task)'),
      sinks: [t('後級運算／AXI stream sink', 'Downstream compute / AXI stream sink')],
      flow: t('上游以 s_valid/s_ready 交付，buffer 保存一筆，再以 m_valid/m_ready 交付；consume 與 refill 可以同拍發生。', 'Upstream transfers on s_valid/s_ready, the slot stores one item, and downstream consumes on m_valid/m_ready. Consume and refill may occur together.'),
    },
    ports: [
      p('clk', 'input', '1', '上升沿更新 buffer', 'Buffer updates on rising edges', '資料流 clock', 'Stream clock'),
      p('rst_n', 'input', '1', '低有效', 'Active-low', '清除 m_valid，表示 buffer 為空', 'Clears m_valid so the buffer is empty'),
      p('s_valid', 'input', '1', '與 s_ready 同為 1 才接受 s_data', 's_data transfers only with s_ready', '上游宣告輸入資料有效', 'Upstream marks input data valid'),
      p('s_ready', 'output', '1', '空槽或本拍將 consume 時為 1', 'High when empty or consuming this cycle', '告訴上游是否能送入一筆', 'Tells upstream whether one item can be accepted'),
      p('s_data', 'input', '32', 's_valid=1 時有效，handshake 時取樣', 'Valid with s_valid; sampled on handshake', '上游 payload', 'Upstream payload'),
      p('m_valid', 'output', '1', 'buffer 有資料時為 1；stall 時保持', 'High when occupied; held during a stall', '宣告 m_data 有效', 'Marks m_data valid'),
      p('m_ready', 'input', '1', '與 m_valid 同為 1 才 consume', 'Consumes only with m_valid', '下游 back-pressure', 'Downstream back-pressure'),
      p('m_data', 'output', '32', 'm_valid=1 且 m_ready=0 時不可改變', 'Must remain stable while valid and stalled', '已暫存的下游 payload', 'Registered downstream payload'),
    ],
  },
  'soc-w1c-interrupt-status': {
    context: t('硬體事件可能只有一拍，但軟體讀取很慢；sticky W1C register 把事件保存到軟體看見，並讓軟體逐 bit 清除。', 'Hardware events may last one cycle while software polls slowly. A sticky W1C register retains events until software clears selected bits.'),
    architecture: {
      sources: [t('加速器 done/error pulse', 'Accelerator done/error pulses'), t('CPU W1C write', 'CPU W1C write')],
      focus: t('Sticky status + W1C（本題）', 'Sticky status + W1C (this task)'),
      sinks: [t('CPU status read', 'CPU status read'), t('Interrupt controller', 'Interrupt controller')],
      flow: t('先套用軟體 clear mask，再 OR 回同拍硬體事件，才能確保新事件不被清除動作吃掉。', 'Apply the software clear mask first, then OR in same-cycle hardware events so a new event cannot be erased.'),
    },
    ports: [
      p('clk', 'input', '1', '上升沿更新 status', 'status updates on rising edges', 'Status clock', 'Status clock'),
      p('rst_n', 'input', '1', '低有效', 'Active-low', '清除所有 sticky bits', 'Clears all sticky bits'),
      p('hw_done', 'input', '1', '即使只 pulse 一拍也必須被保存', 'Must be retained even if pulsed for one cycle', '設定 status[0]', 'Sets status[0]'),
      p('hw_error', 'input', '1', '即使只 pulse 一拍也必須被保存', 'Must be retained even if pulsed for one cycle', '設定 status[1]', 'Sets status[1]'),
      p('sw_write', 'input', '1', '上升沿搭配 sw_wdata 執行 clear', 'Clears selected bits with sw_wdata on an edge', 'CPU 正在寫 W1C register', 'CPU writes the W1C register'),
      p('sw_wdata[0]', 'input', '1', 'sw_write=1 時，寫 1 清除', 'Writing 1 clears when sw_write=1', '清除 done sticky bit', 'Clears the done sticky bit'),
      p('sw_wdata[1]', 'input', '1', 'sw_write=1 時，寫 1 清除', 'Writing 1 clears when sw_write=1', '清除 error sticky bit', 'Clears the error sticky bit'),
      p('status', 'output', '2', '事件後保持，直到對應 W1C', 'Held after an event until matching W1C', 'CPU 可讀的 done/error 狀態', 'CPU-readable done/error state'),
      p('irq', 'output', '1', '組合等於 |status', 'Combinationally equals |status', '任一 pending event 便通知 interrupt controller', 'Notifies the interrupt controller of any pending event'),
    ],
  },
  'soc-dma-address-generator': {
    context: t('這個模組只產生要存取的位址序列，不直接搬資料。下游 AXI requester 每接受一個位址，generator 才前進到下一筆。', 'This block generates an address sequence but does not move data. It advances only when the downstream AXI requester accepts an address.'),
    architecture: {
      sources: [t('Descriptor：base/count/stride', 'Descriptor: base/count/stride')],
      focus: t('DMA address generator（本題）', 'DMA address generator (this task)'),
      sinks: [t('AXI read/write requester', 'AXI read/write requester'), t('完成控制邏輯', 'Completion control')],
      flow: t('start 鎖住 descriptor；addr_valid/addr_ready 每 handshake 一次便 addr+=stride，最後一筆同時標 last。', 'start captures the descriptor. Each addr_valid/addr_ready handshake advances addr by stride, and the final item is marked last.'),
    },
    ports: [
      p('clk', 'input', '1', '上升沿更新狀態與位址', 'State and address update on rising edges', 'Generator clock', 'Generator clock'),
      p('rst_n', 'input', '1', '低有效', 'Active-low', '清除 busy/done/remaining', 'Clears busy/done/remaining'),
      p('start', 'input', '1', '只在 busy=0 時接受', 'Accepted only when busy=0', '載入一筆新 descriptor', 'Loads a new descriptor'),
      p('base_addr', 'input', '32', '接受 start 時鎖住到 addr', 'Captured into addr with start', '第一筆輸出位址', 'First output address'),
      p('count', 'input', '8', '接受 start 時鎖住', 'Captured with start', '總共要成功 handshake 的位址數', 'Number of addresses that must handshake'),
      p('stride', 'input', '16', '接受 start 時鎖住或在工作期間保持', 'Capture with start or require stable during the job', '相鄰兩筆位址的 byte 間距', 'Byte distance between adjacent addresses'),
      p('addr_valid', 'output', '1', 'busy 期間為 1', 'High while busy', '宣告 addr/last 有效', 'Marks addr/last valid'),
      p('addr_ready', 'input', '1', '與 addr_valid 同拍為 1 才消耗', 'Consumes an address with addr_valid', '下游是否接受目前位址', 'Whether downstream accepts the current address'),
      p('addr', 'output', '32', 'stall 時保持；handshake 後加 stride', 'Held on stalls; adds stride after handshake', '目前待送出的 byte address', 'Current byte address to issue'),
      p('last', 'output', '1', 'remaining=1 且 busy 時為 1', 'High when busy and remaining=1', '標示目前位址為最後一筆', 'Marks the current address as final'),
      p('busy', 'output', '1', '非零 count 的 start 後到最後 handshake', 'High after nonzero start through final handshake', '目前 descriptor 尚未完成', 'Descriptor is still active'),
      p('done', 'output', '1', '最後 handshake 後或 count=0 時 pulse 一拍', 'One-cycle pulse after final handshake or count=0', '工作完成事件', 'Completion event'),
    ],
  },
  'soc-command-fifo': {
    context: t('Command FIFO 位於軟體 doorbell/CSR 與硬體 scheduler 之間，讓 CPU 可以先排入數筆 descriptor，而不必等每筆加速器工作完成。', 'The command FIFO sits between software doorbells/CSRs and the hardware scheduler, allowing multiple descriptors to queue ahead of execution.'),
    architecture: {
      sources: [t('CPU／runtime command producer', 'CPU / runtime command producer')],
      focus: t('4-entry command FIFO（本題）', 'Four-entry command FIFO (this task)'),
      sinks: [t('Hardware scheduler', 'Hardware scheduler'), t('Accelerator dispatcher', 'Accelerator dispatcher')],
      flow: t('enqueue 與 dequeue 各自用 ready/valid；兩邊可以同拍成功，因此 pointer 都移動但 level 不變。', 'Enqueue and dequeue use independent ready/valid handshakes. Both may succeed in one cycle, moving both pointers while level stays unchanged.'),
    },
    ports: [
      p('clk', 'input', '1', '上升沿 push/pop', 'Push/pop on rising edges', 'Queue clock', 'Queue clock'),
      p('rst_n', 'input', '1', '低有效', 'Active-low', '清除 pointers 與 count', 'Clears pointers and count'),
      p('enq_valid', 'input', '1', '與 enq_ready 同為 1 才 push', 'Pushes only with enq_ready', 'producer 宣告 enq_data 有效', 'Producer marks enq_data valid'),
      p('enq_ready', 'output', '1', 'level<4 時為 1', 'High while level<4', 'queue 未滿，可接受 command', 'Queue is not full and can accept a command'),
      p('enq_data', 'input', '64', 'push handshake 時寫入 mem[wptr]', 'Written to mem[wptr] on push', '要排入的 command/descriptor', 'Command/descriptor being enqueued'),
      p('deq_valid', 'output', '1', 'level!=0 時為 1', 'High while level!=0', 'queue 非空，head 有效', 'Queue is not empty and head is valid'),
      p('deq_ready', 'input', '1', '與 deq_valid 同為 1 才 pop', 'Pops only with deq_valid', 'scheduler 準備接受 command', 'Scheduler is ready to accept a command'),
      p('deq_data', 'output', '64', '指向 mem[rptr]；stall 時 head 不變', 'Points to mem[rptr]; head remains on a stall', '目前最舊的 command', 'Oldest queued command'),
      p('level', 'output', '3', '每次 push/pop 組合後更新', 'Updates from the push/pop combination', '目前 queue 內 0～4 筆資料', 'Current occupancy from 0 to 4'),
    ],
  },
  'soc-mixed-precision-dot': {
    context: t('這是運算 datapath，不含 bus 或控制 FSM。兩個 16-bit packed operands 依模式拆成 2 個 INT8 lane 或 4 個 INT4 lane，再做 signed 乘加。', 'This is a compute datapath without a bus or control FSM. Two packed 16-bit operands become either two INT8 lanes or four INT4 lanes for signed multiply-accumulate.'),
    architecture: {
      sources: [t('Activation/weight packer', 'Activation/weight packer'), t('Precision mode CSR', 'Precision mode CSR')],
      focus: t('Mixed-precision dot product（本題）', 'Mixed-precision dot product (this task)'),
      sinks: [t('Accumulator／output quantizer', 'Accumulator / output quantizer')],
      flow: t('mode 選擇 lane 切法；每個 lane 先 signed sign-extension，再相乘並以足夠位寬相加。', 'mode selects lane packing. Sign-extend each lane before multiplication, then sum products with sufficient width.'),
    },
    ports: [
      p('mode_int4', 'input', '1', '組合選擇；0=2×INT8、1=4×INT4', 'Combinational select; 0=2×INT8, 1=4×INT4', '決定 packed lane 解讀方式', 'Selects packed-lane interpretation'),
      p('a', 'input', '16', '組合輸入', 'Combinational input', '兩或四個 signed activation lanes', 'Two or four packed signed activation lanes'),
      p('b', 'input', '16', '組合輸入', 'Combinational input', '兩或四個 signed weight lanes', 'Two or four packed signed weight lanes'),
      p('y', 'output', '20 signed', '輸入改變後組合更新', 'Updates combinationally with inputs', '所有 lane 乘積的 signed 總和', 'Signed sum of all lane products'),
    ],
  },
  'soc-streaming-llm-tile': {
    context: t('Capstone 把控制面與資料面接在一起：start 定義 job，input stream 提供多拍 packed operands，tile 累加後用 output ready/valid 交付結果。', 'The capstone joins control and data planes: start defines a job, the input stream supplies packed operands, and the tile returns an accumulated result through output ready/valid.'),
    architecture: {
      sources: [t('CSR／command scheduler', 'CSR / command scheduler'), t('DMA input stream', 'DMA input stream')],
      focus: t('Streaming mixed-precision tile（本題）', 'Streaming mixed-precision tile (this task)'),
      sinks: [t('Result FIFO／DMA writer', 'Result FIFO / DMA writer'), t('Status/interrupt logic', 'Status / interrupt logic')],
      flow: t('idle 接受 start → handshake beats 筆輸入 → 最後一拍完成 accumulator → m_valid 等待下游接受 → 回到 idle。', 'Accept start while idle, handshake the requested beats, finish accumulation on the last beat, hold m_valid until consumed, then return idle.'),
    },
    ports: [
      p('clk', 'input', '1', '上升沿更新 job 與 accumulator', 'Job state and accumulator update on rising edges', 'Tile clock', 'Tile clock'),
      p('rst_n', 'input', '1', '低有效', 'Active-low', '清除 busy、m_valid、remaining 與 accumulator', 'Clears busy, m_valid, remaining, and accumulator'),
      p('start', 'input', '1', '只在 idle 接受一拍', 'Accepted for one cycle only while idle', '開始一個新 job', 'Starts a new job'),
      p('mode_int4', 'input', '1', '接受 start 時鎖住整個 job', 'Captured with start for the whole job', '0=INT8 lanes、1=INT4 lanes', '0=INT8 lanes, 1=INT4 lanes'),
      p('beats', 'input', '8', '接受 start 時鎖住', 'Captured with start', '這個 job 要累加的 input transaction 數', 'Number of input transactions in this job'),
      p('s_valid', 'input', '1', '與 s_ready 同為 1 才累加', 'Accumulates only with s_ready', 'DMA 宣告 a/b 有效', 'DMA marks a/b valid'),
      p('s_ready', 'output', '1', 'busy=1 且沒有 pending output 時為 1', 'High while busy with no pending output', 'tile 是否能接受一組 operands', 'Whether the tile can accept one operand pair'),
      p('a', 'input', '16', 's_valid=1 時有效；handshake 時計算', 'Valid with s_valid; consumed on handshake', 'packed activation lanes', 'Packed activation lanes'),
      p('b', 'input', '16', 's_valid=1 時有效；handshake 時計算', 'Valid with s_valid; consumed on handshake', 'packed weight lanes', 'Packed weight lanes'),
      p('m_valid', 'output', '1', '最後一拍後為 1，直到 m_ready', 'High after the last beat until m_ready', '宣告 result 有效', 'Marks result valid'),
      p('m_ready', 'input', '1', '與 m_valid 同為 1 才取走結果', 'Consumes result with m_valid', '下游對結果的 back-pressure', 'Downstream back-pressure for the result'),
      p('result', 'output', '32 signed', 'm_valid 等待期間保持不變', 'Stable while m_valid waits', '整個 job 的 signed dot-product 累加值', 'Signed accumulated dot-product result for the job'),
      p('busy', 'output', '1', '接受非零 beats 的 start 後到 output handshake', 'High from a nonzero start through output handshake', '拒絕重疊 job 並表示 tile 使用中', 'Rejects overlapping jobs and marks the tile occupied'),
    ],
  },
};
