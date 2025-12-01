export function assert(condition: unknown, message?: string, extra?: unknown): asserts condition {
  if (!condition) {
    console.error(message ?? 'Assertion failed', extra);
    throw new Error(message ?? 'Assertion failed');
  }
}
