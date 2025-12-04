export function assert(condition: unknown, message?: string, extra?: unknown): asserts condition {
  if (!condition) {
    console.error(message ?? 'Assertion failed', extra);
    throw new Error(message ?? 'Assertion failed');
  }
}

export function assertNever(nope: never): never {
  throw new Error(`expected to be unreachable, got ${nope}`);
}
