// @conform-ed/credential-verification — a pure, reusable Verifier/Displayer engine for
// W3C Verifiable Credentials and their 1EdTech profiles (Open Badges 3.0, CLR 2.0). Given
// a credential and a set of injected resolvers (key / status / JSON-LD document loader),
// it reports a structured, multi-axis verification verdict. All network and registry I/O
// is the host's responsibility, so the engine is deterministic and offline-testable.

export * from "./result";
export * from "./resolvers";
export * from "./validity";
export * from "./jose";
export * from "./verify";
