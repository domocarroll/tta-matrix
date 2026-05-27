// Convex's default (V8 isolate) runtime exposes web-standard globals
// (fetch, Response, crypto, AbortController, console, setTimeout) — those
// come from the `WebWorker` lib in tsconfig. It also provides a minimal
// `process.env` shim for reading deployment environment variables, which
// is not part of any standard lib, so it's declared here.
declare const process: {
  readonly env: Record<string, string | undefined>;
};
