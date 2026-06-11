# @conform-ed/qti-harness

The in-repo browser harness for `@conform-ed/qti-react` (ADR-0001): sample items
rendered through the headless runtime with the Reference Skin, plus attempt controls
and the live Capability Report (ADR-0003). New interactions are developed and
manually exercised here — no downstream product required.

```sh
bun install
bun run dev   # hot-reloading server on http://localhost:4173
```

Add new sample items in `src/items.ts` (one per interaction kind, plus deliberately
unsupported/invalid samples to demonstrate the capability gate).
