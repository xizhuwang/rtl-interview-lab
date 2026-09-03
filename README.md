# SoC RTL Lab

An original, bilingual (Traditional Chinese / English) hands-on practice site for SoC and digital IC interviews.

The current release contains 33 coding, debugging, constraint, and interactive challenges across RTL foundations, CDC/reset, timing closure, SoC interfaces, verification, PPA, DFT, and low power. The SoC track includes AXI4-Lite accelerator control, AXI4 burst transfer, and a generic 1RW SRAM-compiler wrapper. The CDC track includes a complete asynchronous FIFO.

## DFT and low-power practice

These seven original Verilog-2005 exercises each include a bilingual specification, three hints, role/rationale notes, self-checking simulation and VCD signals. They build on memory reliability, accelerator activity and SoC integration concepts:

| Track | Exercise | Main debug target |
| --- | --- | --- |
| DFT | Scan shift/capture | Serial direction, capture/shift priority, reset |
| DFT | SRAM MBIST | Four ascending phases: w0, r0, w1, r1; read latency and sticky failure |
| DFT | Spare-row remapping | Consistent read/write redirection and exclusive bank enables |
| Low power | Clock gate with test override | Low-level latch, full clock pulses, scan accessibility |
| Low power | Operand isolation | Hold multiplier operands during invalid cycles |
| Low power | Retention register | Keep saved state powered and define save/restore/write priority |
| Low power | Power sequencer and isolation | Drain work, save, isolate, power off, wait for power-good, restore |

The MBIST fixture injects one stuck-at bit (bit 2) at each of eight addresses, in both polarities. This is a destructive teaching test, **not** full March C-, ATPG/fault coverage, physical BISR, flash programming, or a yield measurement. The remapper assumes stable repair configuration and a combinational interface; a real synchronous SRAM needs bank-selection latency alignment.

The clock-gate exercise intentionally models a latch, not an accidental inferred latch. Real ASICs must use qualified ICG cells and check gating setup/hold, CTS/STA and DFT. FPGA clock-enable primitives are preferred over fabric-gated clocks. Retention and isolation are behavioral models only; they do not instantiate UPF supplies, retention cells or physical power switches. No power savings or signoff result is inferred from simulation or cell counts.

Public conceptual references (not copied exercise/test content): [OpenROAD DFT](https://openroad.readthedocs.io/en/latest/main/src/dft/README.html), [Yosys clockgate](https://yosyshq.readthedocs.io/projects/yosys/en/0.46/cmd/clockgate.html), and [Accellera UPF tutorial](https://www.eda.org/resources/videos/upf-tutorial-2013). No proprietary interview transcript, vendor IP or foundry model is included.

## Judging model

- Verilog-2005 tasks compile and simulate locally in the browser using fixed-version, SHA-256 checked Icarus Verilog assets downloaded from the [VeriSim upstream distributor](https://github.com/senolgulgonul/verisim). Tool binaries are not redistributed in this repository or Pages artifact.
- Compilation/simulation runs in a disposable Web Worker with a 45-second total limit (including first download) and a simulation-time watchdog. Changing tasks or editing code cancels in-flight jobs.
- No local compiler or EDA installation is required. Yosys WebAssembly is downloaded only when the user requests a generic-cell comparison and can then be browser-cached.
- Simulation results include a browser-rendered VCD waveform. Testbenches that expose `expected_*` signals overlay the golden behavior with the DUT waveform.
- Vendor-specific APR command exercises are intentionally excluded. Timing topics such as hold repair use interactive, tool-neutral decision labs, with a clearly labeled OpenROAD / ICC2 / Innovus command quick reference for real-flow context.
- Verification exercises now cover a formal-equivalence miter, editable DIMACS CNF with an in-browser DPLL SAT solver, UVM scoreboard plumbing, and bit-true fixed-point checking.
- The UVM exercise is a structural code-review lab, not a substitute for compiling the full UVM library in VCS, Xcelium, or Questa.
- A simulation pass is not CDC signoff, static timing closure, or a proof of physical PPA. The miter exercise enumerates all 16 combinational input patterns; it does not run an industrial formal engine.
- Each challenge has three progressively revealed hints, inspired by coding-practice sites but implemented with original content and local-only progress.
- Progress and points use `localStorage`; the application has no code-submission backend. GitHub Pages shares browser storage across projects on the same origin. Do not enter confidential RTL or personal data. GitHub/jsDelivr may receive request metadata when serving the site/tools.

Because GitHub Pages is static, bundled tests are inspectable. A trustworthy global leaderboard or truly hidden tests would require a separate sandboxed backend.

## SRAM timing model

The SRAM integration challenge uses an original educational macro with a fictional foundry-style timing contract. It teaches active-low chip/write/byte enables, registered read behavior, and clock-to-Q interpretation without copying a TSMC memory compiler model, Liberty file, datasheet, or NDA material.

The provided model is viewable in the exercise. It models a 0.35 ns clock-to-Q delay but does **not** enforce setup/hold timing checks. No technology-mapped macro area is available.

The AXI labs use reduced, single-outstanding interfaces driven by testbench bus agents, not a bundled ARM core. Full protocol integration (response channels/attributes, strobes, IDs, errors, coherency and address-boundary rules) is outside this release.

## Area estimation

The site can run Yosys in the browser on demand and report generic cell types and counts for a quick, technology-independent comparison. PPA-focused tasks also synthesize a reference solution in the same browser session and show the user's relative delta under identical Yosys settings. This is not physical area in µm². Technology-mapped area, slack, routing congestion and DRC require Liberty, LEF/PDK, RC corners, SDC and a physical implementation flow. Those inputs are process- and organization-specific, so a zero-install public static site should teach the concepts instead of pretending to provide signoff results.

## Local development

```bash
pnpm install
pnpm dev
```

Build the GitHub Pages bundle with `pnpm build:github`.

Run `pnpm test` for the regression suite (the same Icarus WASM worker runs through a Node message-port shim). GitHub Pages deployment runs this suite before building. See [TESTING.md](TESTING.md) for coverage and manual acceptance checks.

## Independence and licensing

Original application source is GPL-2.0-or-later. The combined browser distribution selects **GPL-3.0-or-later** for compatibility with Apache-2.0 dependencies; individual third-party licenses remain intact. The complete GPLv3 text is included in `public/LICENSE-GPL-3.0.txt`. Do not describe the combined browser bundle as GPLv2-only.

The challenge descriptions, starter code and tests are independently written educational examples. No commercial PDK, licensed SRAM macro, proprietary standard text, company interview records or paper figures are included.

The application is GPL-2.0-or-later, without warranty. Third-party code retains its own licenses. See `public/THIRD_PARTY_NOTICES.txt`; the Pages build generates `OPEN_SOURCE_LICENSES.txt` for dependencies actually bundled in the browser. Upstream WASM-specific build sources have not been independently verified; Icarus binaries are therefore downloaded directly from the upstream distributor rather than republished here. This review is not a legal opinion or a guarantee of third-party compliance.
