import { safeStorage } from "electron";
import type { SecretCipher } from "./services/accounts";

/** OS-backed encryption: DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux. */
export const electronCipher: SecretCipher = {
  available: () => safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
  encrypt: (plain) => safeStorage.encryptString(plain).toString("base64"),
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, "base64"))
};
