export interface YiLaCommandResponse {
  readonly success: boolean;
  readonly batteryLevel: number | null;
  readonly message: string;
  readonly raw: Uint8Array;
}

export const parseCommandResponse = (data: Uint8Array): YiLaCommandResponse => {
  if (data.length === 0) {
    return { success: false, batteryLevel: null, message: "EMPTY", raw: data };
  }

  const batteryLevel = parseBatteryLevel(data);
  const text = decodePrintableText(data);
  const upper = text.toUpperCase();
  const hex = Array.from(data, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  if (upper.includes("OK") || hex.includes("4F4B")) {
    return { success: true, batteryLevel, message: "OK", raw: data };
  }

  if (upper.includes("ERROR") || hex.includes("4552524F52")) {
    return { success: false, batteryLevel, message: "ERROR", raw: data };
  }

  if (upper.includes("FAIL")) {
    return { success: false, batteryLevel, message: "FAIL", raw: data };
  }

  return {
    success: false,
    batteryLevel,
    message: text || "UNKNOWN",
    raw: data,
  };
};

const parseBatteryLevel = (data: Uint8Array) => {
  if (data.length === 1) {
    const value = data[0] ?? 0;
    if (value >= 1 && value <= 5) {
      return value;
    }
  }

  const match = decodePrintableText(data)
    .toUpperCase()
    .match(/(?:BAT|BATT|BATTERY|PWR|POWER)\D*([1-5])/);

  return match ? Number(match[1]) : null;
};

const decodePrintableText = (data: Uint8Array) =>
  Array.from(data)
    .filter(
      (byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126),
    )
    .map((byte) => String.fromCharCode(byte))
    .join("");
