import { HttpError, fetchJson, fetchWithRetry } from "../../util/http";

/**
 * Microsoft -> Xbox Live -> XSTS -> Minecraft Services authentication.
 * Uses the OAuth 2.0 device code flow, so the launcher never sees the user's Microsoft password.
 */

const AUTHORITY = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const SCOPE = "XboxLive.signin offline_access";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

export interface MsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface MinecraftSession {
  accessToken: string;
  expiresAt: number;
  uuid: string;
  username: string;
  xuid: string;
  skinUrl: string | null;
  skinVariant: "classic" | "slim";
}

export class AuthError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

const XSTS_ERRORS: Record<string, string> = {
  "2148916227": "This Xbox account is banned.",
  "2148916229": "This account needs adult consent before it can play online.",
  "2148916233": "This Microsoft account does not have an Xbox profile. Sign in at minecraft.net once to create one.",
  "2148916235": "Xbox Live is not available in your country.",
  "2148916236": "This account needs adult verification (South Korea).",
  "2148916237": "This account needs adult verification (South Korea).",
  "2148916238": "This is a child account; it must be added to a Microsoft Family by an adult."
};

function form(data: Record<string, string>): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString() };
}

function json(data: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) };
}

export class MicrosoftAuth {
  constructor(private readonly clientId: string) {
    if (!clientId) throw new AuthError("No Microsoft client ID configured. Set ZENITH_MS_CLIENT_ID (see docs/AUTHENTICATION.md).", "no_client_id");
  }

  async startDeviceCode(): Promise<DeviceCodeResponse> {
    return fetchJson<DeviceCodeResponse>(`${AUTHORITY}/devicecode`, form({ client_id: this.clientId, scope: SCOPE }));
  }

  /** Polls the token endpoint until the user completes sign-in, the code expires, or `signal` aborts. */
  async pollDeviceCode(code: DeviceCodeResponse, signal?: AbortSignal): Promise<MsTokens> {
    let interval = code.interval * 1000;
    const deadline = Date.now() + code.expires_in * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new AuthError("Sign-in cancelled", "cancelled");
      await new Promise((r) => setTimeout(r, interval));
      const res = await fetchWithRetry(
        `${AUTHORITY}/token`,
        form({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: this.clientId, device_code: code.device_code })
      );
      const body = (await res.json()) as Record<string, string | number>;
      if (res.ok) return this.toTokens(body);
      if (body.error === "authorization_pending") continue;
      if (body.error === "slow_down") {
        interval += 5000;
        continue;
      }
      throw new AuthError(String(body.error_description ?? body.error ?? "Microsoft sign-in failed"), String(body.error));
    }
    throw new AuthError("The sign-in code expired. Please try again.", "expired_token");
  }

  async refresh(refreshToken: string): Promise<MsTokens> {
    const res = await fetchWithRetry(`${AUTHORITY}/token`, form({ grant_type: "refresh_token", client_id: this.clientId, refresh_token: refreshToken, scope: SCOPE }));
    const body = (await res.json()) as Record<string, string | number>;
    if (!res.ok) throw new AuthError(String(body.error_description ?? "Session expired, please sign in again."), String(body.error));
    return this.toTokens(body);
  }

  private toTokens(body: Record<string, string | number>): MsTokens {
    return { accessToken: String(body.access_token), refreshToken: String(body.refresh_token), expiresAt: Date.now() + Number(body.expires_in) * 1000 };
  }

  async loginMinecraft(msAccessToken: string): Promise<MinecraftSession> {
    const xbl = await fetchJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(
      "https://user.auth.xboxlive.com/user/authenticate",
      json({ Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msAccessToken}` }, RelyingParty: "http://auth.xboxlive.com", TokenType: "JWT" })
    );
    const userHash = xbl.DisplayClaims.xui[0].uhs;

    const xstsRes = await fetchWithRetry(
      "https://xsts.auth.xboxlive.com/xsts/authorize",
      json({ Properties: { SandboxId: "RETAIL", UserTokens: [xbl.Token] }, RelyingParty: "rp://api.minecraftservices.com/", TokenType: "JWT" })
    );
    const xsts = (await xstsRes.json()) as { Token?: string; XErr?: number; DisplayClaims?: { xui: { uhs: string; xid?: string }[] } };
    if (!xstsRes.ok || !xsts.Token) {
      const code = String(xsts.XErr ?? xstsRes.status);
      throw new AuthError(XSTS_ERRORS[code] ?? `Xbox Live authorization failed (${code}).`, code);
    }

    let mc: { access_token: string; expires_in: number };
    try {
      mc = await fetchJson("https://api.minecraftservices.com/authentication/login_with_xbox", json({ identityToken: `XBL3.0 x=${userHash};${xsts.Token}` }));
    } catch (err) {
      if (err instanceof HttpError && err.status === 403) {
        throw new AuthError("Minecraft services rejected this app. The Azure client ID must be approved by Mojang (see docs/AUTHENTICATION.md).", "app_not_approved");
      }
      throw err;
    }
    const authHeader = { headers: { Authorization: `Bearer ${mc.access_token}` } };

    const entitlements = await fetchJson<{ items: { name: string }[] }>("https://api.minecraftservices.com/entitlements/mcstore", authHeader);
    if (!entitlements.items.some((i) => i.name === "game_minecraft" || i.name === "product_minecraft")) {
      throw new AuthError("This Microsoft account does not own Minecraft: Java Edition.", "not_owned");
    }

    let profile: { id: string; name: string; skins?: { state: string; url: string; variant: string }[] };
    try {
      profile = await fetchJson("https://api.minecraftservices.com/minecraft/profile", authHeader);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) throw new AuthError("This account owns Minecraft but has no Java profile yet. Create one at minecraft.net.", "no_profile");
      throw err;
    }
    const skin = profile.skins?.find((s) => s.state === "ACTIVE");
    return {
      accessToken: mc.access_token,
      expiresAt: Date.now() + mc.expires_in * 1000,
      uuid: profile.id,
      username: profile.name,
      xuid: xsts.DisplayClaims?.xui[0]?.xid ?? "0",
      skinUrl: skin?.url ?? null,
      skinVariant: skin?.variant?.toLowerCase() === "slim" ? "slim" : "classic"
    };
  }
}
