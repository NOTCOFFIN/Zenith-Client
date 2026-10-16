import { randomUUID, createHash } from "node:crypto";
import type { AccountSummary, DeviceCodeInfo } from "../../shared/types";
import { atomicWriteJson, readJsonSafe } from "../util/fsx";
import { MicrosoftAuth, type DeviceCodeResponse, type MinecraftSession } from "./auth/microsoft";

/** Encrypts secrets at rest. In Electron this is backed by safeStorage (DPAPI / Keychain / libsecret). */
export interface SecretCipher {
  available(): boolean;
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}

interface StoredAccount extends AccountSummary {
  /** Encrypted JSON: { refreshToken, accessToken, xuid } */
  secret: string;
}

interface AccountsFile {
  schemaVersion: 1;
  accounts: StoredAccount[];
}

interface Secret {
  refreshToken: string;
  accessToken: string;
  xuid: string;
}

export interface ResolvedSession {
  username: string;
  uuid: string;
  accessToken: string;
  xuid: string;
  userType: "msa" | "legacy";
}

export class AccountService {
  private pending: AbortController | null = null;

  constructor(
    private readonly file: string,
    private readonly cipher: SecretCipher,
    private readonly clientId: () => string
  ) {}

  private async load(): Promise<AccountsFile> {
    return readJsonSafe<AccountsFile>(this.file, { schemaVersion: 1, accounts: [] });
  }

  private async save(data: AccountsFile): Promise<void> {
    await atomicWriteJson(this.file, data);
  }

  async list(): Promise<AccountSummary[]> {
    return (await this.load()).accounts.map(({ secret: _secret, ...rest }) => rest);
  }

  async remove(id: string): Promise<void> {
    const data = await this.load();
    data.accounts = data.accounts.filter((a) => a.id !== id);
    await this.save(data);
  }

  /** Starts the device code flow; resolves with the new account once the user finishes in the browser. */
  async beginMicrosoftLogin(onCode: (info: DeviceCodeInfo) => void): Promise<AccountSummary> {
    if (!this.cipher.available()) throw new Error("Secure credential storage is not available on this system.");
    this.pending?.abort();
    this.pending = new AbortController();
    const auth = new MicrosoftAuth(this.clientId());
    const code: DeviceCodeResponse = await auth.startDeviceCode();
    onCode({ userCode: code.user_code, verificationUri: code.verification_uri, expiresIn: code.expires_in, message: code.message });
    const tokens = await auth.pollDeviceCode(code, this.pending.signal);
    const session = await auth.loginMinecraft(tokens.accessToken);
    return this.upsert(session, tokens.refreshToken);
  }

  cancelLogin(): void {
    this.pending?.abort();
  }

  private async upsert(session: MinecraftSession, refreshToken: string): Promise<AccountSummary> {
    const data = await this.load();
    const existing = data.accounts.find((a) => a.uuid === session.uuid);
    const secret: Secret = { refreshToken, accessToken: session.accessToken, xuid: session.xuid };
    const account: StoredAccount = {
      id: existing?.id ?? randomUUID(),
      username: session.username,
      uuid: session.uuid,
      type: "microsoft",
      skinUrl: session.skinUrl,
      skinVariant: session.skinVariant,
      expiresAt: session.expiresAt,
      secret: this.cipher.encrypt(JSON.stringify(secret))
    };
    data.accounts = [...data.accounts.filter((a) => a.id !== account.id), account];
    await this.save(data);
    const { secret: _s, ...summary } = account;
    return summary;
  }

  /** Returns a valid Minecraft session, refreshing tokens when they are close to expiry. */
  async getSession(id: string): Promise<ResolvedSession> {
    const data = await this.load();
    const account = data.accounts.find((a) => a.id === id);
    if (!account) throw new Error("Account not found. Please add an account.");
    if (account.type === "offline-dev") {
      return { username: account.username, uuid: account.uuid, accessToken: "0", xuid: "0", userType: "legacy" };
    }
    const secret = JSON.parse(this.cipher.decrypt(account.secret)) as Secret;
    if (account.expiresAt - Date.now() > 5 * 60_000) {
      return { username: account.username, uuid: account.uuid, accessToken: secret.accessToken, xuid: secret.xuid, userType: "msa" };
    }
    const auth = new MicrosoftAuth(this.clientId());
    const tokens = await auth.refresh(secret.refreshToken);
    const session = await auth.loginMinecraft(tokens.accessToken);
    await this.upsert(session, tokens.refreshToken);
    return { username: session.username, uuid: session.uuid, accessToken: session.accessToken, xuid: session.xuid, userType: "msa" };
  }

  async refresh(id: string): Promise<AccountSummary> {
    const data = await this.load();
    const account = data.accounts.find((a) => a.id === id);
    if (!account || account.type !== "microsoft") throw new Error("Only Microsoft accounts can be refreshed.");
    const secret = JSON.parse(this.cipher.decrypt(account.secret)) as Secret;
    const auth = new MicrosoftAuth(this.clientId());
    const tokens = await auth.refresh(secret.refreshToken);
    return this.upsert(await auth.loginMinecraft(tokens.accessToken), tokens.refreshToken);
  }

  /**
   * Development-only offline account (no ownership check, cannot join online-mode servers).
   * Only exposed when ZENITH_DEV_OFFLINE=1 so it is never available to regular users.
   */
  async addOfflineDevAccount(username: string): Promise<AccountSummary> {
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error("Username must be 3-16 characters: letters, digits, underscore.");
    const hash = createHash("md5").update(`OfflinePlayer:${username}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const uuid = hash.toString("hex");
    const data = await this.load();
    const account: StoredAccount = { id: randomUUID(), username, uuid, type: "offline-dev", skinUrl: null, skinVariant: "classic", expiresAt: Number.MAX_SAFE_INTEGER, secret: "" };
    data.accounts.push(account);
    await this.save(data);
    const { secret: _s, ...summary } = account;
    return summary;
  }
}
