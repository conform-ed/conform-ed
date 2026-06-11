/**
 * The PCI Module Registry: PCI v1 modules are AMD (`define([deps], factory)`), so the
 * registry provides a minimal AMD surface — source evaluation with a scoped `define`,
 * dependency resolution among registered modules, the `qtiCustomInteractionContext`
 * bridge (`register` keyed by typeIdentifier), and URL loading with primary → fallback
 * candidates. PCI is a trust boundary: evaluating a module executes item-supplied
 * code, which is why PCI support is opt-in and never part of `qtiCoreInteractions`.
 */

/** The configuration handed to `getInstance` (IMS PCI v1). */
export interface PciConfiguration {
  readonly properties: Readonly<Record<string, string>>;
  readonly responseIdentifier?: string;
  /** The bound response variable's current value in PCI JSON form. */
  readonly boundTo?: Readonly<Record<string, unknown>>;
  readonly status?: string;
  readonly onready?: (instance: PciInstance, state?: string) => void;
  readonly ondone?: (instance: PciInstance, response: unknown, state?: string, status?: string) => void;
}

export interface PciInstance {
  readonly typeIdentifier?: string;
  getResponse(): unknown;
  getState?(): string;
  /** Engine-invoked before the instance is unloaded (cleanup hook). */
  oncompleted?(): void;
}

export interface PciModule {
  readonly typeIdentifier?: string;
  getInstance(dom: Element, configuration: PciConfiguration, state: string | undefined): PciInstance | undefined;
}

export interface PciModuleRegistryOptions {
  /** Base for relative module paths (typically the item package root URL). */
  readonly baseUrl?: string;
  /** Module id → path overrides (a parsed `module_resolution.js` paths map). */
  readonly paths?: Readonly<Record<string, string>>;
  /** Source fetcher for URL loading; defaults to global fetch. */
  readonly fetchText?: (url: string) => Promise<string>;
}

export interface PciModuleRegistry {
  /** Evaluate AMD source text; its `define` registers under the given module id. */
  readonly evaluate: (source: string, context: { readonly id: string }) => void;
  /** Register a prebuilt module directly (bundled PCIs, tests). */
  readonly registerModule: (id: string, module: PciModule) => void;
  /** Resolve by module id or by PCI typeIdentifier; undefined when unknown. */
  readonly resolve: (id: string) => PciModule | undefined;
  /**
   * Load a module from candidate paths in order (primary → fallback), falling back to
   * the registry's `paths` map when no candidates are given.
   */
  readonly load: (id: string, candidates: readonly string[]) => Promise<PciModule>;
}

interface AmdDefinition {
  readonly dependencies: readonly string[];
  readonly factory: (...resolved: unknown[]) => unknown;
}

function defaultFetchText(url: string): Promise<string> {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.text();
  });
}

export function createPciModuleRegistry(options: PciModuleRegistryOptions = {}): PciModuleRegistry {
  const fetchText = options.fetchText ?? defaultFetchText;
  const definitions = new Map<string, AmdDefinition>();
  const resolved = new Map<string, unknown>();
  const byTypeIdentifier = new Map<string, PciModule>();

  /** Modules registered through qtiCustomInteractionContext.register during a resolve. */
  let contextRegistrations: PciModule[] = [];

  const qtiCustomInteractionContext = {
    register(module: PciModule): void {
      contextRegistrations.push(module);

      if (module.typeIdentifier !== undefined) {
        byTypeIdentifier.set(module.typeIdentifier, module);
      }
    },
  };

  function resolveDependency(id: string, dependedOnBy: string, resolving: Set<string>): unknown {
    if (id === "qtiCustomInteractionContext") {
      return qtiCustomInteractionContext;
    }

    if (resolved.has(id)) {
      return resolved.get(id);
    }

    const definition = definitions.get(id);

    if (!definition) {
      throw new Error(`PCI module "${dependedOnBy}" depends on "${id}", which is not registered.`);
    }

    return instantiate(id, definition, resolving);
  }

  function instantiate(id: string, definition: AmdDefinition, resolving: Set<string>): unknown {
    if (resolving.has(id)) {
      throw new Error(`Circular PCI module dependency involving "${id}".`);
    }

    resolving.add(id);

    const dependencies = definition.dependencies.map((dependency) => resolveDependency(dependency, id, resolving));
    const beforeCount = contextRegistrations.length;
    const value = definition.factory(...dependencies);
    // A module that only ctx.register()s (no return value) still resolves to the
    // registered module — the corpus modules do both.
    const registered = contextRegistrations.length > beforeCount ? contextRegistrations.at(-1) : undefined;
    const moduleValue = value ?? registered;

    resolving.delete(id);
    resolved.set(id, moduleValue);

    const candidate = moduleValue as PciModule | undefined;

    if (candidate?.typeIdentifier !== undefined && typeof candidate.getInstance === "function") {
      byTypeIdentifier.set(candidate.typeIdentifier, candidate);
    }

    return moduleValue;
  }

  function evaluate(source: string, context: { readonly id: string }): void {
    const define = (...args: unknown[]): void => {
      // AMD forms: define(factory) | define(deps, factory) | define(id, deps, factory).
      const id = typeof args[0] === "string" ? (args.shift() as string) : context.id;
      const dependencies = Array.isArray(args[0]) ? (args.shift() as string[]) : [];
      const factoryArg = args[0];
      const factory =
        typeof factoryArg === "function" ? (factoryArg as AmdDefinition["factory"]) : (): unknown => factoryArg;

      definitions.set(id, { dependencies, factory });
    };

    (define as { amd?: object }).amd = {};

    // Scoped evaluation: the module sees our `define`, nothing else is injected.
    // Executing PCI source IS the feature — the documented trust boundary consumers
    // accept by opting into PCI (this registry is never part of qtiCoreInteractions).
    // oxlint-disable-next-line typescript/no-implied-eval
    new Function("define", `"use strict";\n${source}`)(define);
  }

  function resolve(id: string): PciModule | undefined {
    const fromType = byTypeIdentifier.get(id);

    if (fromType) {
      return fromType;
    }

    if (!resolved.has(id)) {
      const definition = definitions.get(id);

      if (!definition) {
        // Possibly a typeIdentifier lookup: typeIdentifiers only become known when a
        // factory runs (ctx.register), so instantiate pending definitions best-effort
        // and re-check. Broken pending modules fail on their own by-id resolution.
        for (const [pendingId, pending] of definitions) {
          if (!resolved.has(pendingId)) {
            try {
              instantiate(pendingId, pending, new Set());
            } catch {
              // surfaced when the broken module itself is resolved or loaded
            }
          }
        }

        return byTypeIdentifier.get(id);
      }

      instantiate(id, definition, new Set());
    }

    const value = resolved.get(id) as PciModule | undefined;

    return value && typeof value.getInstance === "function" ? value : undefined;
  }

  function toUrl(path: string): string {
    const withExtension = /\.[a-z]+$/iu.test(path) ? path : `${path}.js`;

    return options.baseUrl ? new URL(withExtension, options.baseUrl).toString() : withExtension;
  }

  async function load(id: string, candidates: readonly string[]): Promise<PciModule> {
    const existing = resolve(id);

    if (existing) {
      return existing;
    }

    const pathsEntry = options.paths?.[id];
    const allCandidates = candidates.length > 0 ? candidates : pathsEntry !== undefined ? [pathsEntry] : [];
    const failures: string[] = [];

    for (const candidate of allCandidates) {
      try {
        evaluate(await fetchText(toUrl(candidate)), { id });

        const module = resolve(id);

        if (module) {
          return module;
        }

        failures.push(`${candidate}: evaluated but did not register a PCI module`);
      } catch (error) {
        failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`PCI module "${id}" could not be loaded. ${failures.join("; ") || "No candidate paths."}`);
  }

  return {
    evaluate,
    registerModule: (id, module) => {
      resolved.set(id, module);

      if (module.typeIdentifier !== undefined) {
        byTypeIdentifier.set(module.typeIdentifier, module);
      }
    },
    resolve,
    load,
  };
}
