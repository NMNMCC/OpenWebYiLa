export const parseBatteryFromAdvertisement = (
  event: BluetoothAdvertisingEvent,
) => {
  for (const data of event.manufacturerData.values()) {
    const level = parseBatteryFromManufacturerData(data);
    if (level !== null) {
      return level;
    }
  }

  return null;
};

type BinaryLike = DataView | Uint8Array | ArrayBufferLike;

export const parseBatteryFromManufacturerData = (value: BinaryLike) => {
  const bytes = toUint8Array(value);

  let offset = 0;
  while (offset < bytes.length - 2) {
    const length = bytes[offset] ?? 0;
    if (length === 0) {
      break;
    }

    const dataStart = offset + 2;
    const dataEnd = dataStart + (length - 1);
    if (dataEnd <= bytes.length && length > 1) {
      const lastByte = bytes[dataEnd - 1] ?? 0;
      if (lastByte >= 1 && lastByte <= 5) {
        return lastByte;
      }
    }

    offset += length + 1;
  }

  return null;
};

const toUint8Array = (value: BinaryLike) => {
  if (ArrayBuffer.isView(value)) {
    return Uint8Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }

  return Uint8Array.from(new Uint8Array(value));
};
