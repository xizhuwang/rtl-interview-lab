# Release verification

## Automated regression

Run `pnpm test`. The suite downloads SHA-256-verified upstream Icarus assets to an ignored `.engine-cache`, then uses the same compiler and simulator as the site, with a Node message-port shim around the browser worker. Nothing from this cache is published.

The current run passes 121 assertions:

- 26 unique challenge IDs and bilingual titles/descriptions.
- 23 Verilog tasks: positive fixtures accepted, VCD produced, and starter verdicts checked.
- The width-optimization starter intentionally already passes functionally; synthesis can optimize unused width, so a rewrite need not reduce cells.
- Two languages of CNF checks, including valid XOR, missing clauses, malformed headers, overconstraint, UNSAT and oversized input.
- UVM structural fixture, unfinished code and comment-only answers.
- Scoreboard fault injection: returning constant zero cannot pass.
- X/Z/false checks fail, invalid Verilog fails, and a stalled simulation reaches the watchdog.

Async FIFO tests include filling, draining, rejected full writes, empty read attempts and a second pointer wrap. SRAM tests cover alternating byte masks, zero-byte writes, two addresses and read-valid alignment. Requantization checks cover all shift values and signed edge values.

Both the Sites build (`pnpm build`) and GitHub Pages build (`pnpm build:github`) must succeed before release. The Pages workflow runs the regression first.

## Browser acceptance — 2026-09-03

Verified in Chromium through the visible UI of the production Pages build:

- Incomplete pulse detector fails; correct solution passes and renders both DUT and expected waveforms.
- Three hints can be opened; the fourth click is disabled.
- English switching and language/code/completion persistence survive reload.
- Yosys width exercise: 38 user cells / 38 reference cells, delta 0. This is expected because unused bits are optimized away.
- The browser loader was tested with upstream hash checks and blob-module URL resolution.

## Additional manual acceptance checklist

These are not represented by the automated Node assertions:

1. Open the deployed site in a fresh desktop browser and on a narrow screen.
2. Switch Traditional Chinese / English, reload, and check language persistence.
3. Execute a blank/incorrect answer and a correct answer; inspect diagnostics and VCD.
4. Switch challenges or edit code during a run: the old result must not complete another task.
5. Exercise all three hint reveals, reset code, search/filter and local progress.
6. Open the read-only SRAM model. Compare its port map against the wrapper interface.
7. Run Yosys on both PPA exercises; confirm user/reference counts load and network failures show an error. Yosys downloads from an external CDN.
8. In the hold lab, compare all four repair choices. These numbers are illustrative, not a live APR report.

## Scope and limitations

- No physical metastability simulation, CDC structural signoff, real PDK, STA, APR or silicon area/power measurement.
- SRAM setup/hold numbers are fictional teaching assumptions. Only clock-to-Q delay is simulated; setup/hold violations are not detected.
- Miter exercise: exhaustive combinational simulation. CNF exercise: educational DPLL plus complete XOR truth-table checking.
- UVM: regex-based structural review only, not parsing/compiling/running a full UVM environment.
- AXI tasks: simplified signal subsets and a bus-agent CPU surrogate, not full AXI compliance or a licensed ARM core.
- Public test assets and local-only scores are not cheat-resistant. No global leaderboard or account sync.
- Browser acceptance above is a representative smoke test, not an exhaustive cross-browser or security audit. Node simulation regression alone does not establish end-to-end browser correctness.
