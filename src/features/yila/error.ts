import { Cause } from "effect";

export const describeUnknownCause = (cause: unknown): string => {
  if (Cause.isCause(cause)) {
    return Cause.pretty(cause, { renderErrorCause: true });
  }

  if (cause instanceof Error) {
    if (typeof cause.stack === "string" && cause.stack.length > 0) {
      return cause.stack;
    }

    if (cause.message.length > 0) {
      return `${cause.name}: ${cause.message}`;
    }

    return cause.name;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    const json = JSON.stringify(cause, null, 2);
    if (json !== undefined) {
      return json;
    }
  } catch {
    return String(cause);
  }

  return String(cause);
};
