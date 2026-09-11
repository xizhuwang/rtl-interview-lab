import type { Challenge } from './challenges';

const pass = `
task check;
  input condition;
  begin
    if (condition !== 1'b1) begin
      $display("@@FAIL@@ check failed at time %0t (including X/Z)", $time);
      $finish;
    end
  end
endtask
`;

export const cpuCacheChallenges: Challenge[] = [
  {
    id: 'soc-cpu-register-file', order: 34, track: 'cpu-cache', difficulty: 'beginner', minutes: 25, points: 150,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'CPU 兩讀一寫 Register File', en: 'CPU two-read, one-write register file' },
    description: { zh: '實作 32×32-bit register file：兩個組合讀取埠、一個同步寫入埠，並讓 x0 永遠讀回 0。', en: 'Build a 32×32-bit register file with two asynchronous read ports, one synchronous write port, and a hard-wired x0.' },
    specs: [
      { zh: '寫入只在 posedge 且 we=1 時發生；waddr=0 的寫入必須忽略。', en: 'Write only on a rising edge when we=1; ignore writes to address zero.' },
      { zh: 'raddr1、raddr2 為組合讀取；任一讀取位址為 0 時立即輸出 0。', en: 'Both reads are combinational; address zero must immediately return zero.' },
      { zh: '同步低有效 reset 將所有可寫 registers 清為 0。本題是教學模型；大型實體 register file 未必逐字 reset。', en: 'Synchronous active-low reset clears writable registers. This is an educational model; a physical register file may not reset every bit.' },
    ],
    testGroups: [{ zh: 'x0 固定為 0', en: 'Hard-wired x0' }, { zh: '同步寫入與雙埠讀取', en: 'Synchronous write and dual reads' }, { zh: 'write enable 與 reset', en: 'Write enable and reset' }],
    hints: [
      { zh: '使用 reg [31:0] regs [0:31] 保存資料。', en: 'Use reg [31:0] regs [0:31] for storage.' },
      { zh: '讀取可以用 assign；位址為 0 時不要讀陣列。', en: 'Use continuous assignments for reads and bypass the array for address zero.' },
      { zh: '時序寫入條件是 we && (waddr != 0)；reset 可用 for loop 清除。', en: 'Write when we && (waddr != 0); a for loop can clear the array on reset.' },
    ],
    starter: `module cpu_regfile(input wire clk,rst_n,we,input wire [4:0] waddr,input wire [31:0] wdata,input wire [4:0] raddr1,raddr2,output wire [31:0] rdata1,rdata2);
  // TODO: 32 registers, two asynchronous reads and one synchronous write
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,we=0;reg[4:0]wa=0,ra1=0,ra2=0;reg[31:0]wd=0;wire[31:0]rd1,rd2;cpu_regfile dut(clk,rst_n,we,wa,wd,ra1,ra2,rd1,rd2);always #5 clk=~clk;${pass}
task write_reg;input[4:0]a;input[31:0]d;begin @(negedge clk);we=1;wa=a;wd=d;@(posedge clk);#1;we=0;end endtask
initial begin repeat(2)@(posedge clk);#1;check(rd1===0&&rd2===0);rst_n=1;write_reg(5,32'h12345678);write_reg(9,32'hcafebabe);ra1=5;ra2=9;#1;check(rd1===32'h12345678&&rd2===32'hcafebabe);write_reg(0,32'hffffffff);ra1=0;#1;check(rd1===0);@(negedge clk);we=0;wa=5;wd=0;@(posedge clk);ra1=5;#1;check(rd1===32'h12345678);rst_n=0;@(posedge clk);#1;ra1=5;ra2=9;check(rd1===0&&rd2===0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cpu-forwarding', order: 35, track: 'cpu-cache', difficulty: 'intermediate', minutes: 25, points: 170,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '五級 Pipeline Forwarding Unit', en: 'Five-stage pipeline forwarding unit' },
    description: { zh: '為 EX stage 的兩個 source operand 選擇 register file、EX/MEM 或 MEM/WB 的結果，消除可轉送的 RAW data hazard。', en: 'Select register-file, EX/MEM, or MEM/WB data for both EX-stage operands to resolve forwardable RAW hazards.' },
    specs: [
      { zh: 'forward=00 選 register file、10 選 EX/MEM、01 選 MEM/WB。', en: 'forward=00 selects the register file, 10 EX/MEM, and 01 MEM/WB.' },
      { zh: '只有 RegWrite=1、rd!=0 且 rd 等於對應 rs 時才可 forwarding。', en: 'Forward only when RegWrite=1, rd is nonzero, and rd matches the source register.' },
      { zh: '兩個 stage 都命中同一 operand 時，較新的 EX/MEM 結果優先。rs1、rs2 必須獨立判斷。', en: 'When both stages match, prefer the newer EX/MEM result. Evaluate rs1 and rs2 independently.' },
    ],
    testGroups: [{ zh: 'EX/MEM 與 MEM/WB forwarding', en: 'EX/MEM and MEM/WB forwarding' }, { zh: '最新資料優先', en: 'Newest producer wins' }, { zh: '忽略 x0 與無效寫回', en: 'Ignore x0 and disabled writes' }],
    hints: [
      { zh: 'always @* 一開始先將兩個 output 設為 00。', en: 'Default both outputs to 00 at the start of always @*.' },
      { zh: '先判斷 EX/MEM，只有未命中時才判斷 MEM/WB。', en: 'Check EX/MEM first and MEM/WB only when the newer stage does not match.' },
      { zh: '對每個 operand 使用 if ... else if，可自然表達優先序。', en: 'Use an if ... else if chain per operand to encode priority.' },
    ],
    starter: `module cpu_forwarding(input wire [4:0] ex_rs1,ex_rs2,input wire mem_regwrite,input wire [4:0] mem_rd,input wire wb_regwrite,input wire [4:0] wb_rd,output reg [1:0] forward_a,forward_b);
  // TODO: 00=register file, 10=EX/MEM, 01=MEM/WB
endmodule`,
    testbench: `module tb;reg[4:0]rs1=0,rs2=0,mrd=0,wrd=0;reg mw=0,ww=0;wire[1:0]fa,fb;cpu_forwarding dut(rs1,rs2,mw,mrd,ww,wrd,fa,fb);${pass}
task expect;input[1:0]a,b;begin #1;check(fa===a&&fb===b);end endtask
initial begin expect(0,0);rs1=5;mw=1;mrd=5;expect(2,0);rs2=7;mw=0;ww=1;wrd=7;expect(0,1);mw=1;mrd=5;ww=1;wrd=5;rs1=5;rs2=5;expect(2,2);mrd=0;wrd=0;rs1=0;rs2=0;expect(0,0);rs1=3;rs2=4;mrd=4;wrd=3;expect(1,2);mw=0;ww=0;expect(0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cpu-hazard-control', order: 36, track: 'cpu-cache', difficulty: 'intermediate', minutes: 30, points: 190,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Load-use Stall 與 Branch Flush', en: 'Load-use stall and branch flush control' },
    description: { zh: '修正 pipeline control：load 的資料到 MEM 後才可 forwarding，因此下一條相依指令要 stall；taken branch 則要清掉錯路徑指令。', en: 'Repair pipeline control: a load result is not available soon enough for the following dependent instruction, while a taken branch must flush wrong-path work.' },
    specs: [
      { zh: '一般情況 pc_write=1、if_id_write=1，所有 flush=0。假設 id_rs1、id_rs2 都是有效 source。', en: 'Normally enable PC and IF/ID writes with both flushes low. Assume both ID source fields are valid.' },
      { zh: 'load-use hazard：ex_memread && ex_rd!=0 && (ex_rd==id_rs1 || ex_rd==id_rs2)。此時凍結 PC、IF/ID，並 flush ID/EX 插入 bubble。', en: 'On a load-use hazard, freeze PC and IF/ID and flush ID/EX to insert a bubble.' },
      { zh: 'branch_taken 優先於 load-use：允許 PC 更新並同時 flush IF/ID 與 ID/EX。', en: 'branch_taken has priority over load-use: allow the PC update and flush both IF/ID and ID/EX.' },
    ],
    testGroups: [{ zh: '一般執行', en: 'Normal execution' }, { zh: 'Load-use 相依', en: 'Load-use dependency' }, { zh: 'Branch 與 hazard 同時發生', en: 'Branch and hazard overlap' }],
    hints: [
      { zh: '先為所有 output 指定正常預設值，避免 latch。', en: 'Assign normal defaults to every output to avoid latches.' },
      { zh: 'branch_taken 放在最外層 if，load-use 放在 else if。', en: 'Give branch_taken the outermost if and load-use the else-if.' },
      { zh: 'Stall 是保持舊值；flush 是把下一級控制清為 bubble，兩者用途不同。', en: 'A stall holds state; a flush converts the next stage into a bubble.' },
    ],
    starter: `module cpu_hazard_control(input wire branch_taken,input wire ex_memread,input wire [4:0] ex_rd,id_rs1,id_rs2,output reg pc_write,if_id_write,if_id_flush,id_ex_flush);
always @* begin
  pc_write=1; if_id_write=1; if_id_flush=0; id_ex_flush=0;
  if(ex_memread && ex_rd==id_rs1) begin
    pc_write=0; if_id_write=0;
  end
  // BUG: rs2 dependency, x0 and branch priority are missing
end
endmodule`,
    testbench: `module tb;reg br=0,mr=0;reg[4:0]rd=0,r1=0,r2=0;wire pw,iw,iff,idf;cpu_hazard_control dut(br,mr,rd,r1,r2,pw,iw,iff,idf);${pass}
task expect;input a,b,c,d;begin #1;check({pw,iw,iff,idf}==={a,b,c,d});end endtask
initial begin expect(1,1,0,0);mr=1;rd=5;r1=5;expect(0,0,0,1);r1=1;r2=5;expect(0,0,0,1);rd=0;r1=0;r2=0;expect(1,1,0,0);rd=5;r1=5;br=1;expect(1,1,1,1);br=0;mr=0;expect(1,1,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cpu-branch-predictor', order: 37, track: 'cpu-cache', difficulty: 'beginner', minutes: 20, points: 140,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '二位元飽和 Branch Predictor', en: 'Two-bit saturating branch predictor' },
    description: { zh: '用二位元飽和計數器記錄單一 branch 的歷史；最高位決定預測 taken/not-taken，降低一次偶發結果造成的預測翻轉。', en: 'Track one branch with a two-bit saturating counter; the MSB predicts taken/not-taken and resists one-off outcomes.' },
    specs: [
      { zh: '狀態 00/01 預測 not taken；10/11 預測 taken。reset 到 weakly not taken（01）。', en: 'States 00/01 predict not taken; 10/11 predict taken. Reset to weakly not taken (01).' },
      { zh: 'update=1 且 actual_taken=1 時加一但不可超過 11；not taken 時減一但不可低於 00。', en: 'On update, increment for taken without exceeding 11 and decrement for not-taken without going below 00.' },
      { zh: 'update=0 時保持狀態。', en: 'Hold state when update=0.' },
    ],
    testGroups: [{ zh: 'Taken/not-taken 飽和', en: 'Taken/not-taken saturation' }, { zh: 'Hysteresis', en: 'Hysteresis' }, { zh: 'Reset 與 hold', en: 'Reset and hold' }],
    hints: [
      { zh: '用 reg [1:0] state；predict_taken 直接接 state[1]。', en: 'Use reg [1:0] state and drive predict_taken from state[1].' },
      { zh: '遞增前檢查 state != 2\'b11；遞減前檢查 state != 2\'b00。', en: 'Check against 11 before incrementing and 00 before decrementing.' },
      { zh: '不要讓一般二進位加減造成 11→00 或 00→11 回捲。', en: 'Do not let ordinary arithmetic wrap 11 to 00 or 00 to 11.' },
    ],
    starter: `module branch_predictor_2bit(input wire clk,rst_n,update,actual_taken,output wire predict_taken,output wire [1:0] state_dbg);
  // TODO: one 2-bit saturating counter
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,up=0,taken=0;wire pred;wire[1:0]state;branch_predictor_2bit dut(clk,rst_n,up,taken,pred,state);always #5 clk=~clk;${pass}
task train;input outcome;begin @(negedge clk);up=1;taken=outcome;@(posedge clk);#1;end endtask
initial begin repeat(2)@(posedge clk);#1;check(state===1&&pred===0);rst_n=1;train(1);check(state===2&&pred===1);train(1);train(1);check(state===3&&pred===1);train(0);check(state===2&&pred===1);train(0);check(state===1&&pred===0);train(0);train(0);check(state===0&&pred===0);@(negedge clk);up=0;taken=1;@(posedge clk);#1;check(state===0);rst_n=0;@(posedge clk);#1;check(state===1);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cache-direct-mapped', order: 38, track: 'cpu-cache', difficulty: 'intermediate', minutes: 35, points: 220,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Direct-mapped Cache：Tag／Index／Offset', en: 'Direct-mapped cache: tag, index, and offset' },
    description: { zh: '實作四列、每列一個 32-bit word 的 direct-mapped cache。用位址拆出 byte offset、index 與 tag，並觀察相同 index 的不同 tag 如何互相驅逐。', en: 'Build a four-line direct-mapped cache with one 32-bit word per line. Decode byte offset, index, and tag, then observe conflict eviction.' },
    specs: [
      { zh: 'addr[1:0] 是 byte offset、addr[3:2] 是 2-bit index、addr[31:4] 是 tag。', en: 'addr[1:0] is the byte offset, addr[3:2] the two-bit index, and addr[31:4] the tag.' },
      { zh: 'fill_en 在 posedge 將對應 line 的 valid、tag、data 寫入；同步低有效 reset 清除 valid。', en: 'On a rising edge, fill_en writes the selected line valid, tag, and data; synchronous active-low reset clears valid bits.' },
      { zh: 'hit=req && valid[index] && tag 相等；miss 時 rdata=0。Direct-mapped 只需一個 tag compare，硬體簡單但 conflict miss 較多。', en: 'hit requires req, a valid line, and a matching tag; return zero on a miss. Direct mapping needs one tag comparison but has more conflict misses.' },
    ],
    testGroups: [{ zh: '位址拆解與 hit', en: 'Address decode and hit' }, { zh: 'Byte offset 不改變 line', en: 'Byte offset stays within a line' }, { zh: '相同 index 的 conflict eviction', en: 'Same-index conflict eviction' }],
    hints: [
      { zh: '建立 valid[0:3]、tags[0:3]、data[0:3]。', en: 'Create valid[0:3], tags[0:3], and data[0:3].' },
      { zh: 'fill 與 lookup 使用相同的 address slicing，否則永遠無法命中。', en: 'Use identical address slicing for fill and lookup.' },
      { zh: 'rdata 可寫成 hit ? data[req_addr[3:2]] : 32\'b0。', en: 'rdata can be hit ? data[req_addr[3:2]] : 32\'b0.' },
    ],
    starter: `module direct_mapped_cache(input wire clk,rst_n,fill_en,input wire [31:0] fill_addr,fill_data,input wire req,input wire [31:0] req_addr,output wire hit,output wire [31:0] rdata);
  // TODO: four one-word cache lines
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,fe=0,req=0;reg[31:0]fa=0,fd=0,ra=0;wire hit;wire[31:0]rd;direct_mapped_cache dut(clk,rst_n,fe,fa,fd,req,ra,hit,rd);always #5 clk=~clk;${pass}
task fill;input[31:0]a,d;begin @(negedge clk);fe=1;fa=a;fd=d;@(posedge clk);#1;fe=0;end endtask
task lookup;input[31:0]a,d;input h;begin ra=a;req=1;#1;check(hit===h);check(rd===(h?d:0));req=0;end endtask
initial begin repeat(2)@(posedge clk);rst_n=1;lookup(4,0,0);fill(32'h00000004,32'h11112222);lookup(32'h00000004,32'h11112222,1);lookup(32'h00000005,32'h11112222,1);fill(32'h00000008,32'h33334444);lookup(8,32'h33334444,1);fill(32'h00000014,32'haabbccdd);lookup(4,0,0);lookup(32'h14,32'haabbccdd,1);lookup(8,32'h33334444,1);rst_n=0;@(posedge clk);#1;lookup(32'h14,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cache-two-way', order: 39, track: 'cpu-cache', difficulty: 'advanced', minutes: 45, points: 280,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '2-way Set-associative Cache Lookup', en: 'Two-way set-associative cache lookup' },
    description: { zh: '實作兩個 set、每個 set 兩個 way、每列一個 32-bit word 的 cache lookup。相同 set 的兩個 tag 可以同時存在。', en: 'Build lookup logic for a cache with two sets, two ways per set, and one 32-bit word per line. Two tags mapping to the same set can coexist.' },
    specs: [
      { zh: 'addr[1:0] 是 byte offset、addr[2] 是 set index、addr[31:3] 是 tag。fill_way 指定寫入 way。', en: 'addr[1:0] is the byte offset, addr[2] the set index, and addr[31:3] the tag. fill_way selects the written way.' },
      { zh: '同時比較 way0 與 way1 的 valid/tag；hit_way 指出命中的 way，miss 時 hit_way=0、rdata=0。', en: 'Compare both ways in parallel. hit_way identifies the hit; drive hit_way and rdata to zero on a miss.' },
      { zh: '相較 direct-mapped，2-way 降低 conflict miss，但需要兩個 tag comparator、data mux 與 replacement state，因此面積、功耗及 hit path 可能增加。', en: 'Compared with direct mapping, two ways reduce conflict misses but add a tag comparator, data mux, and replacement state, potentially increasing area, power, and hit latency.' },
    ],
    testGroups: [{ zh: '兩個 way 平行命中', en: 'Parallel way lookup' }, { zh: '相同 set 的兩筆資料共存', en: 'Two lines coexist in one set' }, { zh: 'Way replacement 與 reset', en: 'Way replacement and reset' }],
    hints: [
      { zh: '每個 way 都需要自己的 valid、tag、data 陣列。', en: 'Each way needs its own valid, tag, and data arrays.' },
      { zh: '先產生 hit0、hit1，再由 mux 決定 hit_way 與 rdata。', en: 'Compute hit0 and hit1, then select hit_way and rdata with a mux.' },
      { zh: '兩個位址只要 addr[2] 相同就落在同一 set；tag 不同可分別放進兩個 way。', en: 'Addresses with the same addr[2] share a set; different tags can occupy different ways.' },
    ],
    starter: `module two_way_cache(input wire clk,rst_n,fill_en,fill_way,input wire [31:0] fill_addr,fill_data,input wire req,input wire [31:0] req_addr,output wire hit,output wire hit_way,output wire [31:0] rdata);
  // TODO: two sets and two ways, one word per line
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,fe=0,fw=0,req=0;reg[31:0]fa=0,fd=0,ra=0;wire hit,hw;wire[31:0]rd;two_way_cache dut(clk,rst_n,fe,fw,fa,fd,req,ra,hit,hw,rd);always #5 clk=~clk;${pass}
task fill;input way;input[31:0]a,d;begin @(negedge clk);fe=1;fw=way;fa=a;fd=d;@(posedge clk);#1;fe=0;end endtask
task lookup;input[31:0]a,d;input h,w;begin req=1;ra=a;#1;check(hit===h);check(rd===(h?d:0));if(h)check(hw===w);else check(hw===0);req=0;end endtask
initial begin repeat(2)@(posedge clk);rst_n=1;fill(0,0,32'h11111111);fill(1,8,32'h22222222);lookup(0,32'h11111111,1,0);lookup(8,32'h22222222,1,1);fill(0,16,32'h33333333);lookup(0,0,0,0);lookup(8,32'h22222222,1,1);lookup(16,32'h33333333,1,0);fill(1,4,32'h44444444);lookup(4,32'h44444444,1,1);lookup(12,0,0,0);rst_n=0;@(posedge clk);#1;lookup(8,0,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cache-fully-associative', order: 40, track: 'cpu-cache', difficulty: 'intermediate', minutes: 35, points: 220,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Fully-associative Cache／CAM Lookup', en: 'Fully associative cache / CAM lookup' },
    description: { zh: '建立四列 fully-associative lookup：request tag 可放在任一列，lookup 時同時搜尋全部 tag，不使用 index。', en: 'Build a four-entry fully associative lookup: a requested tag may reside in any entry, so every tag is searched without an index.' },
    specs: [
      { zh: 'fill_index 只指定寫入哪一列；lookup 僅使用 req_tag，不可由 tag 推導固定列。', en: 'fill_index selects the written entry; lookup uses only req_tag and must not derive a fixed entry from it.' },
      { zh: '四列都要檢查 valid && tag match；多重命中時回傳最低 index，miss 時輸出皆為 0。', en: 'Check valid and tag match in all entries. On duplicate hits return the lowest index; return zeros on a miss.' },
      { zh: 'Fully associative conflict miss 最少，但每次 lookup 要比較全部 tag，容量大時 comparator 與 wiring 成本很高，常用於小型 TLB、victim cache 或 CAM。', en: 'Fully associative lookup minimizes conflict misses but compares every tag, so it is practical mainly for small TLBs, victim caches, or CAMs.' },
    ],
    testGroups: [{ zh: '任意 entry 命中', en: 'Hit in any entry' }, { zh: '最低 index 優先', en: 'Lowest-index priority' }, { zh: 'Reset 與 miss', en: 'Reset and miss' }],
    hints: [
      { zh: '用四個 valid、tag、data entries 儲存內容。', en: 'Store four valid, tag, and data entries.' },
      { zh: '組合邏輯先給 hit/index/data 預設值，再依 3→0 的順序覆寫即可讓 0 優先。', en: 'Default outputs, then check entries from 3 down to 0 so entry 0 gets final priority.' },
      { zh: '這題的核心是 parallel compare，不是 RAM index lookup。', en: 'The key is parallel comparison, not indexed RAM lookup.' },
    ],
    starter: `module fully_assoc_cache(input wire clk,rst_n,fill_en,input wire [1:0] fill_index,input wire [7:0] fill_tag,input wire [31:0] fill_data,input wire req,input wire [7:0] req_tag,output reg hit,output reg [1:0] hit_index,output reg [31:0] rdata);
  // TODO: four-entry parallel tag lookup
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,fe=0,req=0;reg[1:0]fi=0;reg[7:0]ft=0,rt=0;reg[31:0]fd=0;wire hit;wire[1:0]hi;wire[31:0]rd;fully_assoc_cache dut(clk,rst_n,fe,fi,ft,fd,req,rt,hit,hi,rd);always #5 clk=~clk;${pass}
task fill;input[1:0]i;input[7:0]t;input[31:0]d;begin @(negedge clk);fe=1;fi=i;ft=t;fd=d;@(posedge clk);#1;fe=0;end endtask
task lookup;input[7:0]t;input h;input[1:0]i;input[31:0]d;begin req=1;rt=t;#1;check(hit===h);check(hi===(h?i:0));check(rd===(h?d:0));req=0;end endtask
initial begin repeat(2)@(posedge clk);rst_n=1;fill(2,8'haa,32'h22222222);fill(0,8'h11,32'h00000011);fill(3,8'hf0,32'h33333333);lookup(8'haa,1,2,32'h22222222);lookup(8'hf0,1,3,32'h33333333);lookup(8'h77,0,0,0);fill(1,8'haa,32'h11111111);lookup(8'haa,1,1,32'h11111111);fill(0,8'haa,32'h0000aaaa);lookup(8'haa,1,0,32'h0000aaaa);rst_n=0;@(posedge clk);#1;lookup(8'haa,0,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cache-lru', order: 41, track: 'cpu-cache', difficulty: 'intermediate', minutes: 30, points: 190,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '2-way Cache LRU Replacement', en: 'Two-way cache LRU replacement' },
    description: { zh: '為四個 set 分別追蹤 2-way LRU。若有 invalid way 就先使用；兩個 way 都 valid 時才選最久未使用者。', en: 'Track two-way LRU independently for four sets. Prefer an invalid way; use LRU only when both ways are valid.' },
    specs: [
      { zh: 'touch=1 時，touch_way 成為 MRU，因此該 set 的另一個 way 成為下一個 victim。', en: 'On touch, touch_way becomes MRU, so the other way becomes the next victim for that set.' },
      { zh: 'query 時若 way0 invalid 選 0；否則若 way1 invalid 選 1；否則回傳該 set 的 LRU bit。', en: 'For a query, choose invalid way 0 first, then invalid way 1; otherwise return the set LRU bit.' },
      { zh: '每個 set 的歷史必須獨立。reset 將 LRU 初值設為 0，但 invalid 優先使初值不影響空 cache。', en: 'Each set keeps independent history. Reset LRU to zero; invalid-way priority makes the initial value irrelevant in an empty cache.' },
    ],
    testGroups: [{ zh: 'Invalid way 優先', en: 'Invalid-way priority' }, { zh: 'Touch 後選另一 way', en: 'Choose the other way after touch' }, { zh: '各 set 狀態獨立', en: 'Independent state per set' }],
    hints: [
      { zh: '使用 reg lru [0:3]，內容直接表示兩個 way 都 valid 時的 victim。', en: 'Use reg lru [0:3], directly encoding the victim when both ways are valid.' },
      { zh: 'touch way0 後 lru=1；touch way1 後 lru=0。', en: 'After touching way 0 set lru=1; after touching way 1 set lru=0.' },
      { zh: 'victim_way 是組合輸出；LRU 歷史在 posedge 更新。', en: 'victim_way is combinational, while LRU history updates on a rising edge.' },
    ],
    starter: `module cache_lru_2way(input wire clk,rst_n,touch,input wire [1:0] touch_set,input wire touch_way,input wire [1:0] query_set,input wire way0_valid,way1_valid,output reg victim_way);
  // TODO: one LRU state bit per set
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,touch=0,tw=0,v0=0,v1=0;reg[1:0]ts=0,qs=0;wire victim;cache_lru_2way dut(clk,rst_n,touch,ts,tw,qs,v0,v1,victim);always #5 clk=~clk;${pass}
task mark;input[1:0]s;input w;begin @(negedge clk);touch=1;ts=s;tw=w;@(posedge clk);#1;touch=0;end endtask
initial begin repeat(2)@(posedge clk);rst_n=1;qs=0;v0=0;v1=0;#1;check(victim===0);v0=1;v1=0;#1;check(victim===1);v0=1;v1=1;#1;check(victim===0);mark(0,0);qs=0;#1;check(victim===1);mark(1,1);qs=1;#1;check(victim===0);qs=0;#1;check(victim===1);mark(0,1);#1;check(victim===0);qs=1;#1;check(victim===0);rst_n=0;@(posedge clk);#1;qs=0;check(victim===0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-cache-miss-fsm', order: 42, track: 'cpu-cache', difficulty: 'advanced', minutes: 45, points: 290,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Blocking Cache Miss／Write-back FSM', en: 'Blocking cache miss / write-back FSM' },
    description: { zh: '實作簡化 blocking cache controller：hit 立即完成；clean miss 直接 refill；dirty miss 必須先 write-back，再 refill，最後回覆 CPU。', en: 'Build a simplified blocking cache controller: hits complete immediately, clean misses refill, and dirty misses write back before refill and CPU response.' },
    specs: [
      { zh: 'IDLE 的 cpu_req && cache_hit 使 cpu_ready=1；miss 則鎖住一筆 request（位址／資料假設由外部保存）並進入 miss flow。', en: 'In IDLE, a requested hit raises cpu_ready. A miss accepts one request (metadata is assumed stored externally) and enters the miss flow.' },
      { zh: 'Dirty miss：WRITEBACK 保持 writeback_req=1 直到 mem_ready；之後 REFILL 保持 refill_req=1 直到 mem_ready。Clean miss 直接進 REFILL。', en: 'For a dirty miss, hold writeback_req until mem_ready, then hold refill_req until mem_ready. A clean miss enters REFILL directly.' },
      { zh: 'REFILL 完成後進 RESPOND，cpu_ready=1 一拍，再回 IDLE。非 IDLE 時 busy=1，不能接受另一筆 CPU request。', en: 'After refill, enter RESPOND and pulse cpu_ready for one cycle before IDLE. busy is high outside IDLE and no second CPU request is accepted.' },
      { zh: '這是 control-path 練習，不包含 tag/data RAM、位址鎖存、memory protocol、error response 或 non-blocking MSHR。', en: 'This control-path exercise omits tag/data RAMs, metadata latching, memory protocol details, errors, and non-blocking MSHRs.' },
    ],
    testGroups: [{ zh: 'Hit 與 clean miss', en: 'Hit and clean miss' }, { zh: 'Dirty write-back 順序', en: 'Dirty write-back order' }, { zh: 'Memory back-pressure', en: 'Memory back-pressure' }],
    hints: [
      { zh: '使用 IDLE、WRITEBACK、REFILL、RESPOND 四個 Moore states。', en: 'Use four Moore states: IDLE, WRITEBACK, REFILL, and RESPOND.' },
      { zh: '在 WRITEBACK／REFILL 中 mem_ready=0 時保持原狀態與 request。', en: 'Hold state and request while mem_ready is low in WRITEBACK or REFILL.' },
      { zh: '輸出 decode 與 next-state logic 分開；IDLE hit 的 cpu_ready 是組合 handshake。', en: 'Separate output decode from next-state logic; cpu_ready for an IDLE hit is a combinational handshake.' },
    ],
    starter: `module blocking_cache_ctrl(input wire clk,rst_n,cpu_req,cache_hit,victim_dirty,mem_ready,output reg cpu_ready,writeback_req,refill_req,busy);
  // TODO: IDLE, WRITEBACK, REFILL and RESPOND states
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,req=0,hit=0,dirty=0,mready=0;wire ready,wb,refill,busy;blocking_cache_ctrl dut(clk,rst_n,req,hit,dirty,mready,ready,wb,refill,busy);always #5 clk=~clk;${pass}
task tick;begin @(posedge clk);#1;end endtask
initial begin repeat(2)tick;rst_n=1;req=1;hit=1;#1;check(ready===1&&!busy&&!wb&&!refill);req=0;hit=0;#1;check(!ready&&!busy);@(negedge clk);req=1;dirty=0;tick;req=0;check(busy&&refill&&!wb&&!ready);repeat(2)tick;check(refill&&!ready);mready=1;tick;mready=0;check(busy&&ready&&!refill&&!wb);tick;check(!busy&&!ready);@(negedge clk);req=1;dirty=1;tick;req=0;check(busy&&wb&&!refill);repeat(2)tick;check(wb);mready=1;tick;mready=0;check(busy&&refill&&!wb);repeat(2)tick;check(refill);mready=1;tick;mready=0;check(busy&&ready&&!wb&&!refill);tick;check(!busy&&!ready);$display("@@PASS@@");$finish;end endmodule`,
  },
];
