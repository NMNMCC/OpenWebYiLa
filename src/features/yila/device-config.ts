import { Schema } from "effect";
import {
  DEFAULT_CLOSE_DURATION_MS,
  DEFAULT_OPEN_DURATION_MS,
  DEFAULT_RESPONSE_TIMEOUT_MS,
  DEFAULT_WAIT_DURATION_MS,
} from "./constants";

export const DEFAULT_DEVICE_PASSWORD = "123456";

export const YiLaDirectionSchema = Schema.Literal("+", "-");

export const YiLaDeviceConfigSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  password: Schema.String,
  open: Schema.Number,
  wait: Schema.Number,
  close: Schema.Number,
  direction: YiLaDirectionSchema,
  responseTimeout: Schema.Number,
});

export const YiLaDeviceConfigListSchema = Schema.Array(YiLaDeviceConfigSchema);

export type YiLaDeviceConfig = Schema.Schema.Type<typeof YiLaDeviceConfigSchema>;

export const createDefaultDeviceConfig = (
  device: Pick<BluetoothDevice, "id" | "name">,
): YiLaDeviceConfig => ({
  id: device.id,
  name: device.id,
  password: DEFAULT_DEVICE_PASSWORD,
  open: DEFAULT_OPEN_DURATION_MS,
  wait: DEFAULT_WAIT_DURATION_MS,
  close: DEFAULT_CLOSE_DURATION_MS,
  direction: "+",
  responseTimeout: DEFAULT_RESPONSE_TIMEOUT_MS,
});
