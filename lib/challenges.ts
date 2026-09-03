export type Locale = 'zh' | 'en';

export type Localized = { zh: string; en: string };

export type TrackId = 'rtl' | 'cdc' | 'timing' | 'soc' | 'verification' | 'ppa' | 'dft' | 'low-power';

export type PatternRule = {
  pattern: string;
  flags?: string;
  message: Localized;
  reject?: boolean;
};

export type Challenge = {
  id: string;
  order: number;
  track: TrackId;
  title: Localized;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  minutes: number;
  points: number;
  kind: 'build' | 'debug' | 'constraint' | 'optimize';
  judge: 'simulation' | 'pattern' | 'interactive' | 'cnf';
  language: 'Verilog-2005' | 'SystemVerilog/UVM' | 'Timing Lab' | 'CNF / DIMACS';
  description: Localized;
  specs: Localized[];
  testGroups: Localized[];
  hints: Localized[];
  starter: string;
  testbench?: string;
  patternRules?: PatternRule[];
  referenceSolution?: string;
  supportCode?: string;
};

export const tracks: { id: TrackId; label: Localized; accent: string }[] = [
  { id: 'rtl', label: { zh: 'RTL 基礎', en: 'RTL Foundations' }, accent: 'bg-blue-500' },
  { id: 'cdc', label: { zh: 'CDC 與 Reset', en: 'CDC & Reset' }, accent: 'bg-cyan-500' },
  { id: 'timing', label: { zh: '時序收斂', en: 'Timing Closure' }, accent: 'bg-violet-500' },
  { id: 'soc', label: { zh: 'SoC 介面', en: 'SoC Interfaces' }, accent: 'bg-amber-500' },
  { id: 'verification', label: { zh: '驗證與 Debug', en: 'Verification & Debug' }, accent: 'bg-emerald-500' },
  { id: 'ppa', label: { zh: 'PPA 與面積', en: 'PPA & Area' }, accent: 'bg-rose-500' },
  { id: 'dft', label: { zh: 'DFT 與記憶體測試', en: 'DFT & Memory Test' }, accent: 'bg-orange-500' },
  { id: 'low-power', label: { zh: '低功耗設計', en: 'Low Power' }, accent: 'bg-lime-500' },
];

const educationalSram = `\`timescale 1ns/1ps
// ORIGINAL EDUCATIONAL MODEL.
// This is not a foundry macro or signoff timing model.
module edu_sram_1rw_256x32(
  input  wire        CLK,
  input  wire        CEN_n,
  input  wire        WEN_n,
  input  wire [3:0]  BWEN_n,
  input  wire [7:0]  A,
  input  wire [31:0] D,
  output reg  [31:0] Q
);
  reg [31:0] mem [0:255];
  integer i;

  initial begin
    for (i = 0; i < 256; i = i + 1)
      mem[i] = 0;
  end

  always @(posedge CLK) begin
    if (!CEN_n) begin
      if (!WEN_n) begin
        if (!BWEN_n[0]) mem[A][7:0]   <= D[7:0];
        if (!BWEN_n[1]) mem[A][15:8]  <= D[15:8];
        if (!BWEN_n[2]) mem[A][23:16] <= D[23:16];
        if (!BWEN_n[3]) mem[A][31:24] <= D[31:24];
      end else begin
        #0.35 Q <= mem[A];
      end
    end
  end
endmodule
`;

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

export const challenges: Challenge[] = [
  {
    id: 'rtl-edge-pulse', order: 1, track: 'rtl', difficulty: 'beginner', minutes: 10, points: 80,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '上升沿單週期脈衝', en: 'One-cycle rising-edge pulse' },
    description: { zh: '把 level 訊號的每次 0→1 轉換變成恰好一個 clock 的 pulse，避免持續高電位重複觸發下游。', en: 'Convert every 0→1 transition of a level signal into exactly one clock-cycle pulse.' },
    specs: [
      { zh: '同步 active-low reset；reset 後 pulse 必須為 0。', en: 'Synchronous active-low reset; pulse must be 0 after reset.' },
      { zh: '輸入維持為 1 時不可重複產生 pulse。', en: 'A high input must not generate repeated pulses.' },
    ],
    testGroups: [{ zh: '單次上升沿', en: 'Single rising edge' }, { zh: '長時間 high', en: 'Long high level' }, { zh: '連續切換與 reset', en: 'Repeated transitions and reset' }],
    hints: [{ zh: '保存上一拍的輸入，pulse = current & ~previous。', en: 'Store the previous input; pulse = current & ~previous.' }],
    starter: `module edge_pulse(input wire clk, input wire rst_n, input wire in_level, output reg pulse);
  // TODO
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,in_level=0; reg previous_ref=0,expected_pulse=0; wire pulse; edge_pulse dut(clk,rst_n,in_level,pulse); always #5 clk=~clk; ${pass}
always @(posedge clk) begin if(!rst_n) begin previous_ref<=0;expected_pulse<=0;end else begin expected_pulse<=in_level&~previous_ref;previous_ref<=in_level;end end
initial begin
  repeat(2) @(posedge clk); rst_n<=1; @(posedge clk); #1; check(pulse===0);
  @(negedge clk); in_level=1; @(posedge clk); #1; check(pulse===1);
  @(posedge clk); #1; check(pulse===0); @(posedge clk); #1; check(pulse===0);
  @(negedge clk); in_level=0; @(posedge clk); #1; check(pulse===0);
  @(negedge clk); in_level=1; @(posedge clk); #1; check(pulse===1);
  $display("@@PASS@@"); $finish;
end endmodule`,
  },
  {
    id: 'rtl-saturating-counter', order: 2, track: 'rtl', difficulty: 'beginner', minutes: 12, points: 90,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '修好飽和計數器', en: 'Repair a saturating counter' },
    description: { zh: '修正會 overflow／underflow 的 4-bit 計數器，使其在 0 與 15 飽和。', en: 'Repair a 4-bit counter so it saturates at 0 and 15 instead of wrapping.' },
    specs: [{ zh: 'en=0 保持；up=1 加一；up=0 減一。', en: 'Hold when en=0; increment for up=1 and decrement for up=0.' }],
    testGroups: [{ zh: '一般加減', en: 'Normal count' }, { zh: '上下界', en: 'Upper/lower bounds' }, { zh: 'enable 保持', en: 'Enable hold' }],
    hints: [{ zh: '只有 count 尚未到邊界時才更新。', en: 'Update only when count has not reached its boundary.' }],
    starter: `module sat_counter(input wire clk,input wire rst_n,input wire en,input wire up,output reg [3:0] count);
always @(posedge clk) begin
  if (!rst_n) count <= 4'd0;
  else if (en) count <= up ? count + 1'b1 : count - 1'b1; // BUG: wraps
end
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,en=0,up=1; reg[3:0]expected_count=0; wire [3:0] count; sat_counter dut(clk,rst_n,en,up,count); always #5 clk=~clk; ${pass}
always @(posedge clk) begin if(!rst_n) expected_count<=0; else if(en&&up&&expected_count!=15) expected_count<=expected_count+1'b1; else if(en&&!up&&expected_count!=0) expected_count<=expected_count-1'b1; end
initial begin repeat(2) @(posedge clk); rst_n<=1; en<=1; up<=1; repeat(18) @(posedge clk); #1; check(count==15); up<=0; repeat(18) @(posedge clk); #1; check(count==0); en<=0; repeat(2) @(posedge clk); #1; check(count==0); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'rtl-latch-debug', order: 3, track: 'rtl', difficulty: 'beginner', minutes: 10, points: 90,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '移除組合邏輯中的 Latch', en: 'Remove an inferred latch' },
    description: { zh: '這個 mux 在部分 selector 下會保留舊值。補齊組合邏輯，讓所有輸入組合都有定義。', en: 'This mux retains its old value for some selectors. Make the combinational logic complete.' },
    specs: [{ zh: 'sel=0/1/2 選 a/b/c；sel=3 輸出 0。', en: 'Select a/b/c for sel 0/1/2; output 0 for sel 3.' }],
    testGroups: [{ zh: '四種 selector', en: 'All selectors' }, { zh: '不保留舊值', en: 'No retained value' }],
    hints: [{ zh: '在 case 前給 default assignment，或加 default 分支。', en: 'Add a default assignment before case or a default branch.' }],
    starter: `module mux4(input wire [1:0] sel,input wire [7:0] a,b,c,output reg [7:0] y);
always @* begin
  case (sel)
    2'd0: y = a;
    2'd1: y = b;
    2'd2: y = c;
    // BUG: sel=3 is missing
  endcase
end
endmodule`,
    testbench: `module tb; reg [1:0] sel; reg [7:0] a=8'h12,b=8'h34,c=8'h56; wire [7:0] y; mux4 dut(sel,a,b,c,y); ${pass}
initial begin sel=0; #1; check(y==a); sel=1; #1; check(y==b); sel=2; #1; check(y==c); sel=3; #1; check(y==0); a=8'haa; sel=0; #1; check(y==8'haa); sel=3; #1; check(y==0); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'cdc-2ff-level', order: 4, track: 'cdc', difficulty: 'beginner', minutes: 15, points: 100,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '2-FF 單位元 Level 同步器', en: '2-FF single-bit level synchronizer' },
    description: { zh: '將非同步的單位元 level 訊號同步到 clk_dst。2-FF 降低亞穩態傳到下游的機率，但不適用短 pulse 或多位元 bus。', en: 'Synchronize an asynchronous single-bit level into clk_dst. A 2-FF chain reduces metastability propagation, but is not a pulse or multi-bit solution.' },
    specs: [{ zh: '兩級暫存器都由 clk_dst 取樣，輸出來自第二級。', en: 'Both stages sample on clk_dst; output comes from stage two.' }, { zh: 'Reset 非同步 assert，釋放後正常同步。', en: 'Reset asserts asynchronously; normal sampling resumes after release.' }],
    testGroups: [{ zh: '兩拍延遲', en: 'Two-stage latency' }, { zh: '非同步切換', en: 'Asynchronous transitions' }, { zh: 'Reset', en: 'Reset' }],
    hints: [{ zh: '不要在兩級之間加入組合邏輯。', en: 'Do not put combinational logic between the two stages.' }],
    starter: `module cdc_sync(input wire clk_dst,input wire rst_n,input wire async_in,output wire sync_out);
  // TODO: two destination-domain flip-flops
endmodule`,
    testbench: `module tb; reg clk_dst=0,rst_n=0,async_in=0; wire sync_out; cdc_sync dut(clk_dst,rst_n,async_in,sync_out); always #5 clk_dst=~clk_dst; ${pass}
initial begin #3; check(sync_out===0); #4 rst_n=1; #2 async_in=1; @(posedge clk_dst); #1; check(sync_out===0); @(posedge clk_dst); #1; check(sync_out===1); #3 async_in=0; @(posedge clk_dst); #1; check(sync_out===1); @(posedge clk_dst); #1; check(sync_out===0); rst_n=0; #1; check(sync_out===0); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'cdc-reset-release', order: 5, track: 'cdc', difficulty: 'intermediate', minutes: 18, points: 130,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '非同步 Assert、同步 Deassert Reset', en: 'Asynchronous assert, synchronous deassert reset' },
    description: { zh: '建立 reset synchronizer。外部 reset 可以立即清除，但 deassert 必須沿 clk_dst 經兩級釋放，避免 recovery/removal 風險。', en: 'Build a reset synchronizer: assertion is immediate, while deassertion passes through two destination-clock stages.' },
    specs: [{ zh: '輸入 arst_n 拉低後，srst_n 不等待 clock 就要為 0。', en: 'When arst_n falls, srst_n must fall without waiting for a clock.' }, { zh: 'arst_n 拉高後，srst_n 需經兩個上升沿才為 1。', en: 'After arst_n rises, srst_n becomes 1 after two rising edges.' }],
    testGroups: [{ zh: '非同步 assert', en: 'Async assertion' }, { zh: '同步 deassert', en: 'Synchronous deassertion' }],
    hints: [{ zh: '常見寫法是兩個 bit 的 shift register，reset 時清零，否則 shift in 1。', en: 'Use a two-bit shift register: clear asynchronously, otherwise shift in 1.' }],
    starter: `module reset_sync(input wire clk_dst,input wire arst_n,output wire srst_n);
  // TODO
endmodule`,
    testbench: `module tb; reg clk_dst=0,arst_n=0; wire srst_n; reset_sync dut(clk_dst,arst_n,srst_n); always #5 clk_dst=~clk_dst; ${pass}
initial begin #2; check(srst_n===0); #5 arst_n=1; @(posedge clk_dst); #1; check(srst_n===0); @(posedge clk_dst); #1; check(srst_n===1); #2 arst_n=0; #1; check(srst_n===0); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'cdc-toggle-pulse', order: 6, track: 'cdc', difficulty: 'advanced', minutes: 30, points: 190,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Toggle Pulse Synchronizer', en: 'Toggle pulse synchronizer' },
    description: { zh: '把 clk_src 的單週期事件可靠地送到較慢的 clk_dst。來源端每次事件反轉 toggle；目的端同步後以 XOR 產生一拍 pulse。', en: 'Carry a one-cycle event from clk_src to a slower clk_dst using a source toggle, destination synchronizer and XOR edge detection.' },
    specs: [{ zh: '每個彼此間隔足夠的 src_pulse，在目的端恰好產生一拍 dst_pulse。', en: 'Each sufficiently spaced src_pulse produces exactly one dst_pulse.' }, { zh: '兩個事件間隔若短於目的端捕捉能力可能遺失；本題測資不會這樣做。', en: 'Events faster than the destination capture limit may be lost; tests respect this contract.' }],
    testGroups: [{ zh: '異頻事件傳遞', en: 'Asynchronous clock event transfer' }, { zh: '單週期輸出', en: 'One-cycle destination pulse' }],
    hints: [{ zh: '來源 toggle → 目的 2FF → 延遲一拍 → XOR。', en: 'Source toggle → destination 2FF → one-cycle delay → XOR.' }],
    starter: `module pulse_cdc(input wire clk_src,input wire clk_dst,input wire rst_n,input wire src_pulse,output wire dst_pulse);
  // TODO
endmodule`,
    testbench: `module tb; reg clk_src=0,clk_dst=0,rst_n=0,src_pulse=0; wire dst_pulse; integer pulses=0; pulse_cdc dut(clk_src,clk_dst,rst_n,src_pulse,dst_pulse); always #3 clk_src=~clk_src; always #5 clk_dst=~clk_dst; always @(posedge clk_dst) if(dst_pulse) pulses=pulses+1; ${pass}
task fire; begin @(negedge clk_src); src_pulse=1; @(negedge clk_src); src_pulse=0; end endtask
initial begin #2; rst_n=0; #11 rst_n=1; fire(); repeat(6) @(posedge clk_dst); check(pulses==1); fire(); repeat(6) @(posedge clk_dst); check(pulses==2); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'cdc-gray-pointer', order: 7, track: 'cdc', difficulty: 'intermediate', minutes: 18, points: 140,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Binary-to-Gray Pointer', en: 'Binary-to-Gray pointer' },
    description: { zh: '建立 4-bit Gray counter，準備用於 async FIFO pointer crossing。Gray code 保護的是跨域 pointer 的取樣一致性，不是 FIFO data。', en: 'Build a 4-bit Gray counter for async FIFO pointer crossing. Gray coding protects sampled pointer coherence, not FIFO data.' },
    specs: [{ zh: 'enable 時 binary pointer 加一，gray = binary ^ (binary >> 1)。', en: 'Increment binary on enable; gray = binary ^ (binary >> 1).' }, { zh: '相鄰 Gray 值只能改變一個 bit。', en: 'Adjacent Gray values change by only one bit.' }],
    testGroups: [{ zh: 'Binary/Gray 對應', en: 'Binary/Gray mapping' }, { zh: 'one-bit transition', en: 'One-bit transition' }],
    hints: [{ zh: '用 next binary 計算 next gray，避免晚一拍。', en: 'Compute next Gray from next binary to avoid an extra cycle.' }],
    starter: `module gray_counter(input wire clk,input wire rst_n,input wire en,output reg [3:0] bin,output reg [3:0] gray);
  // TODO
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,en=0; wire [3:0] bin,gray; reg [3:0] prev; integer i,ones; gray_counter dut(clk,rst_n,en,bin,gray); always #5 clk=~clk; ${pass}
initial begin repeat(2) @(posedge clk); rst_n<=1; en<=1; prev=0; for(i=1;i<12;i=i+1) begin @(posedge clk); #1; check(bin==i); check(gray==(bin^(bin>>1))); ones=(gray[0]^prev[0])+(gray[1]^prev[1])+(gray[2]^prev[2])+(gray[3]^prev[3]); check(ones==1); prev=gray; end $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'cdc-handshake-bus', order: 8, track: 'cdc', difficulty: 'advanced', minutes: 35, points: 220,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '多位元 CDC Handshake', en: 'Multi-bit CDC handshake' },
    description: { zh: '修正把 8-bit bus 每一位各自做 2-FF 的錯誤設計。使用 req/ack closed-loop handshake；來源在 ack 回來前必須保持資料。', en: 'Replace the incorrect per-bit 2-FF bus crossing with a closed-loop req/ack handshake; hold source data until acknowledgement returns.' },
    specs: [{ zh: 'src_send 且不 busy 時鎖住 src_data 並送出 req。', en: 'Latch src_data and launch req when src_send and not busy.' }, { zh: '目的端只產生一拍 dst_valid，資料必須一致。', en: 'Destination emits one dst_valid pulse with coherent data.' }],
    testGroups: [{ zh: '資料一致性', en: 'Data coherence' }, { zh: 'busy/back-pressure', en: 'Busy/back-pressure' }, { zh: '異頻傳輸', en: 'Asynchronous clocks' }],
    hints: [{ zh: 'bus 本身不逐 bit 同步；以控制 handshake 保證它在目的端取樣期間保持穩定。', en: 'Do not synchronize each bus bit; use the handshake to keep the bus stable during destination capture.' }],
    starter: `module bus_cdc(input wire clk_src,input wire clk_dst,input wire rst_n,input wire src_send,input wire [7:0] src_data,output wire src_busy,output reg dst_valid,output reg [7:0] dst_data);
  // BUG: replacing this per-bit crossing is your task
  reg [7:0] q1,q2;
  always @(posedge clk_dst or negedge rst_n)
    if(!rst_n) begin q1<=0; q2<=0; dst_data<=0; dst_valid<=0; end
    else begin q1<=src_data; q2<=q1; dst_data<=q2; dst_valid<=src_send; end
  assign src_busy = 1'b0;
endmodule`,
    testbench: `module tb; reg cs=0,cd=0,rst_n=0,send=0; reg [7:0] data=0; wire busy,valid; wire [7:0] out; integer seen=0; bus_cdc dut(cs,cd,rst_n,send,data,busy,valid,out); always #3 cs=~cs; always #5 cd=~cd; ${pass}
always @(posedge cd) if(valid) begin if(seen==0) check(out==8'hA5); else check(out==8'h3C); seen=seen+1; end
task tx; input [7:0] v; begin while(busy) @(posedge cs); @(negedge cs); data=v; send=1; @(negedge cs); send=0; while(busy) @(posedge cs); end endtask
initial begin #8 rst_n=1; tx(8'hA5); repeat(8) @(posedge cd); tx(8'h3C); repeat(8) @(posedge cd); check(seen==2); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'timing-pipeline-path', order: 9, track: 'timing', difficulty: 'intermediate', minutes: 25, points: 160,
    kind: 'optimize', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '切開 Critical Path', en: 'Pipeline a critical path' },
    description: { zh: '把長組合路徑切成兩級 pipeline。功能仍為 y=(a+b)+(c+d)，但 valid 到輸出必須固定兩拍。', en: 'Split a long combinational path into two pipeline stages. Keep y=(a+b)+(c+d) with exactly two-cycle valid latency.' },
    specs: [{ zh: '使用 pipeline registers，而不是任意降低 clock。', en: 'Use pipeline registers rather than changing the clock.' }, { zh: '連續 valid transaction 不可遺失。', en: 'Back-to-back valid transactions must not be lost.' }],
    testGroups: [{ zh: '兩拍 latency', en: 'Two-cycle latency' }, { zh: '連續資料', en: 'Back-to-back data' }, { zh: '位寬正確', en: 'Width correctness' }],
    hints: [{ zh: '第一級分別算 a+b、c+d；第二級相加，valid 也要同樣 pipeline。', en: 'Stage 1 computes a+b and c+d; stage 2 adds them. Pipeline valid identically.' }],
    starter: `module pipelined_sum(input wire clk,input wire rst_n,input wire in_valid,input wire [7:0] a,b,c,d,output reg out_valid,output reg [9:0] y);
  // TODO: exactly two registered stages
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,v=0; reg [7:0] a=0,b=0,c=0,d=0; wire ov; wire [9:0] y; reg [9:0] expected; reg expected_valid; pipelined_sum dut(clk,rst_n,v,a,b,c,d,ov,y); always #5 clk=~clk; ${pass}
always @(posedge clk) begin #1; if(rst_n) begin check(ov===expected_valid); if(expected_valid) check(y===expected); expected=a+b+c+d; expected_valid=v; end else begin expected_valid=0;expected=0; end end
initial begin expected=0;expected_valid=0; repeat(2) @(negedge clk); rst_n=1; @(negedge clk); v=1;a=1;b=2;c=3;d=4; @(negedge clk); a=8'hff;b=1;c=2;d=3; @(negedge clk); v=0; repeat(4) @(negedge clk); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'timing-balanced-max', order: 10, track: 'timing', difficulty: 'intermediate', minutes: 22, points: 150,
    kind: 'optimize', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '平衡比較樹', en: 'Balanced comparison tree' },
    description: { zh: '找出四個 8-bit 輸入的最大值。避免串成四層 priority chain；先兩兩比較，再比較兩個區域最大值。', en: 'Find the maximum of four 8-bit inputs. Avoid a long priority chain by comparing pairs and then the two local maxima.' },
    specs: [{ zh: '純組合邏輯，輸入改變後輸出立即更新。', en: 'Pure combinational logic; output follows the inputs.' }, { zh: '請使用平衡的兩層比較結構。', en: 'Use a balanced two-level comparison structure.' }],
    testGroups: [{ zh: '每個輸入成為最大值', en: 'Each input can win' }, { zh: '相同數值', en: 'Equal values' }, { zh: '邊界值', en: 'Boundary values' }],
    hints: [{ zh: '先產生 max_ab 與 max_cd，再比較一次。', en: 'First compute max_ab and max_cd, then compare once more.' }],
    starter: `module max4(input wire [7:0] a,b,c,d,output wire [7:0] y);
  // TODO: build a balanced comparison tree
endmodule`,
    testbench: `module tb; reg [7:0] a,b,c,d; wire [7:0] y; max4 dut(a,b,c,d,y); ${pass}
initial begin a=1;b=2;c=3;d=4;#1;check(y==4);a=255;b=0;c=7;d=8;#1;check(y==255);a=3;b=99;c=5;d=4;#1;check(y==99);a=7;b=7;c=7;d=7;#1;check(y==7);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'timing-valid-retime', order: 11, track: 'timing', difficulty: 'intermediate', minutes: 24, points: 160,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '修正 Pipeline 後的控制對齊', en: 'Repair control alignment after pipelining' },
    description: { zh: '資料路徑加入 pipeline register 後，valid 卻沒有一起延遲。修正控制路徑，使每筆輸出都對到正確 transaction。', en: 'A data-path register was added, but valid was not delayed with it. Realign control and data for every transaction.' },
    specs: [{ zh: '運算 y=a*b+c，輸入到輸出固定兩拍。', en: 'Compute y=a*b+c with exactly two cycles of latency.' }, { zh: 'Bubble 與連續 transaction 都要正確。', en: 'Handle bubbles and back-to-back transactions.' }],
    testGroups: [{ zh: '資料與 valid 對齊', en: 'Data/valid alignment' }, { zh: 'Pipeline bubble', en: 'Pipeline bubble' }, { zh: '連續輸入', en: 'Back-to-back inputs' }],
    hints: [{ zh: '資料有幾級 register，valid 就要有相同級數。', en: 'Delay valid through the same number of register stages as data.' }],
    starter: `module mac_pipe(input wire clk,input wire rst_n,input wire in_valid,input wire [7:0] a,b,c,output reg out_valid,output reg [16:0] y);
  reg [15:0] product;
  reg [7:0] c_delay;
  always @(posedge clk) begin
    if(!rst_n) begin product<=0; c_delay<=0; y<=0; out_valid<=0; end
    else begin
      product <= a*b;
      c_delay <= c;
      y <= product+c_delay;
      out_valid <= in_valid; // BUG: valid is one cycle too early
    end
  end
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,v=0;reg[7:0]a=0,b=0,c=0;wire ov;wire[16:0]y;reg expected_valid;reg[16:0]expected;mac_pipe d(clk,rst_n,v,a,b,c,ov,y);always #5 clk=~clk;${pass}
always @(posedge clk) begin #1;if(rst_n)begin check(ov===expected_valid);if(expected_valid)check(y===expected);expected_valid=v;expected=a*b+c;end else begin expected_valid=0;expected=0;end end
initial begin expected_valid=0;expected=0;repeat(2)@(negedge clk);rst_n=1;@(negedge clk);v=1;a=3;b=4;c=5;@(negedge clk);v=0;@(negedge clk);v=1;a=9;b=2;c=1;@(negedge clk);v=0;repeat(5)@(negedge clk);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'timing-hold-lab', order: 12, track: 'timing', difficulty: 'intermediate', minutes: 12, points: 140,
    kind: 'debug', judge: 'interactive', language: 'Timing Lab',
    title: { zh: 'Hold Violation 修復實驗', en: 'Hold violation repair lab' },
    description: { zh: '觀察 setup/hold slack，選擇修復動作並看結果。重點是理解修法，而不是背 ICC2、Innovus 或 OpenROAD 的指令。', en: 'Inspect setup/hold slack, choose a repair action, and observe the result. Learn the method rather than vendor-specific commands.' },
    specs: [{ zh: '目標：hold slack ≥ 0，同時維持 setup slack ≥ 0。', en: 'Goal: hold slack ≥ 0 while preserving setup slack ≥ 0.' }, { zh: '插入 RTL pipeline FF 會改變功能 latency，通常不是 hold 修法。', en: 'Adding an RTL pipeline FF changes functional latency and is not a normal hold fix.' }],
    testGroups: [{ zh: '判讀 min/max slack', en: 'Read min/max slack' }, { zh: '選擇不改功能的修法', en: 'Choose a function-preserving repair' }, { zh: '修後重新檢查', en: 'Recheck after repair' }],
    hints: [{ zh: 'Hold 是資料太快到；在 data path 增加少量延遲通常能修正，但也要重新確認 setup。', en: 'Hold means data arrives too early; add a small data-path delay, then recheck setup.' }],
    starter: '',
  },
  {
    id: 'soc-apb-register', order: 13, track: 'soc', difficulty: 'intermediate', minutes: 25, points: 160,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'APB 控制暫存器', en: 'APB control register block' },
    description: { zh: '實作簡化 APB slave。0x00 是可讀寫 control，0x04 是唯讀 status。write transfer 在 PSEL && PENABLE && PWRITE 時完成。', en: 'Implement a simplified APB slave. 0x00 is read/write control and 0x04 is read-only status.' },
    specs: [{ zh: 'PREADY 固定為 1；非法位址讀回 0。', en: 'PREADY is always 1; unmapped reads return 0.' }, { zh: 'status 不能被 bus write 改變。', en: 'Bus writes must not modify status.' }],
    testGroups: [{ zh: 'APB write', en: 'APB write' }, { zh: 'APB read', en: 'APB read' }, { zh: 'Address decode', en: 'Address decode' }],
    hints: [{ zh: '寫入是 sequential；read mux 與 PREADY 可用 combinational assignment。', en: 'Writes are sequential; read mux and PREADY can be combinational.' }],
    starter: `module apb_regs(input wire PCLK,input wire PRESETn,input wire PSEL,input wire PENABLE,input wire PWRITE,input wire [7:0] PADDR,input wire [31:0] PWDATA,input wire [31:0] status,output reg [31:0] PRDATA,output wire PREADY,output reg [31:0] control);
  // TODO
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0,sel=0,en=0,wr=0; reg [7:0] addr=0; reg [31:0] wdata=0,status=32'hCAFE1234; wire [31:0] rdata,control; wire ready; apb_regs dut(clk,rst_n,sel,en,wr,addr,wdata,status,rdata,ready,control); always #5 clk=~clk; ${pass}
initial begin repeat(2) @(posedge clk); rst_n<=1; @(negedge clk); sel=1;en=1;wr=1;addr=0;wdata=32'h12345678; @(posedge clk); #1; check(control==32'h12345678); wr=0; #1; check(rdata==control); addr=4; #1; check(rdata==status); addr=8; #1; check(rdata==0); check(ready==1); wr=1;wdata=0;addr=4; @(posedge clk); #1; check(control==32'h12345678); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'soc-round-robin', order: 14, track: 'soc', difficulty: 'advanced', minutes: 35, points: 210,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '兩路 Round-Robin Arbiter', en: 'Two-request round-robin arbiter' },
    description: { zh: '兩個 master 同時 request 時，grant 要輪流，避免 starvation。單一 request 則立即服務。', en: 'Alternate grants when both masters request to avoid starvation; serve a lone requester immediately.' },
    specs: [{ zh: 'grant 必須 one-hot 或全 0。', en: 'Grant must be one-hot or zero.' }, { zh: '只有真的 grant 後才更新優先權。', en: 'Update priority only after a grant.' }],
    testGroups: [{ zh: 'Mutual exclusion', en: 'Mutual exclusion' }, { zh: '同時 request 公平性', en: 'Fairness under simultaneous requests' }, { zh: '單一 request', en: 'Single requester' }],
    hints: [{ zh: '保存 last_grant；兩者同時要求時選另一方。', en: 'Track last_grant and choose the other requester on a tie.' }],
    starter: `module rr_arbiter(input wire clk,input wire rst_n,input wire [1:0] req,output reg [1:0] grant);
  // TODO
endmodule`,
    testbench: `module tb; reg clk=0,rst_n=0; reg [1:0] req=0; wire [1:0] g; reg [1:0] prev; rr_arbiter dut(clk,rst_n,req,g); always #5 clk=~clk; ${pass}
initial begin repeat(2) @(posedge clk); rst_n<=1; req<=2'b01; @(posedge clk); #1; check(g==2'b01); req<=2'b10; @(posedge clk); #1; check(g==2'b10); req<=2'b11; @(posedge clk); #1; prev=g; check(g==1||g==2); @(posedge clk); #1; check(g!=prev); prev=g; @(posedge clk); #1; check(g!=prev); req<=0; @(posedge clk); #1; check(g==0); $display("@@PASS@@"); $finish; end endmodule`,
  },
  {
    id: 'verification-fifo-guard', order: 15, track: 'verification', difficulty: 'intermediate', minutes: 18, points: 130,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'FIFO Protocol Guard', en: 'FIFO protocol guard' },
    description: { zh: '不用 SystemVerilog assertion，先用 Verilog checker 偵測 overflow、underflow 與互相矛盾的旗標，建立「自動判錯」思維。', en: 'Without SystemVerilog assertions, build a Verilog checker for overflow, underflow, and contradictory flags.' },
    specs: [{ zh: '每個 posedge 檢查；reset 時 error 清為 0。', en: 'Check on every posedge; clear error during reset.' }, { zh: '任一非法情況發生後，error 保持為 1。', en: 'Latch error high after any illegal condition.' }],
    testGroups: [{ zh: 'Overflow', en: 'Overflow' }, { zh: 'Underflow', en: 'Underflow' }, { zh: 'Flag consistency', en: 'Flag consistency' }],
    hints: [{ zh: 'illegal = (wr_en && full) || (rd_en && empty) || (full && empty)。', en: 'illegal = (wr_en && full) || (rd_en && empty) || (full && empty).' }],
    starter: `module fifo_guard(input wire clk,input wire rst_n,input wire wr_en,input wire rd_en,input wire full,input wire empty,output reg error);
  // TODO: latch error when any illegal condition occurs
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,wr=0,rd=0,full=0,empty=0;wire error;fifo_guard d(clk,rst_n,wr,rd,full,empty,error);always #5 clk=~clk;${pass}
initial begin repeat(2)@(negedge clk);rst_n=1;@(negedge clk);wr=1;full=1;@(posedge clk);#1;check(error==1);rst_n=0;@(posedge clk);#1;check(error==0);rst_n=1;wr=0;full=0;rd=1;empty=1;@(posedge clk);#1;check(error==1);rst_n=0;rd=0;empty=0;@(posedge clk);rst_n=1;full=1;empty=1;@(posedge clk);#1;check(error==1);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'verification-scoreboard-debug', order: 16, track: 'verification', difficulty: 'intermediate', minutes: 22, points: 150,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '修正有 Latency 的 Scoreboard', en: 'Repair a latency-aware scoreboard' },
    description: { zh: 'DUT 是兩拍 latency 的乘加器。修正 checker，使 expected data 與 valid 一起排隊，而不是拿當下 input 跟 output 比。', en: 'The DUT is a two-cycle multiply-add pipeline. Repair the checker so expected data and valid are queued with matching latency.' },
    specs: [{ zh: '請只修改 scoreboard 區塊，不修改 dut_model。', en: 'Modify only the scoreboard block, not dut_model.' }],
    testGroups: [{ zh: 'Latency alignment', en: 'Latency alignment' }, { zh: 'Bubble', en: 'Pipeline bubbles' }, { zh: 'Back-to-back transactions', en: 'Back-to-back transactions' }],
    hints: [{ zh: '建立 expected 與 valid 的兩級 shift registers。', en: 'Build two-stage shift registers for expected data and valid.' }],
    starter: `module latency_checker(input wire clk,input wire rst_n,input wire in_valid,input wire [7:0] a,b,c,input wire out_valid,input wire [16:0] y,output reg error);
  // BUG: compares against the current transaction instead of the one from two cycles ago
  always @(posedge clk) begin
    if(!rst_n) error <= 1'b0;
    else if(out_valid) error <= (y != (a*b+c));
  end
endmodule`,
    testbench: `module dut_model(input wire clk,rst_n,in_valid,input wire [7:0] a,b,c,output reg out_valid,output reg [16:0] y); reg v1; reg [16:0] d1; always @(posedge clk) if(!rst_n) begin v1<=0;out_valid<=0;d1<=0;y<=0; end else begin v1<=in_valid;d1<=a*b+c;out_valid<=v1;y<=d1;end endmodule
module tb; reg clk=0,rst_n=0,v=0,corrupt=0;reg[7:0]a=0,b=0,c=0;wire ov,err;wire[16:0]y;wire[16:0]observed_y=corrupt?(y^17'd1):y; dut_model d(clk,rst_n,v,a,b,c,ov,y); latency_checker s(clk,rst_n,v,a,b,c,ov,observed_y,err); always #5 clk=~clk; ${pass}
initial begin repeat(2)@(negedge clk);rst_n=1;@(negedge clk);v=1;a=3;b=4;c=5;@(negedge clk);a=9;b=2;c=1;@(negedge clk);v=0;a=99;b=99;c=99;repeat(5)@(negedge clk);check(err===0);corrupt=1;v=1;a=7;b=8;c=9;repeat(4)@(negedge clk);check(err===1);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'ppa-width-discipline', order: 17, track: 'ppa', difficulty: 'beginner', minutes: 15, points: 110,
    kind: 'optimize', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '縮小不必要的 Datapath', en: 'Right-size an over-wide datapath' },
    description: { zh: '輸入都是 8-bit unsigned，輸出只需要 a+b 的完整精度。修正不必要的 64-bit datapath，功能要正確且 y 介面必須維持 9-bit。', en: 'Inputs are 8-bit unsigned and y only needs full precision for a+b. Remove the unnecessary 64-bit datapath while keeping the 9-bit interface.' },
    specs: [{ zh: '不要截掉 carry；最大值應為 510。', en: 'Preserve carry; maximum result is 510.' }, { zh: '通過後可用瀏覽器內 Yosys 比較泛用 cell 數；本題先做功能與位寬紀律。', en: 'After passing, compare generic cell counts with in-browser Yosys; first focus on function and width discipline.' }],
    testGroups: [{ zh: 'Corner values', en: 'Corner values' }, { zh: 'Output width', en: 'Output width' }],
    hints: [{ zh: '只需要一個 9-bit adder。', en: 'Only a 9-bit adder is needed.' }],
    starter: `module compact_adder(input wire [7:0] a,b,output reg [8:0] y);
  reg [63:0] a_wide, b_wide, sum_wide; // TODO: remove needless width
  always @* begin
    a_wide = a; b_wide = b; sum_wide = a_wide + b_wide; y = sum_wide[8:0];
  end
endmodule`,
    testbench: `module tb;reg[7:0]a,b;wire[8:0]y;compact_adder d(a,b,y);${pass} initial begin a=0;b=0;#1;check(y==0);a=255;b=255;#1;check(y==510);a=91;b=37;#1;check(y==128);$display("@@PASS@@");$finish;end endmodule`,
    referenceSolution: `module compact_adder(input wire [7:0] a,b,output wire [8:0] y);
  assign y = {1'b0,a} + {1'b0,b};
endmodule`,
  },
  {
    id: 'ppa-shared-adder', order: 18, track: 'ppa', difficulty: 'advanced', minutes: 35, points: 210,
    kind: 'optimize', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '以多週期換取較小面積', en: 'Trade latency for a smaller datapath' },
    description: { zh: '用同一個加法器分四拍累加 a、b、c、d，而不是在一拍內建立三個加法器。這題練習 area/latency trade-off。', en: 'Reuse one adder across four cycles to sum a, b, c, and d instead of building a three-adder combinational tree.' },
    specs: [{ zh: 'start 只在 idle 時接受；運算期間 busy=1。', en: 'Accept start only while idle; busy stays high during accumulation.' }, { zh: '第四次累加完成時 done 維持一拍，sum 為 10-bit 完整結果。', en: 'Pulse done for one cycle after the fourth addition; sum is the full 10-bit result.' }],
    testGroups: [{ zh: '資源共用控制', en: 'Resource-sharing control' }, { zh: 'Latency 與 done', en: 'Latency and done' }, { zh: '最大值 1020', en: 'Maximum value 1020' }],
    hints: [{ zh: '先鎖住四個輸入，再用 2-bit index 每拍選一個值加到 accumulator。', en: 'Latch all four inputs, then use a 2-bit index to add one value to the accumulator each cycle.' }],
    starter: `module serial_sum4(input wire clk,input wire rst_n,input wire start,input wire [7:0] a,b,c,d,output reg busy,output reg done,output reg [9:0] sum);
  // TODO: reuse one adder over four cycles
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,start=0;reg[7:0]a,b,c,d;wire busy,done;wire[9:0]sum;integer wait_cycles;serial_sum4 dut(clk,rst_n,start,a,b,c,d,busy,done,sum);always #5 clk=~clk;${pass}
task run_case;input[7:0]ta,tb,tc,td;input[9:0]expected;begin @(negedge clk);a=ta;b=tb;c=tc;d=td;start=1;@(negedge clk);start=0;wait_cycles=0;while(!done&&wait_cycles<8)begin @(negedge clk);wait_cycles=wait_cycles+1;end check(done==1);check(sum==expected);@(negedge clk);check(done==0);check(busy==0);end endtask
initial begin rst_n=0;repeat(2)@(negedge clk);rst_n=1;run_case(1,2,3,4,10);run_case(255,255,255,255,1020);$display("@@PASS@@");$finish;end endmodule`,
    referenceSolution: `module serial_sum4(input wire clk,input wire rst_n,input wire start,input wire [7:0] a,b,c,d,output reg busy,output reg done,output reg [9:0] sum);
  reg [7:0] a_q,b_q,c_q,d_q;
  reg [1:0] index;
  reg [9:0] accumulator;
  always @(posedge clk) begin
    if(!rst_n) begin busy<=0;done<=0;sum<=0;index<=0;accumulator<=0;a_q<=0;b_q<=0;c_q<=0;d_q<=0; end
    else begin
      done <= 1'b0;
      if(!busy && start) begin a_q<=a;b_q<=b;c_q<=c;d_q<=d;index<=0;accumulator<=0;busy<=1; end
      else if(busy) begin
        case(index)
          2'd0: accumulator <= accumulator + a_q;
          2'd1: accumulator <= accumulator + b_q;
          2'd2: accumulator <= accumulator + c_q;
          2'd3: begin sum <= accumulator + d_q; busy <= 0; done <= 1; end
        endcase
        index <= index + 1'b1;
      end
    end
  end
endmodule`,
  },
  {
    id: 'soc-axi-lite-accelerator', order: 19, track: 'soc', difficulty: 'advanced', minutes: 45, points: 260,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'ARM 控制加速器：AXI4-Lite', en: 'ARM-controlled accelerator: AXI4-Lite' },
    description: { zh: '實作加速器的 memory-mapped 控制暫存器。ARM core 透過 AXI4-Lite 寫入來源位址、目的位址與長度，再寫 CTRL.start 啟動；STATUS.done 可供軟體輪詢。', en: 'Build a memory-mapped accelerator control block. An ARM core writes source, destination, and length registers over AXI4-Lite, then starts the accelerator and polls STATUS.done.' },
    specs: [{ zh: 'AW 與 W channel 必須分開握手，不能假設同一拍抵達。', en: 'AW and W channels handshake independently; do not assume same-cycle arrival.' }, { zh: 'Register map：0x00 CTRL、0x04 STATUS、0x08 SRC、0x0C DST、0x10 LEN。', en: 'Register map: 0x00 CTRL, 0x04 STATUS, 0x08 SRC, 0x0C DST, 0x10 LEN.' }, { zh: 'CTRL bit[0] 寫 1 時，accel_start 只維持一拍。', en: 'Writing CTRL bit[0]=1 creates a one-cycle accel_start pulse.' }],
    testGroups: [{ zh: 'AW/W 獨立握手', en: 'Independent AW/W handshakes' }, { zh: 'Register map', en: 'Register map' }, { zh: 'Start pulse 與 status read', en: 'Start pulse and status read' }],
    hints: [{ zh: '分別保存 AWADDR 與 WDATA；兩者都收到後才真正執行 write 並回 BVALID。', en: 'Capture AWADDR and WDATA separately; commit the write and raise BVALID only after both arrive.' }],
    starter: `module axi_lite_accel_regs(
  input wire ACLK,input wire ARESETn,
  input wire AWVALID,input wire [5:0] AWADDR,output reg AWREADY,
  input wire WVALID,input wire [31:0] WDATA,output reg WREADY,
  output reg BVALID,input wire BREADY,
  input wire ARVALID,input wire [5:0] ARADDR,output reg ARREADY,
  output reg RVALID,output reg [31:0] RDATA,input wire RREADY,
  input wire accel_done,output reg accel_start,
  output reg [31:0] src_addr,output reg [31:0] dst_addr,output reg [31:0] length
);
  // TODO: implement one-outstanding AXI4-Lite register interface
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0;reg awvalid=0,wvalid=0,bready=0,arvalid=0,rready=0,done_in=0;reg[5:0]awaddr=0,araddr=0;reg[31:0]wdata=0;wire awready,wready,bvalid,arready,rvalid,start;wire[31:0]rdata,src,dst,len;integer starts=0;axi_lite_accel_regs d(clk,rst_n,awvalid,awaddr,awready,wvalid,wdata,wready,bvalid,bready,arvalid,araddr,arready,rvalid,rdata,rready,done_in,start,src,dst,len);always #5 clk=~clk;always @(posedge clk)if(start)starts=starts+1;${pass}
task send_aw;input[5:0]addr;integer g;begin @(negedge clk);awaddr=addr;awvalid=1;g=0;while(!awready&&g<12)begin @(negedge clk);g=g+1;end check(awready);@(negedge clk);awvalid=0;end endtask
task send_w;input[31:0]data;integer g;begin @(negedge clk);wdata=data;wvalid=1;g=0;while(!wready&&g<12)begin @(negedge clk);g=g+1;end check(wready);@(negedge clk);wvalid=0;end endtask
task finish_write;integer g;begin g=0;while(!bvalid&&g<12)begin @(negedge clk);g=g+1;end check(bvalid);bready=1;@(negedge clk);bready=0;end endtask
task read_reg;input[5:0]addr;input[31:0]expected;integer g;begin @(negedge clk);araddr=addr;arvalid=1;g=0;while(!arready&&g<12)begin @(negedge clk);g=g+1;end check(arready);@(negedge clk);arvalid=0;g=0;while(!rvalid&&g<12)begin @(negedge clk);g=g+1;end check(rvalid);check(rdata==expected);rready=1;@(negedge clk);rready=0;end endtask
initial begin repeat(2)@(negedge clk);rst_n=1;send_aw(6'h08);repeat(2)@(negedge clk);send_w(32'h1000);finish_write;send_w(32'h2000);repeat(2)@(negedge clk);send_aw(6'h0c);finish_write;send_aw(6'h10);send_w(32'd256);finish_write;check(src==32'h1000);check(dst==32'h2000);check(len==256);send_aw(6'h00);send_w(1);finish_write;repeat(2)@(negedge clk);check(starts==1);done_in=1;read_reg(6'h04,1);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-axi-burst-reader', order: 20, track: 'soc', difficulty: 'advanced', minutes: 40, points: 240,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '加速器讀取記憶體：AXI4 Burst', en: 'Accelerator memory read: AXI4 burst' },
    description: { zh: '實作簡化的 AXI4 read master。收到 start 後送出一筆 AR request，再把每個 R beat 轉成加速器內部 stream，最後以 RLAST 結束。', en: 'Build a simplified AXI4 read master. Launch one AR request after start, stream each R beat into the accelerator, and finish on RLAST.' },
    specs: [{ zh: 'ARVALID 必須保持到 ARREADY handshake。', en: 'Hold ARVALID until the ARREADY handshake.' }, { zh: 'ARLEN = beats - 1；AXI4 的 burst length 是 beat 數減一。', en: 'ARLEN = beats - 1; AXI4 encodes burst length as beat count minus one.' }, { zh: 'RREADY 必須反映內部 stream_ready，支援 back-pressure。', en: 'RREADY must honor internal stream_ready for back-pressure.' }],
    testGroups: [{ zh: 'AR handshake', en: 'AR handshake' }, { zh: '四拍 burst 與 RLAST', en: 'Four-beat burst and RLAST' }, { zh: 'Back-pressure', en: 'Back-pressure' }],
    hints: [{ zh: 'FSM 可分成 IDLE、SEND_AR、RECEIVE_R；只在 RVALID && RREADY && RLAST 時完成。', en: 'Use IDLE, SEND_AR, and RECEIVE_R states; finish only on RVALID && RREADY && RLAST.' }],
    starter: `module axi_burst_reader(
  input wire ACLK,input wire ARESETn,input wire start,input wire [31:0] base_addr,input wire [7:0] beats,
  output reg ARVALID,input wire ARREADY,output reg [31:0] ARADDR,output reg [7:0] ARLEN,
  input wire RVALID,output wire RREADY,input wire [31:0] RDATA,input wire RLAST,
  output wire stream_valid,input wire stream_ready,output wire [31:0] stream_data,
  output reg busy,output reg done
);
  // TODO: implement the read-request and receive-data FSM
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,start=0,arready=0,rvalid=0,rlast=0,stream_ready=1;reg[31:0]base=32'h80000000,rdata=0,expected_data=0;reg expected_valid=0;reg[7:0]beats=4;wire arvalid,rready,svalid,busy,done;wire[31:0]araddr,sdata;wire[7:0]arlen;integer received=0,guard;reg done_seen=0;axi_burst_reader d(clk,rst_n,start,base,beats,arvalid,arready,araddr,arlen,rvalid,rready,rdata,rlast,svalid,stream_ready,sdata,busy,done);always #5 clk=~clk;${pass}
always @(posedge clk)begin if(done)done_seen=1;if(svalid&&stream_ready)begin check(sdata==expected_data);received=received+1;end end
task send_beat;input[31:0]data;input last;input stall;begin @(negedge clk);rdata=data;rvalid=1;rlast=last;expected_data=data;expected_valid=1;if(stall)begin stream_ready=0;@(posedge clk);#1;check(rready==0);@(negedge clk);stream_ready=1;end @(posedge clk);while(!rready)@(posedge clk);@(negedge clk);rvalid=0;rlast=0;expected_valid=0;end endtask
initial begin repeat(2)@(negedge clk);rst_n=1;@(negedge clk);start=1;@(negedge clk);start=0;guard=0;while(!arvalid&&guard<8)begin @(negedge clk);guard=guard+1;end check(arvalid);check(araddr==base);check(arlen==3);arready=1;@(negedge clk);arready=0;send_beat(32'hA0000000,0,0);send_beat(32'hA0000001,0,1);send_beat(32'hA0000002,0,0);send_beat(32'hA0000003,1,0);repeat(2)@(negedge clk);check(received==4);check(done_seen);check(!busy);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'cdc-async-fifo', order: 21, track: 'cdc', difficulty: 'advanced', minutes: 50, points: 300,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '完整 Async FIFO', en: 'Complete asynchronous FIFO' },
    description: { zh: '完成深度 4 的雙時脈 FIFO：資料由 wclk domain 寫入、rclk domain 讀出，binary pointer 用於記憶體定址，Gray pointer 經兩級同步後產生 full／empty。', en: 'Build a depth-4 dual-clock FIFO. Use binary pointers for memory access and two-flop synchronized Gray pointers for full/empty detection.' },
    specs: [{ zh: '禁止逐 bit 同步 binary pointer；跨 domain 的 pointer 必須先轉 Gray code。', en: 'Do not synchronize a binary pointer bit by bit; cross the domain using Gray code.' }, { zh: 'pointer 必須比 address 多 1 bit，才能區分相同地址下的 full 與 empty。', en: 'Pointers need one extra wrap bit to distinguish full from empty at the same address.' }, { zh: 'full／empty 必須在各自 clock domain 註冊；reset 後 empty=1、full=0。', en: 'Register full/empty in their local clock domains; empty=1 and full=0 after reset.' }],
    testGroups: [{ zh: '非同步 clock 與 reset', en: 'Asynchronous clocks and reset' }, { zh: '滿／空旗標更新（Gray／2FF 結構需另行 CDC 檢查）', en: 'Flag updates (Gray/2FF structure needs separate CDC analysis)' }, { zh: '順序、full、empty 與 wrap', en: 'Ordering, full, empty, and wrap' }],
    hints: [{ zh: '常見公式：gray = (binary >> 1) ^ binary；判斷 full 時比較 next write Gray 與同步後 read Gray，並反相最高兩個 bits。', en: 'Use gray=(binary>>1)^binary. Full compares next write Gray with the synchronized read Gray after inverting its top two bits.' }],
    starter: `module async_fifo #(parameter DATA_WIDTH=8, ADDR_WIDTH=2)(
  input wire wclk,input wire wrst_n,input wire w_en,input wire [DATA_WIDTH-1:0] wdata,output reg full,
  input wire rclk,input wire rrst_n,input wire r_en,output reg [DATA_WIDTH-1:0] rdata,output reg empty
);
  // TODO: memory, binary/Gray pointers, 2-FF pointer synchronizers, full/empty
endmodule`,
    testbench: `module tb;reg wclk=0,rclk=0,wrst_n=0,rrst_n=0,w_en=0,r_en=0;reg[7:0]wdata=0,expected_data=0;wire[7:0]rdata;wire full,empty;integer guard;async_fifo dut(wclk,wrst_n,w_en,wdata,full,rclk,rrst_n,r_en,rdata,empty);always #3 wclk=~wclk;always #5 rclk=~rclk;${pass}
task push;input[7:0]value;begin @(negedge wclk);wdata=value;w_en=1;@(negedge wclk);w_en=0;end endtask
task pop_check;input[7:0]value;begin while(empty)@(negedge rclk);@(negedge rclk);expected_data=value;r_en=1;@(posedge rclk);#1;check(rdata==expected_data);@(negedge rclk);r_en=0;end endtask
initial begin repeat(2)@(negedge wclk);wrst_n=1;rrst_n=1;check(empty);check(!full);push(8'h11);push(8'h22);push(8'h33);push(8'h44);guard=0;while(!full&&guard<8)begin @(negedge wclk);guard=guard+1;end check(full);push(8'hEE);pop_check(8'h11);pop_check(8'h22);pop_check(8'h33);pop_check(8'h44);guard=0;while(!empty&&guard<8)begin @(negedge rclk);guard=guard+1;end check(empty);@(negedge rclk);r_en=1;repeat(2)@(negedge rclk);r_en=0;repeat(5)@(negedge wclk);check(!full);push(8'h55);push(8'h66);push(8'h77);push(8'h88);check(full);pop_check(8'h55);pop_check(8'h66);pop_check(8'h77);pop_check(8'h88);repeat(5)@(negedge rclk);check(empty);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-sram-ip-wrapper', order: 22, track: 'soc', difficulty: 'intermediate', minutes: 35, points: 210,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '串接 1RW SRAM Compiler IP', en: 'Integrate a 1RW SRAM compiler IP' },
    description: { zh: '用乾淨的 req/write/byte-enable 介面包裝一顆同步單埠 SRAM macro，並正確對齊一拍 read latency 與 rvalid。題目使用自訂 educational macro，不含任何晶圓廠機密資料。', en: 'Wrap a synchronous single-port SRAM macro with a clean request/write/byte-enable interface and align its one-cycle read latency with rvalid. The educational macro is original and contains no foundry-confidential data.' },
    specs: [{ zh: '虛構 timing contract：tCK ≥ 2.0 ns、input setup 0.15 ns、hold 0.05 ns、clock-to-Q 0.35 ns；只用來學會閱讀 macro timing，不代表任何商用製程 library。', en: 'Fictional timing contract: tCK ≥ 2.0 ns, input setup 0.15 ns, hold 0.05 ns, clock-to-Q 0.35 ns. It teaches timing interpretation and does not represent a commercial process library.' }, { zh: 'CEN_n、WEN_n、BWEN_n 都是 active-low；request 在上升沿 t 接受，Q 在 t+0.35 ns 更新，rvalid 在同一上升沿註冊（不額外延後一個 clock）。', en: 'CEN_n/WEN_n/BWEN_n are active-low. A request samples at edge t; Q updates at t+0.35 ns. Register rvalid at that same edge, not one additional clock later.' }, { zh: 'byte enable 必須能只修改選定 byte，未選擇的 byte 保持原值。reset 時禁止 memory request。模型只模擬 clock-to-Q 延遲，沒有 setup/hold 違反偵測；不提供此 macro 的 Yosys 面積估算。', en: 'Byte enable updates only selected bytes. Block memory requests during reset. Only clock-to-Q delay is simulated; setup/hold checks and macro area estimation are not implemented.' }],
    testGroups: [{ zh: 'Active-low macro controls', en: 'Active-low macro controls' }, { zh: '一拍 read latency／rvalid', en: 'One-cycle read latency/rvalid' }, { zh: 'Byte write 與 readback', en: 'Byte write and readback' }],
    hints: [{ zh: '通常 CEN_n=~req、WEN_n=~(req&&write)、BWEN_n=~byte_en；rvalid 必須由「上一拍是 read request」產生。', en: 'Typically CEN_n=~req, WEN_n=~(req&&write), BWEN_n=~byte_en; rvalid comes from the previous read request.' }],
    supportCode: educationalSram,
    starter: `module sram_port_adapter(
  input wire clk,input wire rst_n,input wire req,input wire write,input wire [3:0] byte_en,
  input wire [7:0] addr,input wire [31:0] wdata,output wire [31:0] rdata,output reg rvalid
);
  // IP is provided by the testbench; do not redefine it.
  // Ports: CLK, CEN_n, WEN_n, BWEN_n[3:0], A[7:0], D[31:0], Q[31:0].
  // TODO: Instantiate edu_sram_1rw_256x32 and implement rvalid.
endmodule`,
    testbench: `\`timescale 1ns/1ps
${educationalSram}
module tb;reg clk=0,rst_n=0,req=0,write=0;reg[3:0]be=0;reg[7:0]addr=0;reg[31:0]wdata=0,expected_data=0;wire[31:0]rdata;wire rvalid;sram_port_adapter dut(clk,rst_n,req,write,be,addr,wdata,rdata,rvalid);always #1 clk=~clk;${pass}
task write_word;input[7:0]a;input[31:0]d;input[3:0]bytes;begin @(negedge clk);req=1;write=1;addr=a;wdata=d;be=bytes;@(negedge clk);req=0;write=0;be=0;end endtask
task read_check;input[7:0]a;input[31:0]expected;begin @(negedge clk);req=1;write=0;addr=a;expected_data=expected;@(posedge clk);#0.6;check(rvalid);check(rdata==expected_data);@(negedge clk);req=0;end endtask
initial begin repeat(2)@(negedge clk);check(!rvalid);rst_n=1;write_word(8'h12,32'h11223344,4'b1111);read_check(8'h12,32'h11223344);write_word(8'h12,32'hAABBCCDD,4'b0101);read_check(8'h12,32'h11BB33DD);write_word(8'h12,32'hFFFFFFFF,4'b0000);read_check(8'h12,32'h11BB33DD);write_word(8'hFF,32'hAABBCCDD,4'b1010);read_check(8'hFF,32'hAA00CC00);@(posedge clk);#0.6;check(!rvalid);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'verification-formal-miter', order: 23, track: 'verification', difficulty: 'intermediate', minutes: 20, points: 170,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Formal Equivalence：修正 Miter 反例', en: 'Formal equivalence: repair a miter counterexample' },
    description: { zh: '修正 candidate_logic，使它與 golden function 對所有輸入完全等價。測試會列舉小型輸入空間；實際 Formal 工具則把兩邊輸出 XOR 成 miter，轉成 CNF，再詢問 SAT solver 是否存在 diff=1 的反例。', en: 'Repair candidate_logic so it matches the golden function for every input. This small test exhaustively checks inputs; a formal tool builds an XOR miter, converts it to CNF, and asks a SAT solver whether diff=1 is possible.' },
    specs: [{ zh: '不得更改 module 介面；目標函數為 y=(a&b)^(c|d)。', en: 'Keep the interface unchanged; the target function is y=(a&b)^(c|d).' }, { zh: 'SAT 代表找到不等價反例；UNSAT 才代表此 miter 在模型範圍內等價。', en: 'SAT means a counterexample exists; UNSAT means the miter is equivalent within the model.' }],
    testGroups: [{ zh: '建立 golden/candidate miter', en: 'Golden/candidate miter' }, { zh: '完整輸入空間', en: 'Complete input space' }, { zh: '反例定位', en: 'Counterexample localization' }],
    hints: [{ zh: '不要針對看到的單一反例打補丁；先把 Boolean function 化簡，再修正整體邏輯。', en: 'Do not patch one observed counterexample; simplify the Boolean function and repair the whole implementation.' }],
    starter: `module candidate_logic(input wire a,b,c,d,output wire y);
  // BUG: this implementation is not equivalent to (a & b) ^ (c | d)
  assign y = (a & b) | (c ^ d);
endmodule`,
    testbench: `module tb;reg a,b,c,d;wire y;wire expected_y=(a&b)^(c|d);integer i;candidate_logic dut(a,b,c,d,y);${pass}initial begin for(i=0;i<16;i=i+1)begin {a,b,c,d}=i;#1;if(y!==expected_y)$display("counterexample a=%b b=%b c=%b d=%b candidate=%b golden=%b",a,b,c,d,y,expected_y);check(y===expected_y);end $display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'verification-cnf-sat', order: 24, track: 'verification', difficulty: 'advanced', minutes: 25, points: 220,
    kind: 'constraint', judge: 'cnf', language: 'CNF / DIMACS',
    title: { zh: '把 XOR 關係編碼成 CNF 並交給 SAT', en: 'Encode XOR as CNF and run SAT' },
    description: { zh: '修正 DIMACS CNF，使 variables 1=a、2=b、3=x 精確表示 x=a XOR b。按下執行後，瀏覽器內 DPLL solver 會找 SAT model，並用全部 8 組 assignment 檢查 CNF 是否與 XOR 等價。', en: 'Repair the DIMACS CNF so variables 1=a, 2=b, and 3=x encode x=a XOR b exactly. The in-browser DPLL solver finds a SAT model and checks all eight assignments for equivalence.' },
    specs: [{ zh: '每個 clause 以 0 結束；正整數代表變數、負整數代表反相。', en: 'Terminate every clause with 0; positive integers are variables and negative integers are negations.' }, { zh: 'CNF 必須允許四組合法 XOR assignment，同時排除另外四組。', en: 'The CNF must allow the four legal XOR assignments and reject the other four.' }],
    testGroups: [{ zh: 'DIMACS parser', en: 'DIMACS parser' }, { zh: 'DPLL SAT model', en: 'DPLL SAT model' }, { zh: 'XOR 等價與反例', en: 'XOR equivalence and counterexample' }],
    hints: [{ zh: 'XOR 的每個不合法 assignment 都可由一個 3-literal clause 排除，因此完整 encoding 需要四個 clauses。', en: 'Each illegal XOR assignment can be excluded by one three-literal clause, so the complete encoding needs four clauses.' }],
    starter: `c variable map: 1=a 2=b 3=x
c Fix the incomplete XOR encoding below.
p cnf 3 3
1 2 -3 0
-1 -2 -3 0
1 -2 3 0`,
  },
  {
    id: 'verification-uvm-scoreboard', order: 25, track: 'verification', difficulty: 'advanced', minutes: 30, points: 230,
    kind: 'debug', judge: 'pattern', language: 'SystemVerilog/UVM',
    title: { zh: '修好 UVM Scoreboard 資料路徑', en: 'Repair UVM scoreboard plumbing' },
    description: { zh: '補齊 sequence item 註冊、scoreboard factory 註冊、analysis implementation 與 write() 比對。本站做結構檢查；完整 UVM simulation 仍應在 VCS、Xcelium 或 Questa 搭配對應 UVM library 執行。', en: 'Complete sequence-item registration, scoreboard factory registration, the analysis implementation, and write() comparison. This site checks structure; full UVM simulation belongs in VCS, Xcelium, or Questa with a matching UVM library.' },
    specs: [{ zh: 'transaction 使用 uvm_sequence_item 與 uvm_object_utils。', en: 'The transaction uses uvm_sequence_item and uvm_object_utils.' }, { zh: 'scoreboard 使用 uvm_analysis_imp 接收 monitor transaction，write() 比對 actual/expected。', en: 'The scoreboard receives monitor transactions through uvm_analysis_imp and compares actual/expected in write().' }, { zh: 'Mismatch 必須呼叫 uvm_error，不能只用 $display。', en: 'A mismatch must call uvm_error rather than only $display.' }],
    testGroups: [{ zh: 'Factory registration', en: 'Factory registration' }, { zh: 'Analysis port connection point', en: 'Analysis port connection point' }, { zh: 'Self-checking write()', en: 'Self-checking write()' }],
    hints: [{ zh: '需要 `uvm_object_utils(result_item)、`uvm_component_utils(result_scoreboard)、uvm_analysis_imp #(result_item, result_scoreboard)，以及 function void write(result_item tr)。', en: 'Add the object/component factory macros, uvm_analysis_imp #(result_item, result_scoreboard), and function void write(result_item tr).' }],
    starter: `import uvm_pkg::*;
\`include "uvm_macros.svh"

class result_item extends uvm_sequence_item;
  rand bit [31:0] actual;
  rand bit [31:0] expected;
  // TODO: object factory registration

  function new(string name="result_item");
    super.new(name);
  endfunction
endclass

class result_scoreboard extends uvm_scoreboard;
  // TODO: component factory registration and analysis implementation

  function new(string name="result_scoreboard", uvm_component parent=null);
    super.new(name,parent);
  endfunction

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    // TODO: construct the analysis implementation
  endfunction

  // TODO: implement write(result_item tr) and report mismatches
endclass`,
    patternRules: [
      { pattern: '`uvm_object_utils\\s*\\(\\s*result_item\\s*\\)', message: { zh: '缺少 result_item 的 uvm_object_utils factory 註冊。', en: 'Missing uvm_object_utils registration for result_item.' } },
      { pattern: '`uvm_component_utils\\s*\\(\\s*result_scoreboard\\s*\\)', message: { zh: '缺少 result_scoreboard 的 uvm_component_utils factory 註冊。', en: 'Missing uvm_component_utils registration for result_scoreboard.' } },
      { pattern: 'uvm_analysis_imp\\s*#\\s*\\(\\s*result_item\\s*,\\s*result_scoreboard\\s*\\)', message: { zh: '缺少型別正確的 uvm_analysis_imp。', en: 'Missing a correctly typed uvm_analysis_imp.' } },
      { pattern: 'analysis_\\w+\\s*=\\s*new\\s*\\(', message: { zh: 'build_phase 中尚未建立 analysis implementation。', en: 'The analysis implementation is not constructed in build_phase.' } },
      { pattern: 'function\\s+void\\s+write\\s*\\(\\s*result_item', flags: 'i', message: { zh: '缺少 write(result_item tr) callback。', en: 'Missing the write(result_item tr) callback.' } },
      { pattern: '`uvm_error\\s*\\(', message: { zh: 'Mismatch 路徑必須呼叫 uvm_error。', en: 'The mismatch path must call uvm_error.' } },
    ],
  },
  {
    id: 'verification-bit-true-requant', order: 26, track: 'verification', difficulty: 'advanced', minutes: 35, points: 240,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Bit-True 固定點 Requantization', en: 'Bit-true fixed-point requantization' },
    description: { zh: '將 signed 16-bit accumulator 依 shift 做 round-to-nearest、ties away from zero，再飽和成 signed INT8。testbench 的 golden model 逐 bit 比對 RTL，避免只比較浮點趨勢。', en: 'Round a signed 16-bit accumulator by shift using round-to-nearest with ties away from zero, then saturate to signed INT8. The testbench uses a bit-accurate golden model.' },
    specs: [{ zh: '負數必須用 magnitude 處理後再還原符號，避免 arithmetic shift 的負向偏差。', en: 'Handle negative values by magnitude and restore the sign to avoid arithmetic-shift bias.' }, { zh: '大於 127 飽和為 127；小於 -128 飽和為 -128。', en: 'Saturate values above 127 to 127 and below -128 to -128.' }, { zh: 'shift=0 時不可產生負位移或非法 rounding constant。', en: 'shift=0 must not create a negative shift or invalid rounding constant.' }],
    testGroups: [{ zh: '正負 rounding 與 ties', en: 'Positive/negative rounding and ties' }, { zh: 'INT8 saturation', en: 'INT8 saturation' }, { zh: 'Bit-accurate corner cases', en: 'Bit-accurate corner cases' }],
    hints: [{ zh: '先取 17-bit magnitude；shift>0 時加上 1<<(shift-1) 再右移，最後還原符號並做 [-128,127] saturation。', en: 'Use a 17-bit magnitude; for shift>0 add 1<<(shift-1), shift right, restore the sign, and saturate to [-128,127].' }],
    starter: `module requant_int8(input wire signed [15:0] acc,input wire [3:0] shift,output reg signed [7:0] y);
  // TODO: bit-true rounding and saturation
endmodule`,
    testbench: `module tb;reg signed[15:0]acc;reg[3:0]shift;wire signed[7:0]y;reg signed[7:0]expected_y;integer mag,q,i,j;requant_int8 dut(acc,shift,y);${pass}
function signed[7:0]golden;input integer value;input integer sh;integer m,t;begin m=value<0?-value:value;if(sh==0)t=m;else t=(m+(1<<(sh-1)))>>sh;if(value<0)t=-t;if(t>127)t=127;if(t< -128)t=-128;golden=t;end endfunction
task try_case;input integer value;input integer sh;begin acc=value;shift=sh;expected_y=golden(value,sh);#1;check(y===expected_y);end endtask
initial begin try_case(100,0);try_case(15,1);try_case(14,1);try_case(-15,1);try_case(-14,1);try_case(1024,2);try_case(-1024,2);try_case(32767,7);try_case(-32768,7);try_case(255,1);try_case(-255,1);for(j=0;j<16;j=j+1)begin try_case(-32768,j);try_case(32767,j);for(i=-260;i<=260;i=i+13)try_case(i,j);end $display("@@PASS@@");$finish;end endmodule`,
  },
];

// Original, reduced-size teaching circuits. No vendor IP, ATPG patterns, or PDK data.
challenges.push(
  {
    id: 'dft-scan-capture', order: 27, track: 'dft', difficulty: 'beginner', minutes: 20, points: 130,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '修好 Scan Chain 的 Shift／Capture', en: 'Debug scan-chain shift and capture' },
    description: { zh: '讓 8-bit 狀態暫存器能從 scan_in 載入測試狀態、擷取功能結果，再由 scan_out 讀出。修正 shift 方向與功能 enable 蓋過 scan enable 的錯誤。', en: 'Load an 8-bit state through scan_in, capture functional results, and unload through scan_out. Repair shift direction and scan/functional priority.' },
    specs: [
      { zh: '同一個 clk 上升緣操作；同步低有效 reset 優先，其次 scan_en，最後 func_en；其他情況保持 q。', en: 'One rising-edge clock: synchronous active-low reset has priority over scan_en, then func_en; otherwise hold q.' },
      { zh: 'scan_en=1 時 q <= {q[6:0],scan_in}；scan_out 永遠等於 q[7]。串列位元在移位前讀取，MSB 先送入。', en: 'When scan_en=1, q <= {q[6:0],scan_in}; scan_out is always q[7]. Sample serial output before shifting; load MSB first.' },
      { zh: 'scan_en=0 且 func_en=1 時 capture func_d。這是 scan 行為模型，不是 ATPG、fault coverage 或 at-speed 測試；真實 scan cell 與 clock/reset test control 仍需 DFT flow。', en: 'Capture func_d when scan_en=0 and func_en=1. This models scan behavior, not ATPG, fault coverage, or at-speed testing; real scan cells and clock/reset test controls need a DFT flow.' },
    ],
    testGroups: [{ zh: '逐位移入／移出與方向', en: 'Bit-by-bit load/unload order' }, { zh: 'Capture、保持與控制優先序', en: 'Capture, hold and control priority' }, { zh: 'Reset 與 scan 同時發生', en: 'Reset during scan' }],
    hints: [
      { zh: '先畫 q[7]→scan_out 與 scan_in→q[0]；不要把左右方向記反。', en: 'Draw q[7]→scan_out and scan_in→q[0] before choosing the shift direction.' },
      { zh: 'Scan shift 必須蓋過 func_en，否則功能電路還在 enable 時就無法灌入測試資料。', en: 'Scan shifting must override func_en, or functional activity will corrupt test loading.' },
      { zh: '使用 if(!rst_n)…else if(scan_en)…else if(func_en)…；scan_out 用 assign q[7]，不是額外延遲一拍。', en: 'Use reset → scan_en → func_en priority. Drive scan_out directly from q[7], without an extra register.' },
    ],
    starter: `module scan_register(input wire clk,rst_n,scan_en,scan_in,func_en,input wire [7:0] func_d,output reg [7:0] q,output wire scan_out);
assign scan_out=q[7];
always @(posedge clk) begin
  if(!rst_n) q<=0;
  else if(func_en) q<=func_d; // BUG: functional mode overrides scan
  else if(scan_en) q<={scan_in,q[7:1]}; // BUG: wrong direction
end
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,se=0,si=0,fe=0;reg[7:0]d=0,expected_q=0;wire[7:0]q;wire so;integer i,j;scan_register dut(clk,rst_n,se,si,fe,d,q,so);always #5 clk=~clk;${pass}
task step;input r,s,b,f;input[7:0]v;begin @(negedge clk);rst_n=r;se=s;si=b;fe=f;d=v;#1;check(so===expected_q[7]);@(posedge clk);if(!r)expected_q=0;else if(s)expected_q={expected_q[6:0],b};else if(f)expected_q=v;#1;check(q===expected_q);check(so===expected_q[7]);end endtask
initial begin @(posedge clk);#1;check(q===0);for(j=0;j<8;j=j+1)begin for(i=7;i>=0;i=i-1)step(1,1,((8'hA6^j)>>i)&1,1,8'hff);step(1,0,0,1,8'h81+j);step(1,0,1,0,0);for(i=0;i<8;i=i+1)step(1,1,i[0],0,0);end step(0,1,1,1,255);step(1,0,0,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'dft-sram-mbist', order: 28, track: 'dft', difficulty: 'advanced', minutes: 45, points: 260,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'SRAM MBIST：抓出 Stuck-at 故障', en: 'SRAM MBIST: detect stuck-at faults' },
    description: { zh: '為 8×8-bit 教學 SRAM 寫自我測試控制器：依序寫 0、讀 0、寫 1、讀 1。測資注入各地址的 stuck-at-0／1，確認你的 checker 真正能抓到故障。', en: 'Build a self-test controller for an educational 8×8-bit SRAM: write zero, read zero, write ones, then read ones. Tests inject stuck-at-0/1 faults at every address.' },
    specs: [
      { zh: '四個 phase 都以地址 0→7 掃描；每個 phase 完成後才開始下一個。mem_en=1 的上升緣接受命令，mem_we=1 為寫入。', en: 'Each of the four phases traverses addresses 0→7 and finishes before the next. A rising edge with mem_en accepts a command; mem_we=1 writes.' },
      { zh: 'SRAM 在接受 read 的邊緣後更新 rdata，控制器要到下一個上升緣才能比較；read 與 compare 分兩拍，不可拿舊 Q 比對。', en: 'SRAM updates rdata after the accepting read edge. Compare at the following rising edge using separate read and compare cycles, not stale Q.' },
      { zh: 'Idle 時 start=1 接受一次工作，busy=1；busy 時忽略 start。fail 遇 mismatch 後保持 1，但仍完成所有 32 筆命令；新工作／reset 才清除。', en: 'Accept start only while idle and assert busy; ignore start while busy. Latch fail on mismatch but complete all 32 commands; clear fail only on a new run or reset.' },
      { zh: '最後一筆 read 比較完成後 busy=0、done=1 一拍。同步低有效 reset 中不送命令。測試會破壞 SRAM 原內容，CPU／DMA 必須先停止使用該記憶體。', en: 'After the final read comparison, deassert busy and pulse done for one cycle. No commands during synchronous active-low reset. Testing is destructive: CPU/DMA access must be quiesced.' },
      { zh: '只示範 stuck-at 測試及 latency；不是完整 March C-、耦合／保留故障覆蓋，也不是 flash program/erase 演算法或良率保證。', en: 'This teaches stuck-at detection and latency, not full March C-, coupling/retention coverage, a flash program/erase algorithm, or a yield guarantee.' },
    ],
    testGroups: [{ zh: '健康 SRAM、32 筆命令順序', en: 'Healthy SRAM and 32-command ordering' }, { zh: '每個地址 SA0／SA1 故障注入', en: 'SA0/SA1 injection at every address' }, { zh: 'Sticky fail、重跑與中途 reset', en: 'Sticky failure, rerun and mid-test reset' }],
    hints: [
      { zh: '先畫 IDLE、W0、R0、CHECK0、W1、R1、CHECK1；地址暫存器可重複使用。', en: 'Start with IDLE, W0, R0, CHECK0, W1, R1, CHECK1 and one shared address register.' },
      { zh: 'R0／R1 發命令後先進 CHECK；比較的是前一拍要求的地址，不是下一個地址。', en: 'Enter CHECK after each read; compare the requested address before incrementing it.' },
      { zh: 'CHECK 中 fail <= fail | mismatch；最後 CHECK1 才拉 done。新 start 清 fail，其他正常比較不能清 fail。', en: 'Accumulate fail | mismatch in CHECK. Pulse done only after the last CHECK1; successful comparisons must not clear fail.' },
    ],
    starter: `module sram_mbist(input wire clk,rst_n,start,input wire [7:0] rdata,output reg mem_en,mem_we,output reg [2:0] addr,output reg [7:0] wdata,output reg busy,done,fail);
  // TODO: controller only; SRAM and fault injection are supplied by the testbench
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,start=0;reg[7:0]rdata=0,mem[0:7];wire en,we,busy,done,fail;wire[2:0]addr;wire[7:0]wd;integer fault=-1,stuck=0,phase=0,idx=0,commands=0,i,a,k,guard;reg mismatch_seen=0;reg[7:0]expected_data;wire expected_we=(phase==0||phase==2);sram_mbist dut(clk,rst_n,start,rdata,en,we,addr,wd,busy,done,fail);always #5 clk=~clk;${pass}
always @(posedge clk)begin
 if(!rst_n)begin rdata<=0;phase=0;idx=0;commands=0;mismatch_seen=0;end
 else if(en)begin check(busy===1);check(phase<4);check(addr===idx[2:0]);check(we===expected_we);expected_data=phase<2?0:255;
 if(we)begin check(wd===expected_data);mem[addr]<=wd;end
 else begin if(addr==fault)begin rdata<=stuck? (mem[addr]|8'h04):(mem[addr]&8'hfb);if((stuck&&phase==1)||(!stuck&&phase==3))mismatch_seen=1;end else rdata<=mem[addr];end
 commands=commands+1;if(idx==7)begin idx=0;phase=phase+1;end else idx=idx+1;end
end
task run;input integer f,s;begin @(negedge clk);rst_n=0;start=0;fault=f;stuck=s;@(negedge clk);rst_n=1;start=1;@(negedge clk);start=0;check(busy===1);guard=0;while(done!==1&&guard<100)begin @(negedge clk);guard=guard+1;if(guard==5)start=1;else start=0;end check(done===1);check(busy===0);check(commands==32);check(fail===(f>=0));check(mismatch_seen===(f>=0));@(negedge clk);check(done===0);check(fail===(f>=0));end endtask
initial begin for(i=0;i<8;i=i+1)mem[i]=8'h5a;run(-1,0);for(a=0;a<8;a=a+1)for(k=0;k<2;k=k+1)run(a,k);
// No reset: a fresh healthy run must clear the preceding failure.
@(negedge clk);fault=-1;phase=0;idx=0;commands=0;start=1;@(negedge clk);start=0;check(fail===0);guard=0;while(done!==1&&guard<100)begin @(negedge clk);guard=guard+1;end check(done===1);check(fail===0);check(commands==32);
@(negedge clk);phase=0;idx=0;commands=0;start=1;@(negedge clk);start=0;repeat(5)@(negedge clk);rst_n=0;#1;check(en===0);@(posedge clk);#1;check(busy===0&&done===0&&fail===0);run(-1,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'dft-spare-row-remap', order: 29, track: 'dft', difficulty: 'intermediate', minutes: 25, points: 170,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'BISR 概念：故障列導向備援列', en: 'BISR concept: redirect a faulty row' },
    description: { zh: 'MBIST 找到壞列後，修復 wrapper 要同時改寫 write 路徑及 read 回傳。修正只改讀取、卻仍把資料寫回壞列的 bug。', en: 'After a faulty row is identified, a repair wrapper must redirect both writes and readback. Repair a design that remaps reads but still writes the bad row.' },
    specs: [
      { zh: '16 列 normal bank＋1 列 spare；hit=repair_en && addr==bad_row。normal_addr 永遠接 addr；repair 設定在操作期間保持穩定。', en: 'Sixteen normal rows plus one spare: hit=repair_en && addr==bad_row. Always drive normal_addr=addr; repair configuration stays stable during transactions.' },
      { zh: 'req=1 時只啟用 normal 或 spare 其中之一；各 write enable 必須同時受 req、write、bank 選擇控制。req=0 時所有 enable=0。', en: 'A request enables exactly one bank. Each write enable depends on req, write, and bank selection; all enables are zero when req=0.' },
      { zh: '本題只練組合映射：req && !write 時依 hit 回傳 spare_q 或 normal_q，其他情況 rdata=0；真實同步 SRAM 要另外 pipeline bank select 對齊 read latency。', en: 'This is combinational remapping: return selected spare_q/normal_q only for req && !write, otherwise zero. A synchronous SRAM wrapper must pipeline bank selection to align read latency.' },
      { zh: '不包含 fuse/OTP、修復分析或實體冗餘 SRAM；一列備援只能替代一個壞列。不可把此模型當作 flash erase/program 控制。', en: 'No fuse/OTP, repair analysis, or physical redundant SRAM is included. One spare replaces one bad row; this is not flash erase/program control.' },
    ],
    testGroups: [{ zh: '所有地址／repair 設定', en: 'All addresses and repair settings' }, { zh: '正常列與備援列互斥', en: 'Exclusive normal/spare selection' }, { zh: 'Read／write／idle gating', en: 'Read/write/idle gating' }],
    hints: [
      { zh: '把 hit 當成 bank select，不只用於 rdata mux。', en: 'Use hit for bank selection, not just the read mux.' },
      { zh: '先產生兩個互斥 enable，再由各自 enable & write 產生 write enable。', en: 'Generate mutually exclusive enables, then gate each write enable with its bank enable.' },
      { zh: 'normal_en=req & ~hit、spare_en=req & hit；讀資料只有 req & ~write 時有效。', en: 'normal_en=req & ~hit and spare_en=req & hit; read data is valid only for req & ~write.' },
    ],
    starter: `module spare_row_map(input wire req,write,repair_en,input wire [3:0] addr,bad_row,input wire [7:0] normal_q,spare_q,output wire normal_en,spare_en,normal_we,spare_we,output wire [3:0] normal_addr,output wire [7:0] rdata);
wire hit=repair_en&&(addr==bad_row);
assign normal_addr=addr;
assign normal_en=req; // BUG: still selects the bad row
assign spare_en=req&&hit;
assign normal_we=req&&write; // BUG: write not remapped
assign spare_we=1'b0;
assign rdata=hit?spare_q:normal_q; // BUG: missing idle/write qualification
endmodule`,
    testbench: `module tb;reg req=0,wr=0,re=0;reg[3:0]a=0,b=0;reg[7:0]nq=0,sq=0;wire ne,se,nw,sw;wire[3:0]na;wire[7:0]q;reg hit;reg[7:0]expected_q;integer x,y,c;spare_row_map dut(req,wr,re,a,b,nq,sq,ne,se,nw,sw,na,q);${pass}
initial begin for(x=0;x<16;x=x+1)for(y=0;y<16;y=y+1)for(c=0;c<8;c=c+1)begin a=x;b=y;{req,wr,re}=c;nq=8'h50+x;sq=8'ha0+y;hit=re&&(a==b);expected_q=req&&!wr?(hit?sq:nq):0;#1;check(na===a);check(ne===(req&&!hit));check(se===(req&&hit));check(nw===(req&&wr&&!hit));check(sw===(req&&wr&&hit));check(q===expected_q);end $display("@@PASS@@");$finish;end endmodule`,
  }
);

challenges.push(
  {
    id: 'lp-glitch-free-clock-gate', order: 30, track: 'low-power', difficulty: 'intermediate', minutes: 25, points: 170,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '修好 Clock Gating，保留 Scan 測試通路', en: 'Glitch-free clock gating with test override' },
    description: { zh: '直接 clk & enable 可能產生半截 clock。修好教學 ICG 模型，並讓 test_en 在功能 enable=0 時仍能送入 scan clock。', en: 'Direct clk & enable can create partial clock pulses. Repair an educational ICG model and preserve scan clocks through test_en when functional enable is low.' },
    specs: [
      { zh: 'clk=0 時以透明 latch 保存 en | test_en；clk=1 時不得改變保存值。gclk=clk & 保存值。此處 latch 是刻意設計，不是組合邏輯漏寫 default。', en: 'A transparent latch stores en | test_en while clk=0 and holds while clk=1; gclk=clk & stored enable. This latch is intentional, not an incomplete combinational assignment.' },
      { zh: '不提供 reset；測試先讓 clk=0 且 en=test_en=0 初始化 latch。低相位期間 enable 改變必須能被本次上升緣採用。', en: 'No reset port: initialize with clk=0 and en=test_en=0. Enable changes during the low phase must affect the upcoming rising edge.' },
      { zh: 'en、test_en 在高相位改變不可增加 gclk 上升緣，也不可截短目前的高脈衝。test_en 也必須在 latch 前合併，不能直接 OR 在 gclk 上。', en: 'High-phase changes must neither add gated-clock edges nor truncate a high pulse. Merge test_en before the latch, not directly into gclk.' },
      { zh: '此模型只驗證理想數位波形；真實 ASIC 應使用 library ICG 並檢查 gating setup/hold、CTS、DFT 與 STA。非同步 enable 仍要同步；FPGA 應優先用 CE／專用 clock buffer。', en: 'Only ideal digital waveforms are checked. ASICs need library ICG mapping, gating setup/hold, CTS, DFT and STA; asynchronous enables still need synchronization. Prefer CE/dedicated clock buffers on FPGAs.' },
    ],
    testGroups: [{ zh: '高相位 enable 切換不產生毛刺', en: 'No high-phase enable glitches' }, { zh: '低相位透明與完整脈衝', en: 'Low-phase transparency and full pulses' }, { zh: 'Test override 與關閉', en: 'Test override and disable' }],
    hints: [
      { zh: '問題不是加一個 data FF，而是 enable 不能在 clock 高相位直接影響 AND gate。', en: 'The issue is not a missing data FF: enable must not directly affect the AND gate during the high phase.' },
      { zh: '先用 en | test_en 得到共同 enable，再用 clk=0 的 level-sensitive latch 保存。', en: 'Combine en | test_en, then hold it with a low-level-sensitive latch.' },
      { zh: 'reg gate_en; always @* if(!clk) gate_en=en|test_en; assign gclk=clk&gate_en; 本題刻意不寫 else。', en: 'Use reg gate_en; always @* if(!clk) gate_en=en|test_en; assign gclk=clk&gate_en; intentionally omit else here.' },
    ],
    starter: `module clock_gate(input wire clk,en,test_en,output wire gclk);
assign gclk=clk & en; // BUG: glitch-prone and blocks scan test clocks
endmodule`,
    testbench: `module tb;reg clk=0,en=0,te=0;wire gclk;reg expected_gclk=0;integer c,edges=0,expected_edges=0;reg gate_ref;clock_gate dut(clk,en,te,gclk);always @(posedge gclk)edges=edges+1;${pass}
initial begin #2;check(gclk===0);for(c=0;c<32;c=c+1)begin
en=0;te=0;#2;en=c[0];te=c[1];#2;gate_ref=en|te;clk=1;expected_gclk=gate_ref;if(gate_ref)expected_edges=expected_edges+1;#1;check(gclk===expected_gclk);
en=~en;#1;check(gclk===expected_gclk);te=~te;#1;check(gclk===expected_gclk);en=0;te=0;#1;check(gclk===expected_gclk);check(edges==expected_edges);
clk=0;expected_gclk=0;#2;check(gclk===0);end $display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'lp-operand-isolation', order: 31, track: 'low-power', difficulty: 'beginner', minutes: 20, points: 140,
    kind: 'optimize', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '加速器閒置時，讓乘法器輸入停止切換', en: 'Stop multiplier input toggles while idle' },
    description: { zh: 'HBM-PIM／AI 加速器的資料 bus 可能持續切換，卻不是每拍都需要運算。用 operand registers 的 enable 保持輸入，不要只遮住結果或每拍灌零。', en: 'An accelerator data bus can toggle even without useful work. Hold enabled operand registers, rather than merely masking the result or writing zero on every idle cycle.' },
    specs: [
      { zh: '同步低有效 reset 清 op_a、op_b、out_valid。每個上升緣 out_valid<=in_valid；in_valid=1 才擷取 a、b，否則兩個 operand registers 保持。', en: 'Synchronous active-low reset clears op_a, op_b and out_valid. Each rising edge sets out_valid<=in_valid; capture a,b only when in_valid=1, otherwise hold both operands.' },
      { zh: 'product 必須永遠等於 op_a * op_b（unsigned 8×8→16）；資料在擷取邊緣後有效。本題不另加一級 output register，也不遮蔽閒置結果。', en: 'product always equals op_a * op_b (unsigned 8×8→16) and is valid after capture. Do not add an output register or mask idle results.' },
      { zh: '這是 RTL switching-activity 概念，不是實測功耗。Clock enable 不保證工具插入 ICG；功耗效益還受額外 mux/register、cell library、活動率與時序影響。', en: 'This teaches RTL switching activity, not measured power. A clock enable does not guarantee ICG insertion; mux/register overhead, libraries, activity and timing affect benefits.' },
    ],
    testGroups: [{ zh: '連續有效輸入與最大乘積', en: 'Back-to-back inputs and maximum product' }, { zh: '閒置 bus 切換但 operands 保持', en: 'Toggling idle bus with held operands' }, { zh: 'Valid 對齊與 reset', en: 'Valid alignment and reset' }],
    hints: [
      { zh: '只讓 out_valid=0 不會阻止乘法器內部因輸入變動而切換。', en: 'Deasserting out_valid alone does not stop input-induced switching inside the multiplier.' },
      { zh: '將 operand 更新放在 if(in_valid)，out_valid 則每拍都更新。', en: 'Guard operand updates with in_valid, but update out_valid every cycle.' },
      { zh: 'Idle 分支不賦值 op_a/op_b 才是 FF 保持；不要寫成 op_a<=0。product 以 assign 連接兩個保存的 operands。', en: 'Omit idle assignments to hold the flip-flops; do not clear operands to zero. Assign product from the held operands.' },
    ],
    starter: `module quiet_multiplier(input wire clk,rst_n,in_valid,input wire [7:0] a,b,output reg [7:0] op_a,op_b,output reg out_valid,output wire [15:0] product);
assign product=op_a*op_b;
always @(posedge clk) begin
  if(!rst_n) begin op_a<=0;op_b<=0;out_valid<=0;end
  else begin out_valid<=in_valid;op_a<=a;op_b<=b;end // BUG: idle inputs still toggle
end
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,v=0;reg[7:0]a=0,b=0,expected_a=0,expected_b=0;reg[15:0]expected_product=0;wire[7:0]oa,ob;wire ov;wire[15:0]p;integer i;quiet_multiplier dut(clk,rst_n,v,a,b,oa,ob,ov,p);always #5 clk=~clk;${pass}
task tick;input r,valid;input[7:0]x,y;begin @(negedge clk);rst_n=r;v=valid;a=x;b=y;@(posedge clk);if(!r)begin expected_a=0;expected_b=0;end else if(valid)begin expected_a=x;expected_b=y;end expected_product=expected_a*expected_b;#1;check(oa===expected_a&&ob===expected_b);check(p===expected_product);check(ov===(r&&valid));end endtask
initial begin tick(0,1,255,255);tick(1,1,255,255);for(i=0;i<96;i=i+1)tick(1,(i%5)<2,(i*37)^8'ha5,(i*19)^8'hc3);tick(0,0,1,1);tick(1,0,255,255);tick(1,1,0,0);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'lp-retention-register', order: 32, track: 'low-power', difficulty: 'intermediate', minutes: 25, points: 170,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Retention：斷電前保存、上電後還原', en: 'Retention: save before power-off, restore after' },
    description: { zh: '修正把 retention shadow 也一起清掉的設計。區分可斷電的工作狀態與 always-on 保存狀態，確認 save/restore 和一般 write 的優先序。', en: 'Repair a model that clears its retention shadow on power loss. Separate switchable working state from always-on saved state, and define save/restore/write priority.' },
    specs: [
      { zh: '本題用 always-on clk 模擬狀態：同步低有效 reset 清 q、saved。power_on=0 時下一拍 q=0，但 saved 保持，且忽略 save/restore/wr。', en: 'Use an always-on clock: synchronous active-low reset clears q and saved. With power_on=0, clear q on the next edge but hold saved and ignore save/restore/wr.' },
      { zh: 'power_on=1 的優先序為 restore > save > wr。restore 時 q<=saved；save 時 saved<=q 並保持 q；wr 時 q<=wdata；其他情況保持。', en: 'When powered, priority is restore > save > wr: restore loads q from saved; save copies q to saved and holds q; wr updates q; otherwise hold.' },
      { zh: '同拍 save+wr 保存的是舊 q，不接受 write；restore+save+wr 只 restore。saved 在 restore 時不變。', en: 'Simultaneous save+wr saves old q and suppresses the write; restore+save+wr only restores. Restore does not modify saved.' },
      { zh: 'q=0 只是明確的教學 loss model，真實斷電通常是無效/X；一般 FF 不會自動成為 retention cell。實際需 retention library、always-on 供電與 UPF／power-aware verification。', en: 'Zero is an explicit teaching loss model; real power-off values are invalid/X. Ordinary flip-flops are not retention cells: real designs need retention libraries, always-on supplies and UPF/power-aware verification.' },
    ],
    testGroups: [{ zh: '多次 save/off/on/restore', en: 'Repeated save/off/on/restore' }, { zh: '同時控制的優先序', en: 'Simultaneous control priority' }, { zh: '斷電時忽略控制與 reset', en: 'Ignore controls while off, plus reset' }],
    hints: [
      { zh: '斷電可以破壞 q，但不應破壞 always-on 的 saved。', en: 'Power loss destroys q, not the always-on saved state.' },
      { zh: '先分 reset、power_on=0、正常供電三種情境；正常供電再排 restore/save/write。', en: 'Separate reset, power-off and powered operation; then prioritize restore/save/write.' },
      { zh: 'Off 分支只改 q；save 分支只改 saved；restore 分支只改 q。用 non-blocking assignment 保存邊緣前的狀態。', en: 'Only change q in the off/restore branches, and saved in the save branch. Non-blocking assignments preserve pre-edge state.' },
    ],
    starter: `module retained_register(input wire clk,rst_n,power_on,save,restore,wr,input wire [7:0] wdata,output reg [7:0] q,saved);
always @(posedge clk) begin
  if(!rst_n) begin q<=0;saved<=0;end
  else if(!power_on) begin q<=0;saved<=0;end // BUG: loses retention image
  else if(wr) q<=wdata; // BUG: priority
  else if(save) saved<=q;
  else if(restore) q<=saved;
end
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,p=0,s=0,r=0,w=0;reg[7:0]d=0,expected_q=0,expected_saved=0;wire[7:0]q,saved;integer i;retained_register dut(clk,rst_n,p,s,r,w,d,q,saved);always #5 clk=~clk;${pass}
task tick;input reset_n,power,sv,rs,wr;input[7:0]data;begin @(negedge clk);rst_n=reset_n;p=power;s=sv;r=rs;w=wr;d=data;@(posedge clk);if(!reset_n)begin expected_q=0;expected_saved=0;end else if(!power)expected_q=0;else if(rs)expected_q=expected_saved;else if(sv)expected_saved=expected_q;else if(wr)expected_q=data;#1;check(q===expected_q);check(saved===expected_saved);end endtask
initial begin tick(0,0,0,0,0,0);for(i=1;i<12;i=i+1)begin tick(1,1,0,0,1,i*17);tick(1,1,1,0,1,8'hff);tick(1,0,1,1,1,8'hee);tick(1,0,0,0,0,0);tick(1,1,0,0,0,0);tick(1,1,1,1,1,8'hff);tick(1,1,0,0,0,0);end for(i=0;i<32;i=i+1)tick(1,i[3],i[2],i[1],i[0],i*7);tick(0,1,1,1,1,255);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'lp-power-sequencer', order: 33, track: 'low-power', difficulty: 'advanced', minutes: 45, points: 270,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Power Gating：先排空、保存、隔離，再斷電', en: 'Power gating: drain, save, isolate, power off' },
    description: { zh: '以 always-on FSM 管理加速器睡眠與喚醒，避免資料還在飛就關電，或把斷電域的未知值送到 CPU。實作控制順序及輸出 isolation clamp。', en: 'Use an always-on FSM to sleep/wake an accelerator without dropping in-flight work or exposing powered-off unknown values to the CPU. Implement sequencing and an output isolation clamp.' },
    specs: [
      { zh: '固定 Moore 順序：RUN→DRAIN（等 idle）→SAVE（一拍）→ISOLATE（一拍）→OFF（等 wake_req）→RAMP（等 power_good）→RESTORE（一拍）→RELEASE（一拍）→RUN。sleep_req 只在 RUN 接受；一旦接受不取消，wake_req 保持到 OFF 接受。', en: 'Fixed Moore sequence: RUN→DRAIN(wait idle)→SAVE(1 cycle)→ISOLATE(1)→OFF(wait wake_req)→RAMP(wait power_good)→RESTORE(1)→RELEASE(1)→RUN. Accept sleep_req only in RUN, with no cancellation; hold wake_req until accepted in OFF.' },
      { zh: 'accept=1 僅 RUN；power_en=0 僅 OFF；clk_en=0 僅 ISOLATE/OFF/RAMP；iso_en=0 僅 RUN/DRAIN/SAVE；save=1 僅 SAVE，restore=1 僅 RESTORE。', en: 'accept=1 only in RUN; power_en=0 only in OFF; clk_en=0 only in ISOLATE/OFF/RAMP; iso_en=0 only in RUN/DRAIN/SAVE; save and restore assert only in their named states.' },
      { zh: 'iso_en=1 時 out_valid 與 out_data 一律 clamp 0（即使 domain 送 X）；否則直接傳遞 domain_valid、domain_data。clk_en 是送往 ICG 的控制，不是直接以 AND 產生 clock。', en: 'Clamp out_valid and out_data to zero when iso_en=1, even if domain inputs are X; otherwise pass them through. clk_en controls an ICG; do not generate a raw AND-gated clock.' },
      { zh: '同步低有效 reset 進 OFF；初次上電也遵循 RAMP→RESTORE→RELEASE。假設 retention reset image 為 0，save/restore 在各自一拍完成；RELEASE 多留一拍 isolation。', en: 'Synchronous active-low reset enters OFF. Initial boot also follows RAMP→RESTORE→RELEASE; assume a zero reset retention image, one-cycle save/restore, and one extra isolated RELEASE cycle.' },
      { zh: '所有輸入已同步至 always-on clk；idle 代表沒有 outstanding transaction。power_good 穩定後在 RUN 不會突然消失。真實產品須另做 CDC、reset、UPF isolation/retention、供電穩定時間與故障處理，這不是通用 signoff 序列。', en: 'All inputs are already synchronized to the always-on clock. idle means no outstanding transactions; power_good remains stable in RUN. Real products also need CDC, reset, UPF isolation/retention, rail settling and fault handling; this is not a universal signoff sequence.' },
    ],
    testGroups: [{ zh: '等待 outstanding 清空', en: 'Wait for outstanding work to drain' }, { zh: 'Save／isolation／power 順序', en: 'Save/isolation/power order' }, { zh: 'Power-good 等待、X clamp、reset', en: 'Power-good wait, X clamp and reset' }],
    hints: [
      { zh: 'sleep request 不等於可以立刻斷電：先禁止新工作，等 idle 才保存。', en: 'A sleep request is not permission to cut power immediately: stop new work and wait for idle.' },
      { zh: '將狀態更新與輸出 decode 分開；SAVE 仍有 clock，ISOLATE 先隔離再讓下一拍進 OFF。', en: 'Separate state transitions and output decode. Keep the clock in SAVE, then isolate before entering OFF.' },
      { zh: '上電先開 power，再等 power_good，保持 isolation 做 restore，隔一拍後才恢復 accept。clamp 用 iso_en mux，不能直接判斷 domain_valid。', en: 'Enable power, wait for power_good, restore under isolation, wait a release cycle, then accept work. Clamp with iso_en rather than trusting domain_valid.' },
    ],
    starter: `module power_sequencer(input wire clk,rst_n,sleep_req,idle,wake_req,power_good,domain_valid,input wire [7:0] domain_data,output reg accept,power_en,clk_en,iso_en,save,restore,output wire out_valid,output wire [7:0] out_data);
  // TODO: always-on FSM and isolation mux
endmodule`,
    testbench: `module tb;reg clk=0,rst_n=0,sl=0,id=0,wk=0,pg=0,dv=0;reg[7:0]dd=0;wire ac,pe,ce,iso,sv,rs,ov;wire[7:0]od;integer expected_state=4,i,j;reg[5:0]expected_control;reg expected_valid;reg[7:0]expected_data;power_sequencer dut(clk,rst_n,sl,id,wk,pg,dv,dd,ac,pe,ce,iso,sv,rs,ov,od);always #5 clk=~clk;${pass}
task tick;input reset_n,sleep,idle_in,wake,power_ok;begin @(negedge clk);rst_n=reset_n;sl=sleep;id=idle_in;wk=wake;pg=power_ok;@(posedge clk);
if(!reset_n)expected_state=4;else case(expected_state)0:if(sleep)expected_state=1;1:if(idle_in)expected_state=2;2:expected_state=3;3:expected_state=4;4:if(wake)expected_state=5;5:if(power_ok)expected_state=6;6:expected_state=7;7:expected_state=0;endcase
case(expected_state)0:expected_control=6'b111000;1:expected_control=6'b011000;2:expected_control=6'b011010;3:expected_control=6'b010100;4:expected_control=6'b000100;5:expected_control=6'b010100;6:expected_control=6'b011101;7:expected_control=6'b011100;endcase
#1;check({ac,pe,ce,iso,sv,rs}===expected_control);dv=1;dd=8'ha5;#1;expected_valid=!expected_control[2];expected_data=expected_control[2]?0:8'ha5;check(ov===expected_valid&&od===expected_data);dv=0;dd=8'h3c;#1;check(ov===0);check(od===(expected_control[2]?8'h00:8'h3c));dv=1'bx;dd=8'hxx;#1;if(expected_control[2])check(ov===0&&od===0);end endtask
initial begin tick(0,0,0,0,0);tick(1,0,0,0,0);tick(1,0,0,1,0);repeat(3)tick(1,0,0,0,0);tick(1,0,0,0,1);tick(1,0,0,0,1);tick(1,0,0,0,1);
for(i=0;i<4;i=i+1)begin tick(1,0,0,0,1);tick(1,1,0,0,1);for(j=0;j<=i;j=j+1)tick(1,0,0,1,1);tick(1,0,1,0,1);tick(1,0,1,0,1);tick(1,0,1,0,0);repeat(2)tick(1,0,1,0,0);tick(1,0,1,1,0);for(j=0;j<=i;j=j+1)tick(1,0,1,0,0);tick(1,0,1,0,1);tick(1,0,1,0,1);tick(1,0,1,0,1);end
tick(1,1,0,0,1);tick(0,1,1,1,1);tick(1,0,0,0,0);$display("@@PASS@@");$finish;end endmodule`,
  }
);

export const difficultyLabel: Record<Challenge['difficulty'], Localized> = {
  beginner: { zh: '入門', en: 'Beginner' },
  intermediate: { zh: '中階', en: 'Intermediate' },
  advanced: { zh: '進階', en: 'Advanced' },
};

export const kindLabel: Record<Challenge['kind'], Localized> = {
  build: { zh: '實作', en: 'Build' },
  debug: { zh: 'Debug', en: 'Debug' },
  constraint: { zh: '約束', en: 'Constraint' },
  optimize: { zh: '最佳化', en: 'Optimize' },
};

export function localize(value: Localized, locale: Locale) {
  return value[locale];
}
