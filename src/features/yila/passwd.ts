import { Duration } from "effect";
import { DEFAULT_RESPONSE_TIMEOUT_MS } from "./constants";
import {
  buildPlaintext,
  derivePasswordKey,
  encryptPayload,
} from "./crypto";
import { withConnection, writeAndRead } from "./session";

export interface ChangePasswordOptions {
  readonly device: BluetoothDevice;
  readonly oldPassword: string;
  readonly newPassword: string;
  readonly responseTimeout?: Duration.DurationInput;
}

export const passwd = ({
  device,
  oldPassword,
  newPassword,
  responseTimeout = DEFAULT_RESPONSE_TIMEOUT_MS,
}: ChangePasswordOptions) =>
  withConnection(device, (connection) =>
    writeAndRead(connection, {
      responseTimeout,
      command: buildChangePasswordCommand({ oldPassword, newPassword }),
    }),
  );

const buildChangePasswordCommand = ({
  oldPassword,
  newPassword,
}: Omit<ChangePasswordOptions, "device" | "responseTimeout">) =>
  encryptPayload(
    buildPlaintext(
      derivePasswordKey(oldPassword),
      `A:PW;P:${derivePasswordKey(newPassword)};`,
    ),
  );
