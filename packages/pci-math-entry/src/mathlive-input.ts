/**
 * The MathLive input adapter: a <math-field> custom element inside the module-owned
 * container. Importing this file registers the element and pulls MathLive's full
 * bundle — browser-only and heavy by design; consumers reach it through the ./module
 * subpath via lazy import() (ADR-0007: descriptors eager, implementations lazy).
 */

import { MathfieldElement } from "mathlive";

// MathLive's documented bundler setup: the fonts ship through this stylesheet, and
// without it the runtime probes a fonts/ directory relative to the bundled module
// URL, which does not exist under bundlers (vite serves index.html fallbacks).
import "mathlive/fonts.css";

import type { MathInputFactory } from "./module";

export const mathLiveInput: MathInputFactory = (container, options) => {
  const field = new MathfieldElement();

  field.value = options.initialLatex;

  if (options.disabled === true) {
    field.readOnly = true;
  }

  container.appendChild(field);

  return {
    getValue: () => field.value,
    setValue: (latex) => {
      field.value = latex;
    },
    destroy: () => {
      field.remove();
    },
  };
};
