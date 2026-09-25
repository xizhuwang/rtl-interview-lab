import type { Localized } from './challenges';

export type CpuCacheGuide = {
  idea: Localized;
  diagram: Localized;
  signals: Localized;
  example: Localized;
  rule: Localized;
  codingFlow?: Localized;
  skeleton?: Localized;
};

export const cpuCacheGuides: Record<string, CpuCacheGuide> = {
  'soc-cpu-register-file': {
    idea: {
      zh: '先把 register file 想成 CPU 的 32 格抽屜。指令同時查看 rs1、rs2 兩格，但只有在 clock 上升緣才把結果放進 rd。x0 是永遠鎖死為 0 的抽屜。',
      en: 'Think of the register file as 32 CPU drawers. An instruction can inspect rs1 and rs2 at once, but a result enters rd only on a rising clock edge. Drawer x0 is permanently locked to zero.',
    },
    diagram: {
      zh: 'raddr1 ──► [ 32 × 32 Register File ] ──► rdata1\nraddr2 ──► [ 兩個組合讀取埠      ] ──► rdata2\n              ▲\nclk + we + waddr + wdata（上升緣寫入）',
      en: 'raddr1 ──► [ 32 × 32 Register File ] ──► rdata1\nraddr2 ──► [ two combinational reads ] ──► rdata2\n              ▲\nclk + we + waddr + wdata (write on rising edge)',
    },
    signals: {
      zh: 'waddr／wdata 是「要寫哪格、寫什麼」；we 決定這拍能否寫。raddr1／2 是兩個來源編號，rdata1／2 應隨位址立即改變，不必等下一拍。',
      en: 'waddr/wdata say which drawer to write and what value to store; we authorizes that edge. raddr1/2 select the two sources, and rdata1/2 change immediately without waiting for another edge.',
    },
    example: {
      zh: '例：we=1、waddr=5、wdata=0x1234。上升緣之前 x5 不變；上升緣之後 raddr1=5 便讀到 0x1234。若 waddr=0，同一筆寫入必須被丟棄。',
      en: 'Example: we=1, waddr=5, wdata=0x1234. x5 stays unchanged before the edge; after the edge, raddr1=5 reads 0x1234. The same write must be discarded when waddr=0.',
    },
    rule: {
      zh: '先完成同步 reset／write，再用兩條組合讀取式處理 x0。不要把 read 寫進 clocked always，否則題目要求的組合讀取會平白多一拍。',
      en: 'Implement synchronous reset/write first, then use two combinational read expressions with x0 bypass. Do not put reads in the clocked block or the required asynchronous read gains an unwanted cycle.',
    },
  },
  'soc-cpu-forwarding': {
    idea: {
      zh: '先把它想成「幫 ALU 選資料來源的兩個開關」。前一條 ADD 已算出 x5，但還沒寫回 register file；下一條 SUB 現在就要用 x5。與其停下來等，直接把較新的結果接到 ALU。這題不用搬 32-bit 資料，只要輸出兩個 2-bit 選擇碼。',
      en: 'Think of two switches that choose the ALU inputs. An older ADD has produced x5 but has not written it back yet, while the following SUB needs x5 now. Instead of waiting, select the newer pipeline result. This exercise moves no 32-bit data; it only produces two 2-bit select codes.',
    },
    diagram: {
      zh: '較早：ADD x5, x1, x2   現在位於 EX/MEM，x5 新值已算好\n目前：SUB x6, x5, x3   現在位於 EX，需要 rs1=x5\n\nALU A 端可以選：\n  00 → register file 裡的舊 x5\n  10 → EX/MEM 裡最新的 ADD 結果  ← 這次要選\n  01 → MEM/WB 裡更早一條指令的結果\n\n因此這個例子的 forward_a = 10。',
      en: 'Older: ADD x5, x1, x2   now in EX/MEM; the new x5 is ready\nCurrent: SUB x6, x5, x3 now in EX and needs rs1=x5\n\nALU input A can select:\n  00 → old x5 from the register file\n  10 → newest ADD result in EX/MEM  ← choose this one\n  01 → result from an even older instruction in MEM/WB\n\nTherefore forward_a = 10 in this example.',
    },
    signals: {
      zh: '先只分成三組：① ex_rs1／ex_rs2＝目前這條指令需要哪兩格；② mem_rd＝前一條指令要寫哪格，是最新候選；③ wb_rd＝更早一條指令要寫哪格，是次新候選。mem_regwrite／wb_regwrite 為 0 代表它根本不會寫回；rd=0 代表 x0，也不能轉送。forward_a 看 rs1，forward_b 看 rs2。',
      en: 'Use three groups: (1) ex_rs1/ex_rs2 are the two registers needed now; (2) mem_rd is the previous instruction destination and the newest candidate; (3) wb_rd is an older destination and the second choice. A low RegWrite means no writeback, and rd=0 is x0, so neither may forward. forward_a checks rs1; forward_b checks rs2.',
    },
    example: {
      zh: '把數字代入：ex_rs1=5、mem_regwrite=1、mem_rd=5，所以 rs1 命中最新候選，A 選 10。若 mem_rd 不等於 5，但 wb_regwrite=1、wb_rd=5，才改選 01。rs2 必須用同一流程另外算一次，不能沿用 A 的結果。',
      en: 'Substitute values: ex_rs1=5, mem_regwrite=1, mem_rd=5, so rs1 matches the newest candidate and A selects 10. If mem_rd does not equal 5 but wb_regwrite=1 and wb_rd=5, select 01 instead. Run the same logic independently for rs2; never copy A blindly.',
    },
    rule: {
      zh: '每個輸出先設 00。依序問三件事：「那一級真的會寫嗎？」「目的地不是 x0 嗎？」「目的地等於我現在要讀的 rs 嗎？」MEM 三題都成立就選 10；只有 MEM 未命中才問 WB，成立則選 01。這就是 if／else if 的原因。',
      en: 'Default each output to 00. Ask three questions: will that stage really write, is its destination not x0, and does its destination equal the source needed now? If all three are true for MEM, select 10. Ask WB only when MEM misses; then select 01. That priority is why the code uses if/else if.',
    },
    codingFlow: {
      zh: '預設 forward_a = 00\n        │\n        ▼\nMEM 會寫 register？rd 不是 x0？mem_rd == ex_rs1？\n        ├─ YES → forward_a = 10\n        │\n        └─ NO ─► WB 會寫 register？rd 不是 x0？wb_rd == ex_rs1？\n                    ├─ YES → forward_a = 01\n                    └─ NO  → 維持 00\n\nforward_b 完全相同，只把 ex_rs1 換成 ex_rs2。',
      en: 'Default forward_a = 00\n        │\n        ▼\nDoes MEM write a nonzero rd matching ex_rs1?\n        ├─ YES → forward_a = 10\n        │\n        └─ NO ─► Does WB write a nonzero rd matching ex_rs1?\n                    ├─ YES → forward_a = 01\n                    └─ NO  → keep 00\n\nforward_b is identical; replace ex_rs1 with ex_rs2.',
    },
    skeleton: {
      zh: `always @* begin
  forward_a = 2'b00;
  forward_b = 2'b00;

  if (/* EX/MEM 是否命中 rs1 */)
    forward_a = 2'b10;
  else if (/* MEM/WB 是否命中 rs1 */)
    forward_a = 2'b01;

  if (/* EX/MEM 是否命中 rs2 */)
    forward_b = 2'b10;
  else if (/* MEM/WB 是否命中 rs2 */)
    forward_b = 2'b01;
end`,
      en: `always @* begin
  forward_a = 2'b00;
  forward_b = 2'b00;

  if (/* EX/MEM matches rs1 */)
    forward_a = 2'b10;
  else if (/* MEM/WB matches rs1 */)
    forward_a = 2'b01;

  if (/* EX/MEM matches rs2 */)
    forward_b = 2'b10;
  else if (/* MEM/WB matches rs2 */)
    forward_b = 2'b01;
end`,
    },
  },
  'soc-cpu-hazard-control': {
    idea: {
      zh: 'Forwarding 不是萬能：load 的資料要到 MEM 結束才回來，緊跟在後的指令在 EX 會早一拍需要它。此時要讓前端停一拍並往 ID/EX 塞一顆 bubble；branch taken 則要丟掉已走上錯路的指令。',
      en: 'Forwarding cannot fix everything. Load data returns only after MEM, one cycle too late for the immediately following EX stage. Freeze the front end and inject a bubble; a taken branch instead discards wrong-path instructions.',
    },
    diagram: {
      zh: 'LW x5      IF → ID → EX → MEM(data ready)\nADD …,x5      IF → ID → [必須 stall] → EX\n                     └─ PC/IF-ID 保持，ID-EX flush 成 bubble',
      en: 'LW x5      IF → ID → EX → MEM(data ready)\nADD …,x5      IF → ID → [must stall] → EX\n                     └─ hold PC/IF-ID, flush ID-EX into a bubble',
    },
    signals: {
      zh: 'ex_memread／ex_rd 描述 EX 中的 load；id_rs1／2 是 ID 指令要讀的來源。pc_write、if_id_write=0 是「保持」；id_ex_flush=1 是「插 bubble」；if_id_flush=1 是「清錯路徑」。',
      en: 'ex_memread/ex_rd describe the load in EX; id_rs1/2 are the sources in ID. pc_write and if_id_write at zero mean hold; id_ex_flush injects a bubble; if_id_flush removes a wrong-path instruction.',
    },
    example: {
      zh: '例：ex_rd=5、id_rs2=5，且 ex_memread=1：PC 與 IF/ID 都停住，ID/EX 被清空。若同拍 branch_taken=1，branch priority 較高：PC 要能跳轉，並 flush IF/ID 與 ID/EX。',
      en: 'Example: ex_rd=5, id_rs2=5, ex_memread=1. Hold PC and IF/ID, then clear ID/EX. If branch_taken is also high, branch has priority: allow the new PC and flush IF/ID plus ID/EX.',
    },
    rule: {
      zh: '先給正常執行的預設值；最優先處理 branch_taken，其次才判斷 load-use：ex_memread && ex_rd!=0 && (ex_rd==id_rs1 || ex_rd==id_rs2)。',
      en: 'Start with normal-running defaults. Handle branch_taken first, then load-use: ex_memread && ex_rd!=0 && (ex_rd==id_rs1 || ex_rd==id_rs2).',
    },
  },
  'soc-cpu-branch-predictor': {
    idea: {
      zh: 'Predictor 像有慣性的投票器：一次反常結果不應立刻翻盤。二位元 counter 的低兩個狀態猜 not taken，高兩個狀態猜 taken，必須連續趨勢才會跨過中線。',
      en: 'The predictor is a voter with inertia: one unusual outcome should not immediately reverse the guess. The lower two states predict not-taken and the upper two predict taken.',
    },
    diagram: {
      zh: '強不跳 00 ⇄ 弱不跳 01 ⇄ 弱跳 10 ⇄ 強跳 11\nactual_taken 往右；actual_not_taken 往左；兩端飽和不回捲',
      en: 'strong NT 00 ⇄ weak NT 01 ⇄ weak T 10 ⇄ strong T 11\nactual taken moves right; not-taken moves left; endpoints saturate',
    },
    signals: {
      zh: 'state[1] 就是 predict_taken；update 表示這拍有真實 branch 結果可學習；actual_taken 決定 counter 增或減。update=0 時不能偷改歷史。',
      en: 'state[1] is predict_taken. update says a resolved branch is available for training; actual_taken increments or decrements the counter. With update=0, history must not change.',
    },
    example: {
      zh: 'reset 到 01（弱不跳）。一次 taken：01→10，預測改為 taken；再一次 taken：10→11。之後一次 not taken 只退到 10，仍預測 taken，這就是 hysteresis。',
      en: 'Reset to 01 (weak not-taken). One taken result moves 01→10 and changes the prediction; another moves 10→11. A single not-taken then returns only to 10, demonstrating hysteresis.',
    },
    rule: {
      zh: '輸出直接接 state[1]；clocked block 只在 update 時更新。taken 且 state!=11 才加一，not taken 且 state!=00 才減一，避免 11→00 或 00→11。',
      en: 'Drive the prediction from state[1] and update state only when update is high. Increment only below 11 and decrement only above 00 to prevent wraparound.',
    },
  },
  'soc-cache-direct-mapped': {
    idea: {
      zh: 'Cache 像四格置物櫃。index 決定只能開哪一格，tag 是貼在格子上的姓名貼，offset 則是在同一個資料區塊裡選哪個 byte。姓名貼不同就是 miss。',
      en: 'A direct-mapped cache is a four-locker shelf. The index chooses the only possible locker, the tag is its name label, and the offset selects a byte inside the line. A different label means a miss.',
    },
    diagram: {
      zh: '32-bit address = [ tag 31:4 | index 3:2 | byte offset 1:0 ]\n                              │            └─ 選 4 格之一\nvalid[index] && stored_tag[index]==tag ──► hit',
      en: '32-bit address = [ tag 31:4 | index 3:2 | byte offset 1:0 ]\n                              │            └─ choose one of four lines\nvalid[index] && stored_tag[index]==tag ──► hit',
    },
    signals: {
      zh: 'fill_en／fill_addr／fill_data 在上升緣裝入一列；req／req_addr 做組合 lookup。valid 說這列是否曾被填入，tag 用來確認它是不是 CPU 現在要的那個 block。',
      en: 'fill_en/fill_addr/fill_data install a line on a rising edge. req/req_addr perform a combinational lookup. valid says the line contains data; the tag confirms it is the requested block.',
    },
    example: {
      zh: '0x04 與 0x14 的 index 都是 01，但 tag 不同。先填 0x04 會 hit；再把 0x14 填進同一格後，0x04 立刻 miss——這就是 conflict eviction。',
      en: '0x04 and 0x14 both use index 01 but have different tags. Fill 0x04 and it hits; fill 0x14 into the same locker and 0x04 now misses. That is conflict eviction.',
    },
    rule: {
      zh: 'fill 與 lookup 必須用完全相同的切位。先由 index 取 valid／tag／data，再比較 tag；只有 req && valid && tag_match 時 hit=1，否則 rdata=0。',
      en: 'Fill and lookup must slice addresses identically. Use the index to fetch valid/tag/data, compare the tag, and assert hit only for req && valid && tag_match; otherwise return zero.',
    },
  },
  'soc-cache-two-way': {
    idea: {
      zh: '2-way cache 把每個 set 變成兩個停車位。index 只帶你到正確的 set，兩個 way 的 tag 都要同時比較；命中哪個 way，再由 MUX 選它的 data。',
      en: 'A two-way cache gives each set two parking spaces. The index finds the set, both way tags are compared in parallel, and a mux selects the data from the matching way.',
    },
    diagram: {
      zh: 'req index ─► set ─┬─ way0: valid + tag compare ─┐\n                    └─ way1: valid + tag compare ─┴─► hit/data MUX',
      en: 'req index ─► set ─┬─ way0: valid + tag compare ─┐\n                    └─ way1: valid + tag compare ─┴─► hit/data mux',
    },
    signals: {
      zh: 'addr[2] 選 set，addr[31:3] 是 tag；fill_way 指定資料停在 way0 或 way1。hit_way 是 lookup 結果，不是 replacement 選擇。',
      en: 'addr[2] selects the set and addr[31:3] is the tag. fill_way chooses way0 or way1 for installation. hit_way reports lookup result; it is not a replacement decision.',
    },
    example: {
      zh: '位址 0x00 與 0x08 落在同一 set，但可分別放 way0、way1，因此兩者都能 hit。第三個同 set block 若覆蓋 way0，只會讓原 way0 資料 miss。',
      en: 'Addresses 0x00 and 0x08 share a set but can occupy way0 and way1, so both hit. A third block replacing way0 invalidates only the previous way0 resident.',
    },
    rule: {
      zh: '分別算 hit0、hit1，再做優先選擇與 data mux；miss 時 hit、hit_way、rdata 都回 0。不要把 tag 當 array index，否則就失去 set-associative 的意義。',
      en: 'Compute hit0 and hit1 separately, then select hit_way and data. Drive all outputs to zero on a miss. Never use the tag as an array index; that defeats set associativity.',
    },
  },
  'soc-cache-fully-associative': {
    idea: {
      zh: 'Fully associative cache 沒有固定置物櫃：request tag 可以藏在任何 entry，所以 lookup 像點名，所有 entry 同時舉牌比較。代價是每格都要一個 comparator。',
      en: 'A fully associative cache has no fixed locker. A requested tag may be in any entry, so every entry compares in parallel. The price is one comparator per entry.',
    },
    diagram: {
      zh: 'req_tag ─┬─ compare entry0 ─┐\n         ├─ compare entry1 ─┤\n         ├─ compare entry2 ─┼─► priority encode ─► hit_index/data\n         └─ compare entry3 ─┘',
      en: 'req_tag ─┬─ compare entry0 ─┐\n         ├─ compare entry1 ─┤\n         ├─ compare entry2 ─┼─► priority encode ─► hit_index/data\n         └─ compare entry3 ─┘',
    },
    signals: {
      zh: 'fill_index 只在寫入時指定要放哪格；req_tag 在讀取時必須搜尋全部 valid entries。hit_index 是搜尋結果，不能直接由 req_tag 的低位元產生。',
      en: 'fill_index selects an entry only during fill. During lookup, req_tag must search every valid entry. hit_index is a search result and cannot be derived from low tag bits.',
    },
    example: {
      zh: 'tag AA 先放 entry2，之後 lookup AA 應回 2；若 entry1 也放 AA，題目規定回最低 index，所以要回 1。這要求明確的 priority encoder。',
      en: 'Put tag AA in entry2 and lookup returns 2. If entry1 also receives AA, the exercise requires the lowest index, so return 1 using an explicit priority encoder.',
    },
    rule: {
      zh: '先把 hit/index/data 設 0，再檢查四個 valid && tag_match。若用迴圈覆寫，順序必須和「最低 index 優先」一致；功能是 CAM search，不是 RAM lookup。',
      en: 'Default hit/index/data to zero, then check all valid tag matches. If later assignments override earlier ones, order them to preserve lowest-index priority. This is CAM search, not RAM lookup.',
    },
  },
  'soc-cache-lru': {
    idea: {
      zh: 'LRU 不負責判斷 hit；它只在兩個 way 都已有人時回答「下一個該淘汰誰」。2-way 每個 set 只需一個 bit，記住較久沒被碰的那一邊。',
      en: 'LRU does not detect hits. It answers which resident to evict when both ways are occupied. A two-way set needs one history bit recording the less recently used side.',
    },
    diagram: {
      zh: 'touch way0 ─► way0 變 MRU ─► 下次 victim=way1\ntouch way1 ─► way1 變 MRU ─► 下次 victim=way0\ninvalid way 永遠比 LRU 更優先拿來填',
      en: 'touch way0 ─► way0 becomes MRU ─► next victim=way1\ntouch way1 ─► way1 becomes MRU ─► next victim=way0\nan invalid way is always preferred over an LRU victim',
    },
    signals: {
      zh: 'touch_set／touch_way 表示哪個 set 的哪個 way 剛被使用，要在 clock edge 更新歷史；query_set 與 valid bits 則組合決定目前 victim_way。',
      en: 'touch_set/touch_way identify the recently used way whose history updates on the clock edge. query_set and valid bits combinationally determine the current victim_way.',
    },
    example: {
      zh: 'set0 兩個 way 都 valid，touch way0 後 victim=1。接著只 touch set1，不應改變 set0 的 victim；這就是「每個 set 各自保存歷史」。',
      en: 'With both ways valid in set0, touching way0 makes victim=1. Touching only set1 afterward must not change set0, because every set keeps independent history.',
    },
    rule: {
      zh: '先判斷 invalid：way0 無效選 0，否則 way1 無效選 1；兩者都有效才讀 lru[query_set]。clocked block 中 touch 0 寫 victim 1，touch 1 寫 victim 0。',
      en: 'Check invalid ways first: choose way0 if invalid, else way1 if invalid; consult lru[query_set] only when both are valid. In the clocked update, touching 0 stores victim 1 and vice versa.',
    },
  },
  'soc-cache-miss-fsm': {
    idea: {
      zh: 'Blocking cache 像只有一個服務窗口：miss 尚未處理完時不能接下一位。若被換出的 line 是 dirty，必須先把舊資料寫回，才能向記憶體取新資料。',
      en: 'A blocking cache is a single service counter: it cannot accept another request while a miss is outstanding. If the victim is dirty, old data must be written back before fetching the new line.',
    },
    diagram: {
      zh: 'hit:   IDLE ───────────────► CPU ready\nclean: IDLE ─► REFILL ─► RESPOND ─► IDLE\ndirty: IDLE ─► WRITEBACK ─► REFILL ─► RESPOND ─► IDLE',
      en: 'hit:   IDLE ───────────────► CPU ready\nclean: IDLE ─► REFILL ─► RESPOND ─► IDLE\ndirty: IDLE ─► WRITEBACK ─► REFILL ─► RESPOND ─► IDLE',
    },
    signals: {
      zh: 'cache_hit／victim_dirty 決定從 IDLE 走哪條路；writeback_req／refill_req 是對下層記憶體的要求；mem_ready=0 代表對方還沒接完，request 與 state 都要保持。',
      en: 'cache_hit/victim_dirty choose the path out of IDLE. writeback_req/refill_req request lower memory service. While mem_ready=0, the request and state must remain asserted and stable.',
    },
    example: {
      zh: 'dirty miss：進 WRITEBACK 後，即使 mem_ready 連續兩拍為 0，writeback_req 仍須保持 1；握手後才進 REFILL。REFILL 再次等到 mem_ready，下一拍 RESPOND 才回 CPU。',
      en: 'Dirty miss: once in WRITEBACK, keep writeback_req high across any mem_ready=0 cycles. Only after that handshake enter REFILL; after its handshake, RESPOND returns completion to the CPU.',
    },
    rule: {
      zh: '用 IDLE／WRITEBACK／REFILL／RESPOND 四態。state register、next-state、output decode 分開；除 IDLE 外 busy=1，WRITEBACK／REFILL 都必須能承受任意長 back-pressure。',
      en: 'Use IDLE, WRITEBACK, REFILL, and RESPOND. Separate state register, next-state logic, and output decode. busy is high outside IDLE, and both memory states must tolerate arbitrary back-pressure.',
    },
  },
};
