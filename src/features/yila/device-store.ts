import { Context, Effect, Layer, Schema } from "effect";
import {
  type YiLaDeviceConfig,
  YiLaDeviceConfigListSchema,
} from "./device-config";

const STORAGE_KEY = "yila-devices";
const decodeDeviceConfigList = Schema.decodeUnknownSync(YiLaDeviceConfigListSchema);
const encodeDeviceConfigList = Schema.encodeSync(YiLaDeviceConfigListSchema);

const readAll = Effect.sync((): ReadonlyArray<YiLaDeviceConfig> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  try {
    return decodeDeviceConfigList(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
});

const writeAll = (devices: ReadonlyArray<YiLaDeviceConfig>) =>
  Effect.sync(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(encodeDeviceConfigList(Array.from(devices))),
    );
    return devices;
  });

export class DeviceStore extends Context.Tag("DeviceStore")<
  DeviceStore,
  {
    readonly list: Effect.Effect<ReadonlyArray<YiLaDeviceConfig>>;
    readonly save: (
      device: YiLaDeviceConfig,
    ) => Effect.Effect<ReadonlyArray<YiLaDeviceConfig>>;
    readonly remove: (
      id: string,
    ) => Effect.Effect<ReadonlyArray<YiLaDeviceConfig>>;
  }
>() {
  static readonly layer = Layer.succeed(
    DeviceStore,
    DeviceStore.of({
      list: readAll,
      save: (device) =>
        Effect.flatMap(readAll, (devices) =>
          writeAll(
            devices.some((current) => current.id === device.id)
              ? devices.map((current) =>
                  current.id === device.id ? device : current,
                )
              : [...devices, device],
          ),
        ),
      remove: (id) =>
        Effect.flatMap(readAll, (devices) =>
          writeAll(devices.filter((device) => device.id !== id)),
        ),
    }),
  );
}
