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

export const socAcceleratorChallenges: Challenge[] = [
  {
    id: 'soc-stream-register-slice', order: 43, track: 'soc', difficulty: 'intermediate', minutes: 30, points: 190,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Ready／Valid Register Slice', en: 'Ready/valid register slice' },
    description: { zh: '建立一格 elastic buffer，切開長資料路徑，同時在下游 back-pressure 時保住 valid 與 data。這是 AXI-Stream、DMA 與加速器 pipeline 的基本積木。', en: 'Build a one-entry elastic buffer that breaks a long data path while preserving valid and data under downstream back-pressure.' },
    specs: [
      { zh: '當 buffer 為空，或本拍資料會被下游接受時，s_ready=1。', en: 'Assert s_ready when the buffer is empty or its current item will be consumed.' },
      { zh: 'm_valid=1 且 m_ready=0 時，m_valid 與 m_data 必須保持不變。', en: 'Hold m_valid and m_data while m_valid=1 and m_ready=0.' },
      { zh: '必須支援同一拍輸出舊資料並接收新資料，不可產生 bubble。', en: 'Support consuming the old item and accepting a new item in the same cycle without a bubble.' },
    ],
    testGroups: [{ zh: 'Back-pressure 資料保持', en: 'Back-pressure stability' }, { zh: '同拍 consume/refill', en: 'Same-cycle consume/refill' }, { zh: 'Reset 與連續傳輸', en: 'Reset and continuous traffic' }],
    hints: [
      { zh: '核心條件是 s_ready = !m_valid || m_ready。', en: 'The key equation is s_ready = !m_valid || m_ready.' },
      { zh: '只有 s_ready=1 時才能更新 output register。', en: 'Update the output register only when s_ready is high.' },
      { zh: '更新時令 m_valid<=s_valid；只有 s_valid=1 才需要鎖住 s_data。', en: 'When updating, assign m_valid<=s_valid and capture s_data only when it is valid.' },
    ],
    starter: `module stream_register_slice(
  input wire clk,
  input wire rst_n,
  input wire s_valid,
  output wire s_ready,
  input wire [31:0] s_data,
  output reg m_valid,
  input wire m_ready,
  output reg [31:0] m_data
);
  // TODO: one-entry elastic buffer
endmodule`,
    referenceSolution: `module stream_register_slice(
  input wire clk,input wire rst_n,input wire s_valid,output wire s_ready,input wire [31:0] s_data,
  output reg m_valid,input wire m_ready,output reg [31:0] m_data
);
  assign s_ready = !m_valid || m_ready;
  always @(posedge clk) begin
    if(!rst_n) begin m_valid<=0; m_data<=0; end
    else if(s_ready) begin m_valid<=s_valid; if(s_valid) m_data<=s_data; end
  end
endmodule`,
    testbench: `module tb;
reg clk=0,rst_n=0,s_valid=0,m_ready=0;reg[31:0]s_data=0;wire s_ready,m_valid;wire[31:0]m_data;
stream_register_slice dut(clk,rst_n,s_valid,s_ready,s_data,m_valid,m_ready,m_data);
always #5 clk=~clk;${pass}
initial begin
  repeat(2)@(negedge clk);rst_n=1;
  check(s_ready);s_valid=1;s_data=32'h11112222;@(posedge clk);#1;check(m_valid&&m_data==32'h11112222);
  check(!s_ready);@(negedge clk);s_data=32'hdeadbeef;repeat(2)begin @(posedge clk);#1;check(m_valid&&m_data==32'h11112222);end
  @(negedge clk);m_ready=1;s_data=32'h33334444;@(posedge clk);#1;check(m_valid&&m_data==32'h33334444);
  @(negedge clk);s_valid=0;@(posedge clk);#1;check(!m_valid&&s_ready);
  @(negedge clk);rst_n=0;@(posedge clk);#1;check(!m_valid);$display("@@PASS@@");$finish;
end endmodule`,
  },
  {
    id: 'soc-w1c-interrupt-status', order: 44, track: 'soc', difficulty: 'intermediate', minutes: 25, points: 170,
    kind: 'debug', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'W1C 狀態與中斷', en: 'Write-one-to-clear status and interrupt' },
    description: { zh: '修正軟硬體共享的 sticky status register。硬體事件要被保存到軟體看見，軟體寫 1 清除；同拍 set 與 clear 時必須讓新事件保留下來。', en: 'Repair a sticky hardware/software status register. Hardware events remain visible until software writes one to clear them; a simultaneous new event must not be lost.' },
    specs: [
      { zh: 'status[0]=done、status[1]=error；硬體事件會 set 對應 bit。', en: 'status[0] is done and status[1] is error; hardware events set their bits.' },
      { zh: 'sw_write 時，sw_wdata 中為 1 的 bit 清除，寫 0 不影響。', en: 'On sw_write, ones in sw_wdata clear the matching bits; zeros have no effect.' },
      { zh: '同一 bit 同拍收到硬體事件與軟體 clear 時，set 優先；irq=|status。', en: 'If the same bit is set and cleared in one cycle, set wins; irq is the reduction OR of status.' },
    ],
    testGroups: [{ zh: 'Sticky event', en: 'Sticky event' }, { zh: '逐 bit W1C', en: 'Per-bit W1C' }, { zh: 'Set-over-clear 與 IRQ', en: 'Set-over-clear and IRQ' }],
    hints: [
      { zh: '先算 cleared = status & ~(sw_write ? sw_wdata : 0)。', en: 'First compute cleared = status & ~(sw_write ? sw_wdata : 0).' },
      { zh: '再把硬體事件 OR 回去，即可自然形成 set priority。', en: 'Then OR hardware events back in to give set priority.' },
      { zh: 'irq 是 status 的組合輸出，不需要另一個 state bit。', en: 'irq is a combinational reduction of status and needs no extra state.' },
    ],
    starter: `module accelerator_status(
  input wire clk,input wire rst_n,
  input wire hw_done,input wire hw_error,
  input wire sw_write,input wire [1:0] sw_wdata,
  output reg [1:0] status,output wire irq
);
  assign irq = |status;
  always @(posedge clk) begin
    if(!rst_n) status <= 2'b00;
    else if(sw_write) status <= 2'b00; // BUG: clears too much and can lose a new event
    else status <= status | {hw_error,hw_done};
  end
endmodule`,
    referenceSolution: `module accelerator_status(
  input wire clk,input wire rst_n,input wire hw_done,input wire hw_error,
  input wire sw_write,input wire [1:0] sw_wdata,output reg [1:0] status,output wire irq
);
  assign irq=|status;
  always @(posedge clk)
    if(!rst_n) status<=0;
    else status<=(status&~(sw_write?sw_wdata:2'b00))|{hw_error,hw_done};
endmodule`,
    testbench: `module tb;
reg clk=0,rst_n=0,done=0,err=0,we=0;reg[1:0]wd=0;wire[1:0]status;wire irq;
accelerator_status dut(clk,rst_n,done,err,we,wd,status,irq);always #5 clk=~clk;${pass}
task step;begin @(posedge clk);#1;end endtask
initial begin step;check(status===0&&!irq);rst_n=1;done=1;step;done=0;step;check(status==1&&irq);
err=1;step;err=0;we=1;wd=1;step;we=0;wd=0;check(status==2&&irq);
we=1;wd=2;err=1;step;we=0;err=0;wd=0;check(status==2&&irq);
we=1;wd=2;step;we=0;wd=0;check(status==0&&!irq);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-dma-address-generator', order: 45, track: 'soc', difficulty: 'advanced', minutes: 40, points: 250,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'DMA Strided Address Generator', en: 'DMA strided address generator' },
    description: { zh: '建立可被 back-pressure 暫停的 DMA 位址產生器。它能表達連續 tensor、帶 padding 的 row stride，並可接到 AXI read request 前端。', en: 'Build a back-pressure-safe DMA address generator for contiguous tensors or padded rows before an AXI read requester.' },
    specs: [
      { zh: 'start 在 idle 時鎖住 base、count、stride；輸出 count 個位址。', en: 'When idle, start captures base, count, and stride and emits count addresses.' },
      { zh: 'addr_valid=1 且 addr_ready=0 時，addr 與 last 必須保持。', en: 'Hold addr and last while addr_valid=1 and addr_ready=0.' },
      { zh: '每次 handshake 後 addr+=stride；最後一筆 handshake 後 done pulse 一拍。count=0 直接 done。', en: 'After each handshake add stride; pulse done after the last transfer. A zero count completes immediately.' },
    ],
    testGroups: [{ zh: '連續與 stride 位址', en: 'Contiguous and strided addresses' }, { zh: 'Back-pressure 保持', en: 'Back-pressure stability' }, { zh: 'Last、done 與零長度', en: 'Last, done, and zero length' }],
    hints: [
      { zh: '用 remaining 記錄尚未 handshake 的數量。', en: 'Track the number of beats not yet handshaken in remaining.' },
      { zh: 'addr_valid 可以直接由 busy 產生；last=(remaining==1)。', en: 'addr_valid can be derived from busy; last is remaining==1.' },
      { zh: '只有 addr_valid && addr_ready 才能更新 addr／remaining。', en: 'Advance addr and remaining only on addr_valid && addr_ready.' },
    ],
    starter: `module dma_address_generator(
  input wire clk,input wire rst_n,input wire start,
  input wire [31:0] base_addr,input wire [7:0] count,input wire [15:0] stride,
  output wire addr_valid,input wire addr_ready,output reg [31:0] addr,output wire last,
  output reg busy,output reg done
);
  // TODO: back-pressure-safe address sequence
endmodule`,
    referenceSolution: `module dma_address_generator(
  input wire clk,input wire rst_n,input wire start,input wire [31:0] base_addr,
  input wire [7:0] count,input wire [15:0] stride,output wire addr_valid,input wire addr_ready,
  output reg [31:0] addr,output wire last,output reg busy,output reg done
);
  reg[7:0]remaining;
  assign addr_valid=busy;
  assign last=busy&&(remaining==1);
  always @(posedge clk) begin
    if(!rst_n)begin addr<=0;remaining<=0;busy<=0;done<=0;end
    else begin
      done<=0;
      if(!busy&&start)begin addr<=base_addr;remaining<=count;if(count==0)done<=1;else busy<=1;end
      else if(busy&&addr_ready)begin
        if(remaining==1)begin remaining<=0;busy<=0;done<=1;end
        else begin addr<=addr+stride;remaining<=remaining-1'b1;end
      end
    end
  end
endmodule`,
    testbench: `module tb;
reg clk=0,rst_n=0,start=0,ready=0;reg[31:0]base=0;reg[7:0]count=0;reg[15:0]stride=0;
wire valid,last,busy,done;wire[31:0]addr;integer seen=0;
dma_address_generator dut(clk,rst_n,start,base,count,stride,valid,ready,addr,last,busy,done);
always #5 clk=~clk;${pass}
initial begin repeat(2)@(negedge clk);rst_n=1;base=32'h1000;count=3;stride=16;start=1;@(negedge clk);start=0;
check(valid&&addr==32'h1000&&!last);repeat(2)begin @(posedge clk);#1;check(addr==32'h1000&&valid);end
@(negedge clk);ready=1;@(posedge clk);#1;check(addr==32'h1010);
@(posedge clk);#1;check(addr==32'h1020&&last);
@(posedge clk);#1;check(!busy&&done);@(posedge clk);#1;check(!done);
@(negedge clk);count=0;start=1;@(negedge clk);start=0;#1;check(!busy&&done);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-command-fifo', order: 46, track: 'soc', difficulty: 'advanced', minutes: 45, points: 270,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: '四筆加速器 Command Queue', en: 'Four-entry accelerator command queue' },
    description: { zh: '建立四深度 ready／valid command FIFO，讓軟體連續提交工作、硬體依序執行。這是多請求 runtime、doorbell 與硬體 scheduler 之間的邊界。', en: 'Build a four-entry ready/valid command FIFO so software can submit work while hardware executes commands in order.' },
    specs: [
      { zh: 'enq_ready 在未滿時為 1；deq_valid 在非空時為 1，deq_data 指向 queue head。', en: 'enq_ready is high when not full; deq_valid is high when not empty and deq_data exposes the head.' },
      { zh: '只有 valid&&ready 才能推進對應 pointer；資料順序不可改變。', en: 'Advance a pointer only on its valid/ready handshake and preserve ordering.' },
      { zh: '同拍 enqueue 與 dequeue 時 count 不變；滿時拒絕 enqueue、空時拒絕 dequeue。', en: 'On simultaneous enqueue/dequeue, keep count unchanged; reject enqueue when full and dequeue when empty.' },
    ],
    testGroups: [{ zh: 'FIFO 順序與滿／空', en: 'FIFO order and full/empty' }, { zh: 'Back-pressure', en: 'Back-pressure' }, { zh: '同拍 push/pop', en: 'Simultaneous push/pop' }],
    hints: [
      { zh: '用 2-bit write/read pointer 和 3-bit count。', en: 'Use two-bit read/write pointers and a three-bit count.' },
      { zh: 'push=enq_valid&&enq_ready；pop=deq_valid&&deq_ready。', en: 'Define push and pop from their valid/ready handshakes.' },
      { zh: 'case({push,pop})：10 加一、01 減一、其他保持。', en: 'Use case({push,pop}): increment for 10, decrement for 01, otherwise hold.' },
    ],
    starter: `module command_fifo4(
  input wire clk,input wire rst_n,
  input wire enq_valid,output wire enq_ready,input wire [63:0] enq_data,
  output wire deq_valid,input wire deq_ready,output wire [63:0] deq_data,
  output wire [2:0] level
);
  // TODO: four-entry command FIFO
endmodule`,
    referenceSolution: `module command_fifo4(
  input wire clk,input wire rst_n,input wire enq_valid,output wire enq_ready,input wire [63:0] enq_data,
  output wire deq_valid,input wire deq_ready,output wire [63:0] deq_data,output wire [2:0] level
);
  reg[63:0]mem[0:3];reg[1:0]wptr,rptr;reg[2:0]count;
  wire push=enq_valid&&enq_ready;wire pop=deq_valid&&deq_ready;
  assign enq_ready=count<4;assign deq_valid=count!=0;assign deq_data=mem[rptr];assign level=count;
  always @(posedge clk)begin
    if(!rst_n)begin wptr<=0;rptr<=0;count<=0;end
    else begin
      if(push)begin mem[wptr]<=enq_data;wptr<=wptr+1'b1;end
      if(pop)rptr<=rptr+1'b1;
      case({push,pop})2'b10:count<=count+1'b1;2'b01:count<=count-1'b1;default:count<=count;endcase
    end
  end
endmodule`,
    testbench: `module tb;
reg clk=0,rst_n=0,ev=0,dr=0;reg[63:0]ed=0;wire er,dv;wire[63:0]dd;wire[2:0]level;
command_fifo4 dut(clk,rst_n,ev,er,ed,dv,dr,dd,level);always #5 clk=~clk;${pass}
task push;input[63:0]v;begin @(negedge clk);ev=1;ed=v;@(posedge clk);#1;ev=0;end endtask
task pop;input[63:0]v;begin check(dv&&dd==v);@(negedge clk);dr=1;@(posedge clk);#1;dr=0;end endtask
initial begin repeat(2)@(posedge clk);rst_n=1;push(11);push(22);push(33);push(44);check(level==4&&!er);
@(negedge clk);ev=1;ed=55;@(posedge clk);#1;ev=0;check(level==4&&dd==11);
pop(11);check(level==3);@(negedge clk);ev=1;ed=55;dr=1;check(dd==22);@(posedge clk);#1;ev=0;dr=0;check(level==3);
pop(33);pop(44);pop(55);check(level==0&&!dv);$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-mixed-precision-dot', order: 47, track: 'soc', difficulty: 'intermediate', minutes: 35, points: 230,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'INT8／INT4 Signed Dot Product', en: 'INT8/INT4 signed dot product' },
    description: { zh: '實作可切換精度的 signed dot-product。INT8 模式運算兩個 lane，INT4 模式運算四個 lane，練習 packed data、符號延伸與混合精度 datapath。', en: 'Build a signed mixed-precision dot product: two INT8 lanes or four INT4 lanes, with correct packing and sign extension.' },
    specs: [
      { zh: 'mode_int4=0：a[15:8]、a[7:0] 分別與 b 對應兩個 signed INT8 lane 相乘後相加。', en: 'With mode_int4=0, multiply and sum the two signed INT8 lanes.' },
      { zh: 'mode_int4=1：將 16-bit input 視為四個 signed INT4 lane，相乘後相加。', en: 'With mode_int4=1, treat each input as four signed INT4 lanes and sum their products.' },
      { zh: 'y 為 signed 20-bit，不可把負數 lane 當成 unsigned。', en: 'y is signed 20-bit; negative lanes must not be interpreted as unsigned.' },
    ],
    testGroups: [{ zh: 'INT8 正負數', en: 'Signed INT8' }, { zh: 'INT4 packed lanes', en: 'Packed INT4 lanes' }, { zh: '邊界與零', en: 'Boundaries and zero' }],
    hints: [
      { zh: '寫 s8、s4 function，把 lane 的 sign bit 再複製一位。', en: 'Create s8 and s4 functions that explicitly extend each lane sign.' },
      { zh: 'INT8 模式只取兩個 byte；INT4 模式取四個 nibble。', en: 'INT8 mode uses two bytes; INT4 mode uses four nibbles.' },
      { zh: '用 integer 暫存累加結果，再指定到 signed output。', en: 'Accumulate in an integer temporary before assigning the signed output.' },
    ],
    starter: `module mixed_precision_dot(
  input wire mode_int4,
  input wire [15:0] a,input wire [15:0] b,
  output reg signed [19:0] y
);
  // TODO: signed 2-lane INT8 or 4-lane INT4 dot product
endmodule`,
    referenceSolution: `module mixed_precision_dot(input wire mode_int4,input wire[15:0]a,input wire[15:0]b,output reg signed[19:0]y);
function signed[8:0]s8;input[7:0]v;begin s8={v[7],v};end endfunction
function signed[4:0]s4;input[3:0]v;begin s4={v[3],v};end endfunction
integer acc;
always @*begin
  if(mode_int4)acc=s4(a[3:0])*s4(b[3:0])+s4(a[7:4])*s4(b[7:4])+s4(a[11:8])*s4(b[11:8])+s4(a[15:12])*s4(b[15:12]);
  else acc=s8(a[7:0])*s8(b[7:0])+s8(a[15:8])*s8(b[15:8]);
  y=acc;
end
endmodule`,
    testbench: `module tb;reg mode=0;reg[15:0]a=0,b=0;wire signed[19:0]y;
mixed_precision_dot dut(mode,a,b,y);${pass}
initial begin a={8'h02,8'hfd};b={8'h04,8'h05};#1;check(y===-7);
a={8'h80,8'h7f};b={8'h01,8'h01};#1;check(y===-1);
mode=1;a=16'h1f28;b=16'h32f1;#1;check(y===-9);
a=16'h8888;b=16'h7777;#1;check(y===-224);a=0;b=16'hffff;#1;check(y===0);
$display("@@PASS@@");$finish;end endmodule`,
  },
  {
    id: 'soc-streaming-llm-tile', order: 48, track: 'soc', difficulty: 'advanced', minutes: 60, points: 360,
    kind: 'build', judge: 'simulation', language: 'Verilog-2005',
    title: { zh: 'Capstone：Streaming Mixed-Precision Tile', en: 'Capstone: streaming mixed-precision tile' },
    description: { zh: '整合 job control、ready／valid、混合精度 dot product、accumulator 與 output back-pressure。這是簡化的 LLM 加速 tile，不是假裝完成完整 Transformer。', en: 'Integrate job control, ready/valid flow, mixed-precision dot products, accumulation, and output back-pressure into a simplified LLM compute tile.' },
    specs: [
      { zh: 'idle 時以 start 鎖住 mode_int4 與 beats；beats>0 後 busy=1、s_ready=1。', en: 'While idle, start captures mode_int4 and beats; for beats>0, assert busy and s_ready.' },
      { zh: '每個 s_valid&&s_ready 將一組 packed a/b dot product 加入 accumulator；最後一組後產生 m_valid。', en: 'Each input handshake adds one packed dot product; the last beat produces m_valid.' },
      { zh: 'm_valid&& !m_ready 時結果保持；輸出 handshake 後清除 m_valid 並回到可接下一個 job。', en: 'Hold the result under output back-pressure; after the output handshake, accept the next job.' },
    ],
    testGroups: [{ zh: 'INT8／INT4 多拍累加', en: 'Multi-beat INT8/INT4 accumulation' }, { zh: 'Input 與 output back-pressure', en: 'Input and output back-pressure' }, { zh: 'Job 邊界與結果保持', en: 'Job boundaries and result stability' }],
    hints: [
      { zh: '先把上一題 dot product 改成內部 function／組合 wire。', en: 'Reuse the prior dot-product logic as an internal combinational value.' },
      { zh: '用 remaining 判斷最後一拍；最後一拍 result<=accumulator+dot。', en: 'Use remaining to identify the final beat and assign result<=accumulator+dot.' },
      { zh: '有未消費的 m_valid 時不可接受新 start 或新 input。', en: 'Do not accept a new start or input while an output remains unconsumed.' },
    ],
    starter: `module streaming_llm_tile(
  input wire clk,input wire rst_n,input wire start,input wire mode_int4,input wire [7:0] beats,
  input wire s_valid,output wire s_ready,input wire [15:0] a,input wire [15:0] b,
  output reg m_valid,input wire m_ready,output reg signed [31:0] result,output reg busy
);
  // TODO: job control + mixed-precision dot + accumulation + output back-pressure
endmodule`,
    referenceSolution: `module streaming_llm_tile(
  input wire clk,input wire rst_n,input wire start,input wire mode_int4,input wire[7:0]beats,
  input wire s_valid,output wire s_ready,input wire[15:0]a,input wire[15:0]b,output reg m_valid,input wire m_ready,
  output reg signed[31:0]result,output reg busy
);
function signed[8:0]s8;input[7:0]v;begin s8={v[7],v};end endfunction
function signed[4:0]s4;input[3:0]v;begin s4={v[3],v};end endfunction
reg mode_q;reg[7:0]remaining;reg signed[31:0]acc;integer dot;
assign s_ready=busy&&!m_valid;
always @*if(mode_q)dot=s4(a[3:0])*s4(b[3:0])+s4(a[7:4])*s4(b[7:4])+s4(a[11:8])*s4(b[11:8])+s4(a[15:12])*s4(b[15:12]);
else dot=s8(a[7:0])*s8(b[7:0])+s8(a[15:8])*s8(b[15:8]);
always @(posedge clk)begin
 if(!rst_n)begin m_valid<=0;result<=0;busy<=0;mode_q<=0;remaining<=0;acc<=0;end
 else begin
  if(m_valid&&m_ready)begin m_valid<=0;busy<=0;end
  if(!busy&&!m_valid&&start&&beats!=0)begin busy<=1;mode_q<=mode_int4;remaining<=beats;acc<=0;end
  else if(s_valid&&s_ready)begin
   if(remaining==1)begin result<=acc+dot;m_valid<=1;remaining<=0;end
   else begin acc<=acc+dot;remaining<=remaining-1'b1;end
  end
 end
end
endmodule`,
    testbench: `module tb;
reg clk=0,rst_n=0,start=0,mode=0,sv=0,mr=0;reg[7:0]beats=0;reg[15:0]a=0,b=0;
wire sr,mv,busy;wire signed[31:0]result;streaming_llm_tile dut(clk,rst_n,start,mode,beats,sv,sr,a,b,mv,mr,result,busy);
always #5 clk=~clk;${pass}
task launch;input md;input[7:0]n;begin @(negedge clk);mode=md;beats=n;start=1;@(negedge clk);start=0;end endtask
task beat;input[15:0]aa,bb;begin @(negedge clk);a=aa;b=bb;sv=1;while(!sr)@(negedge clk);@(posedge clk);#1;@(negedge clk);sv=0;end endtask
initial begin repeat(2)@(negedge clk);rst_n=1;launch(0,2);beat({8'd2,8'd3},{8'd4,8'd5});beat({8'hff,8'd2},{8'd3,8'd4});
check(mv&&result==28&&busy);repeat(2)begin @(posedge clk);#1;check(mv&&result==28);end
@(negedge clk);mr=1;@(posedge clk);#1;mr=0;check(!mv&&!busy);
launch(1,1);beat(16'h1111,16'h2222);check(mv&&result==8);$display("@@PASS@@");$finish;end endmodule`,
  },
];

