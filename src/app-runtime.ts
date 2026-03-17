import { Layer, ManagedRuntime } from "effect";
import { DeviceStore } from "./features/yila/device-store";
import { YiLa } from "./features/yila";

const appLayer = Layer.mergeAll(YiLa.layer, DeviceStore.layer);

export const appRuntime = ManagedRuntime.make(appLayer);
