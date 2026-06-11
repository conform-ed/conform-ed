/**
 * The QTI harness (ADR-0001): renders the sample items through the headless runtime
 * with the Reference Skin, with attempt controls and the live Capability Report. This
 * is the in-repo way to see and exercise interactions without any downstream product.
 */

import { useState } from "react";
import { createRoot } from "react-dom/client";

import { createQtiRuntime, qtiCoreInteractions, referenceSkin } from "@conform-ed/qti-react";

import { harnessItems } from "./items";

const runtime = createQtiRuntime({ interactions: qtiCoreInteractions, skin: referenceSkin });

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
    </footer>
  );
}

function App() {
  const [selectedId, setSelectedId] = useState(harnessItems[0]?.id ?? "");
  const selected = harnessItems.find((entry) => entry.id === selectedId) ?? harnessItems[0];

  if (!selected) {
    return <p>No sample items.</p>;
  }

  const report = runtime.canDeliver(selected.item);

  return (
    <main>
      <h1>qti-react harness</h1>
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
    </main>
  );
}

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(<App />);
}
