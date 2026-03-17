import { Data, Effect } from "effect";
import {
  NUS_RX_CHAR_UUID,
  NUS_SERVICE_UUID,
  NUS_TX_CHAR_UUID,
} from "./constants";
import { describeUnknownCause } from "./error";

export class ConnectGATTNotFoundError extends Data.TaggedError(
  "ConnectGATTNotFoundError",
)<{
  readonly deviceId: string;
  readonly message: string;
}> {}

export class ConnectServerError extends Data.TaggedError("ConnectServerError")<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ConnectServiceError extends Data.TaggedError(
  "ConnectServiceError",
)<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ConnectRxError extends Data.TaggedError("ConnectRxError")<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ConnectTxError extends Data.TaggedError("ConnectTxError")<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export interface YiLaConnection {
  readonly device: BluetoothDevice;
  readonly server: BluetoothRemoteGATTServer;
  readonly service: BluetoothRemoteGATTService;
  readonly rx: BluetoothRemoteGATTCharacteristic;
  readonly tx: BluetoothRemoteGATTCharacteristic;
}

export const connect = (device: BluetoothDevice) =>
  Effect.gen(function* () {
    if (!device.gatt) {
      return yield* new ConnectGATTNotFoundError({
        deviceId: device.id,
        message: `Bluetooth GATT is unavailable for device ${device.id}`,
      });
    }

    const server = yield* Effect.tryPromise({
      try: () => device.gatt!.connect(),
      catch: (cause) =>
        new ConnectServerError({
          deviceId: device.id,
          cause,
          message: describeUnknownCause(cause),
        }),
    });

    const service = yield* Effect.tryPromise({
      try: () => server.getPrimaryService(NUS_SERVICE_UUID),
      catch: (cause) =>
        new ConnectServiceError({
          deviceId: device.id,
          cause,
          message: describeUnknownCause(cause),
        }),
    });

    const rx = yield* Effect.tryPromise({
      try: () => service.getCharacteristic(NUS_RX_CHAR_UUID),
      catch: (cause) =>
        new ConnectRxError({
          deviceId: device.id,
          cause,
          message: describeUnknownCause(cause),
        }),
    });

    const tx = yield* Effect.tryPromise({
      try: () => service.getCharacteristic(NUS_TX_CHAR_UUID),
      catch: (cause) =>
        new ConnectTxError({
          deviceId: device.id,
          cause,
          message: describeUnknownCause(cause),
        }),
    });

    return {
      device,
      server,
      service,
      rx,
      tx,
    } satisfies YiLaConnection;
  });
