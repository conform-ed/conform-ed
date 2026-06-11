/**
 * The QTI harness (ADR-0001): renders the sample items through the headless runtime
 * with the Reference Skin, with attempt controls and the live Capability Report, plus
 * a whole-test mode driving the Test Session Store (ADR-0005) — seeded selection,
 * navigation, test outcome processing, and at-end feedback. This is the in-repo way
 * to see and exercise the stack without any downstream product.
 */

import { useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import {
  createPciSkin,
  createQtiRuntime,
  createTestController,
  createTestSessionStore,
  portableCustomInteraction,
  qtiCoreInteractions,
  referenceSkin,
} from "@conform-ed/qti-react";

import { harnessItems } from "./items";
import { harnessPciRegistry } from "./pci-module";
import { sampleTest, sampleTestItems } from "./sample-test";

// PCI opt-in: the descriptor plus a host skin over the harness's module registry.
const runtime = createQtiRuntime({
  interactions: [...qtiCoreInteractions, portableCustomInteraction],
  skin: { ...referenceSkin, portableCustomInteraction: createPciSkin({ registry: harnessPciRegistry }) },
});

function AttemptControls() {
  const attempt = runtime.useAttempt();

  return (
    <footer>
      <button type="button" onClick={() => attempt.submit()} disabled={attempt.submitted}>
        Submit
      </button>
      <button type="button" onClick={() => attempt.reset()}>
        Reset
      </button>
      {attempt.submitted ? (
        <dl data-testid="scores">
          {attempt.scores.map((score) => (
            <div key={score.identifier}>
              <dt>{score.identifier}</dt>
              <dd>
                {score.score} / {score.maxScore} {score.correct ? "✓" : "✗"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {attempt.submitted && Object.keys(attempt.outcomes).length > 0 ? (
        <dl data-testid="outcomes" aria-label="Item outcomes (RP interpreter)">
          {Object.entries(attempt.outcomes).map(([identifier, value]) => (
            <div key={identifier}>
              <dt>{identifier}</dt>
              <dd>{value === null ? "NULL" : Array.isArray(value) ? value.join(", ") : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}

function ItemPage() {
  const [selectedId, setSelectedId] = useState(harnessItems[0]?.id ?? "");
  const selected = harnessItems.find((entry) => entry.id === selectedId) ?? harnessItems[0];

  if (!selected) {
    return <p>No sample items.</p>;
  }

  const report = runtime.canDeliver(selected.item);

  return (
    <>
      <nav>
        <label>
          Item:{" "}
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {harnessItems.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
      </nav>

      <section aria-label="Capability report">
        <h2>canDeliver</h2>
        {report.deliverable ? (
          <p data-deliverable="true">Deliverable: every kind and element in this item is supported.</p>
        ) : (
          <ul data-deliverable="false">
            {report.issues.map((issue) => (
              <li key={`${issue.type}:${issue.name}:${issue.responseIdentifier ?? ""}`}>
                <code>{issue.type}</code> — {issue.name}
                {issue.responseIdentifier ? ` (${issue.responseIdentifier})` : null}
                {issue.detail ? `: ${issue.detail}` : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Item">
        <h2>{selected.title}</h2>
        {/* key remounts the renderer (fresh attempt store) when switching items */}
        <runtime.ItemRenderer key={selected.id} item={selected.item}>
          <AttemptControls />
        </runtime.ItemRenderer>
      </section>
    </>
  );
}

function TestPage() {
  const [seed, setSeed] = useState(42);
  const session = useMemo(() => {
    const controller = createTestController(sampleTest, { seed });

    return createTestSessionStore(controller, {
      seed,
      resolveItem: (ref) => sampleTestItems[ref.identifier] ?? null,
    });
  }, [seed]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { state, currentItem, currentItemView, visibleFeedbacks } = snapshot;
  const planItems = session.controller.plan.parts.flatMap((part) => part.items);

  return (
    <section aria-label="Test session">
      <p>
        <label>
          Seed (replay key — drives selection and item clones):{" "}
          <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} />
        </label>
      </p>

      <nav aria-label="Test navigation">
        {planItems.map((item) => {
          const isCurrent = item.key === state.currentItemKey;
          const attempted = state.attemptedItems.includes(item.key);

          return (
            <button
              key={item.key}
              type="button"
              data-status={isCurrent ? "current" : attempted ? "attempted" : "idle"}
              disabled={!isCurrent && !session.canMoveTo(item.key)}
              onClick={() => session.moveTo(item.key)}
            >
              {item.key}
              {attempted ? " ✓" : ""}
            </button>
          );
        })}
        <button type="button" onClick={() => session.next()} disabled={state.status === "ended"}>
          Next
        </button>
        <button type="button" onClick={() => session.end()} disabled={state.status === "ended"}>
          End test
        </button>
      </nav>

      {state.status === "in-progress" && currentItem && currentItemView ? (
        <section aria-label="Current item">
          <h2>{currentItem.key}</h2>
          <runtime.ItemRenderer
            key={`${seed}:${currentItem.key}`}
            item={currentItemView}
            store={session.itemStore(currentItem.key) ?? undefined}
          >
            <AttemptControls />
          </runtime.ItemRenderer>
        </section>
      ) : null}

      {state.status === "in-progress" && currentItem && !currentItemView ? (
        <p role="note">Item {currentItem.key} could not be resolved.</p>
      ) : null}

      {state.status === "ended" ? (
        <section aria-label="Test result">
          <h2>Test result</h2>
          <dl data-testid="test-outcomes">
            {Object.entries(state.testOutcomes).map(([identifier, value]) => (
              <div key={identifier}>
                <dt>{identifier}</dt>
                <dd>{value === null ? "NULL" : Array.isArray(value) ? value.join(", ") : String(value)}</dd>
              </div>
            ))}
          </dl>
          {visibleFeedbacks.map((feedback) => (
            <div key={feedback.identifier} data-qti-test-feedback={feedback.identifier}>
              <runtime.ContentRenderer nodes={feedback.content} outcomes={state.testOutcomes} />
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function App() {
  const [mode, setMode] = useState<"items" | "test">("items");

  return (
    <main>
      <h1>qti-react harness</h1>
      <nav aria-label="Mode">
        <button type="button" data-status={mode === "items" ? "current" : "idle"} onClick={() => setMode("items")}>
          Items
        </button>
        <button type="button" data-status={mode === "test" ? "current" : "idle"} onClick={() => setMode("test")}>
          Test
        </button>
      </nav>
      {mode === "items" ? <ItemPage /> : <TestPage />}
    </main>
  );
}

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(<App />);
}
