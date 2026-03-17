import { Duration } from "effect";
import {
  DEFAULT_CLOSE_DURATION_MS,
  DEFAULT_OPEN_DURATION_MS,
  DEFAULT_RESPONSE_TIMEOUT_MS,
  DEFAULT_WAIT_DURATION_MS,
} from "./constants";
import {
  buildPlaintext,
  derivePasswordKey,
  encryptPayload,
} from "./crypto";
import { withConnection, writeAndRead } from "./session";

export interface OpenOptions {
  readonly device: BluetoothDevice;
  readonly password: string;
  readonly open?: Duration.DurationInput;
  readonly wait?: Duration.DurationInput;
  readonly close?: Duration.DurationInput;
  readonly direction?: YiLaDirection;
  readonly responseTimeout?: Duration.DurationInput;
}

export type YiLaDirection = "+" | "-";

export const open = ({
  device,
  password,
  open = DEFAULT_OPEN_DURATION_MS,
  wait = DEFAULT_WAIT_DURATION_MS,
  close = DEFAULT_CLOSE_DURATION_MS,
  direction = "+",
  responseTimeout = DEFAULT_RESPONSE_TIMEOUT_MS,
}: OpenOptions) =>
  withConnection(device, (connection) =>
    writeAndRead(connection, {
      responseTimeout,
      command: buildOpenCommand({ password, open, wait, close, direction }),
    }),
  );

const buildOpenCommand = ({
  password,
  open,
  wait,
  close,
  direction,
}: {
  readonly password: string;
  readonly open: Duration.DurationInput;
  readonly wait: Duration.DurationInput;
  readonly close: Duration.DurationInput;
  readonly direction: YiLaDirection;
}) =>
  encryptPayload(
    buildPlaintext(
      derivePasswordKey(password),
      `A:OPEN;P:${direction} ${Duration.toMillis(open)},${Duration.toMillis(wait)},${Duration.toMillis(close)};`,
    ),
  );
