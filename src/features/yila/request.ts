import { Data, Effect } from "effect";
import { NUS_SERVICE_UUID, YILA_NAME_PREFIX } from "./constants";
import { describeUnknownCause } from "./error";

export class RequestDeviceError extends Data.TaggedError("RequestDeviceError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class GetGrantedDevicesError extends Data.TaggedError(
  "GetGrantedDevicesError",
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export const request = Effect.tryPromise({
  try: () =>
    navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: YILA_NAME_PREFIX }],
      optionalServices: [NUS_SERVICE_UUID],
    }),
  catch: (cause) =>
    new RequestDeviceError({
      cause,
      message: describeUnknownCause(cause),
    }),
});

export const getGrantedDevices = Effect.tryPromise({
  try: () => navigator.bluetooth?.getDevices?.() ?? Promise.resolve([]),
  catch: (cause) =>
    new GetGrantedDevicesError({
      cause,
      message: describeUnknownCause(cause),
    }),
});

export const getGrantedDeviceById = (targetId: string) =>
  Effect.map(getGrantedDevices, (devices) =>
    devices.find((device) => device.id === targetId),
  );
