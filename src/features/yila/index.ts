import { Context, Effect, Layer } from "effect";
import { type OpenOptions, open } from "./open";
import { type ChangePasswordOptions, passwd } from "./passwd";
import { getGrantedDeviceById, getGrantedDevices, request } from "./request";

export class YiLa extends Context.Tag("YiLa")<
  YiLa,
  {
    readonly request: Effect.Effect<BluetoothDevice, unknown>;
    readonly getDevices: Effect.Effect<ReadonlyArray<BluetoothDevice>, unknown>;
    readonly getDeviceById: (
      id: string,
    ) => Effect.Effect<BluetoothDevice | undefined, unknown>;
    readonly open: (options: OpenOptions) => ReturnType<typeof open>;
    readonly passwd: (
      options: ChangePasswordOptions,
    ) => ReturnType<typeof passwd>;
  }
>() {
  static readonly layer = Layer.succeed(
    YiLa,
      YiLa.of({
        request,
        getDevices: getGrantedDevices,
        getDeviceById: getGrantedDeviceById,
        open,
        passwd,
      }),
  );
}
