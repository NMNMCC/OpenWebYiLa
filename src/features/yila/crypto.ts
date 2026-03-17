import CryptoJS from "crypto-js";
import { AES_KEY_TEXT } from "./constants";

const AES_KEY = CryptoJS.enc.Utf8.parse(AES_KEY_TEXT);

export const derivePasswordKey = (password: string) =>
  CryptoJS.MD5(password).toString().substring(8, 24);

export const buildPlaintext = (key: string, payload: string) =>
  `${Math.floor(Date.now() / 1_000)}${key}${payload}`;

export const encryptPayload = (plaintext: string) => {
  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.enc.Utf8.parse(plaintext),
    AES_KEY,
    {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.ZeroPadding,
    },
  );

  return Uint8Array.from(atob(encrypted.toString()), (char) =>
    char.charCodeAt(0),
  );
};
