# src/background/kernel/

The placement kernel. Chrome is reached only through the ports in `types.ts`; nothing here reads the `chrome` global, so every file runs under the behaviour tests in `../__tests__/`.

## Members
placement-kernel.ts: the only entry `handle(event) → PlacementResult`; owns the operation lifecycle (receipt → terminal result), run gating at receipt and before each Chrome call, the tabs the command created without an index (`command-unplaced`), and executes move / in-place create.
settings-gate.ts: settings readiness for the kernel — `loading` / `failed` / RunState from the shared `loadSettings` + `computeRunState`; a failed read is retried on the next event.
window-tracker.ts: per-window state machine and serial queue (rebuild within `PLACEMENT_BUDGET_MS`, generations, session record restore/persist) plus chain bookkeeping (`chainOf`, `joinChain`, `forget`, `recordActive`).
placement-decision.ts: pure decisions — anchor resolution, effective chain, target index, pinned-zone clamp; no I/O.
within.ts: races a Promise against the injected clock (ok / timeout / error).
types.ts: events, results, ports (`TabAdapter`, `SessionStore`, `Clock`, `DebugLogger`) and `PLACEMENT_BUDGET_MS`, the single budget from receipt to the Chrome call.

