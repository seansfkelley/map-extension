export class AssertionError extends Error {}

export function assert(
  condition: unknown,
  message: string = 'Assertion failed',
  extra?: unknown,
): asserts condition {
  if (!condition) {
    if (extra != null) {
      console.error(message, extra);
    } else {
      console.error(message);
    }
    throw new AssertionError(message);
  }
}

export function assertNever(nope: never): never {
  throw new AssertionError(`expected to be unreachable, got ${nope}`);
}
