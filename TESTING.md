# Release verification

## Automated regression

Run `pnpm test`. The suite downloads SHA-256-verified upstream Icarus assets to an ignored `.engine-cache`, then uses the same compiler and simulator as the site, with a Node message-port shim around the browser worker. Nothing from this cache is published.

The current run passes 211 assertions:

- 33 unique challenge IDs and bilingual titles/descriptions.
- Every Verilog starter is normalized to a multiline, one-port-per-line module header and the formatted code is compiled by the regression.
- Public exercise copy is checked for interview-source, company-name and personal-name leakage.
- 30 Verilog tasks: positive fixtures accepted, VCD produced, and starter verdicts checked.
- Three DFT and four low-power exercises, each with three bilingual hints, rationale, role mapping and Verilog-2005 simulation (not keyword grading).
- 22 compiling-but-incorrect DFT/low-power mutations rejected during simulation: scan order/control, stale MBIST read data, nonsticky errors, spare write mapping, raw gated clocks, blocked test override, late-low enables, invalid operand updates, retention loss and unsafe power sequencing.
- The width-optimization starter intentionally already passes functionally; synthesis can optimize unused width, so a rewrite need not reduce cells.
- Two languages of CNF checks, including valid XOR, missing clauses, malformed headers, overconstraint, UNSAT and oversized input.
- UVM structural fixture, unfinished code and comment-only answers.
- Scoreboard fault injection: returning constant zero cannot pass.
- X/Z/false checks fail, invalid Verilog fails, and a stalled simulation reaches the watchdog.

Async FIFO tests include filling, draining, rejected full writes, empty read attempts and a second pointer wrap. SRAM tests cover alternating byte masks, zero-byte writes, two addresses and read-valid alignment. Requantization checks cover all shift values and signed edge values.

For the public GitHub checkout, build with `pnpm build:github`; the Pages workflow runs the regression first. The separate original Sites checkout retains its private hosting configuration and is not the publication target for this release.

## DFT / low-power regression — 2026-09-04

- Scan: MSB-first serial load/unload, all eight positions, simultaneous functional/scan enable, hold and reset priority.
- MBIST: healthy memory; SA0 and SA1 at bit 2 of each address; 32-command ordering; compare on the cycle after a read; start while busy; a fresh run without reset clears a prior failure; reset aborts a run.
- Remapping: all 16 requested addresses × 16 bad-row settings × 8 request/write/repair combinations.
- ICG: low-phase enable changes, high-phase enable/test changes, test override, full pulse level and gated rising-edge count.
- Operand holding: changing idle input buses, consecutive valid cycles, bubbles, maximum unsigned product and reset.
- Retention: repeated save/off/on/restore; all powered/control combinations; concurrent save/write and restore/save/write; reset.
- Sequencing: variable drain and power-good delays, ignored early wake pulses outside OFF, save/isolate/off ordering, isolated X data/valid, delayed isolation release, reset during drain.
- Tests run through the same Icarus worker as the site. This release does not claim a fresh end-to-end browser acceptance run; the prior browser smoke test below is dated separately.

## Browser acceptance — 2026-09-03

Verified in Chromium through the visible UI of the production Pages build:

- Incomplete pulse detector fails; correct solution passes and renders both DUT and expected waveforms.
- Three hints can be opened; the fourth click is disabled.
- English switching and language/code/completion persistence survive reload.
- Yosys width exercise: 38 user cells / 38 reference cells, delta 0. This is expected because unused bits are optimized away.
- The browser loader was tested with upstream hash checks and blob-module URL resolution.
- Public GitHub Pages: invalid syntax fails at compilation; valid RTL passes and renders expected/DUT signals. CNF XOR succeeds; all four hold choices produce the intended verdict; live Yosys returns 38/38 cells.

## Additional manual acceptance checklist

These are not represented by the automated Node assertions:

1. Open the deployed site in a fresh desktop browser and on a narrow screen.
2. Switch Traditional Chinese / English, reload, and check language persistence.
3. Execute a blank/incorrect answer and a correct answer; inspect diagnostics and VCD.
4. Switch challenges or edit code during a run: the old result must not complete another task.
5. Exercise all three hint reveals, reset code, search/filter and local progress.
6. Open the read-only SRAM model. Confirm line numbers, syntax colors, multiline ports and horizontal scrolling remain readable; compare its port map against the wrapper interface.
7. Run Yosys on both PPA exercises; confirm user/reference counts load and network failures show an error. Yosys downloads from an external CDN.
8. In the hold lab, compare all four repair choices. These numbers are illustrative, not a live APR report.

## Scope and limitations

- No physical metastability simulation, CDC structural signoff, real PDK, STA, APR or silicon area/power measurement.
- No ATPG, full March algorithm, measured fault coverage, fuse/OTP programming, UPF power-aware simulation or mapped ICG/retention/isolation cell validation. Low-power state transitions are a specified educational protocol, not a universal chip power sequence.
- SRAM setup/hold numbers are fictional teaching assumptions. Only clock-to-Q delay is simulated; setup/hold violations are not detected.
- Miter exercise: exhaustive combinational simulation. CNF exercise: educational DPLL plus complete XOR truth-table checking.
- UVM: regex-based structural review only, not parsing/compiling/running a full UVM environment.
- AXI tasks: simplified signal subsets and a bus-agent CPU surrogate, not full AXI compliance or a licensed ARM core.
- Public test assets and local-only scores are not cheat-resistant. No global leaderboard or account sync.
- Browser acceptance above is a representative smoke test, not an exhaustive cross-browser or security audit. Node simulation regression alone does not establish end-to-end browser correctness.
