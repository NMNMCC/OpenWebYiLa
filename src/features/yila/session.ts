import { Data, Duration, Effect } from "effect";
import { connect, type YiLaConnection } from "./connect";
import { describeUnknownCause } from "./error";
import {
  parseCommandResponse,
  type YiLaCommandResponse,
} from "./response";

export class NotificationsStartError extends Data.TaggedError(
  "NotificationsStartError",
)<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export class CommandWriteError extends Data.TaggedError("CommandWriteError")<{
  readonly deviceId: string;
  readonly message: string;
  readonly cause: unknown;
}> {}

export class ResponseTimeoutError extends Data.TaggedError(
  "ResponseTimeoutError",
)<{
  readonly deviceId: string;
  readonly message: string;
}> {}

export const withConnection = <A, E>(
  device: BluetoothDevice,
  use: (connection: YiLaConnection) => Effect.Effect<A, E>,
) =>
  Effect.acquireUseRelease(
    connect(device),
    use,
    ({ device: connectedDevice }) =>
      Effect.sync(() => {
        if (connectedDevice.gatt?.connected) {
          connectedDevice.gatt.disconnect();
        }
      }),
  );

export const writeAndRead = (
  connection: YiLaConnection,
  options: {
    readonly command: Uint8Array;
    readonly responseTimeout: Duration.DurationInput;
  },
): Effect.Effect<
  YiLaCommandResponse,
  NotificationsStartError | CommandWriteError | ResponseTimeoutError
> =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => connection.rx.startNotifications(),
      catch: (cause) =>
        new NotificationsStartError({
          deviceId: connection.device.id,
          cause,
          message: describeUnknownCause(cause),
        }),
    });

    const response = yield* Effect.async<Uint8Array, CommandWriteError>(
      (resume) => {
        const onValueChanged = () => {
          const value = connection.rx.value;
          if (!value) {
            return;
          }

          cleanup();
          resume(
            Effect.succeed(
              Uint8Array.from(
                new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
              ),
            ),
          );
        };

        const cleanup = () => {
          connection.rx.removeEventListener(
            "characteristicvaluechanged",
            onValueChanged,
          );
        };

        connection.rx.addEventListener(
          "characteristicvaluechanged",
          onValueChanged,
        );

        void connection.tx
          .writeValueWithoutResponse(Uint8Array.from(options.command))
          .catch((cause) => {
            cleanup();
            resume(
              Effect.fail(
                new CommandWriteError({
                  deviceId: connection.device.id,
                  cause,
                  message: describeUnknownCause(cause),
                }),
              ),
            );
          });

        return Effect.sync(cleanup);
      },
    ).pipe(
      Effect.timeoutFail({
        duration: options.responseTimeout,
        onTimeout: () =>
          new ResponseTimeoutError({
            deviceId: connection.device.id,
            message: `Response timed out for device ${connection.device.id}`,
          }),
      }),
    );

    return parseCommandResponse(response);
  });
