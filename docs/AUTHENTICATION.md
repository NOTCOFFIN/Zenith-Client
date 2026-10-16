# Microsoft authentication

Zenith signs in with the official Microsoft OAuth **device-code** flow, then Xbox Live → XSTS → Minecraft Services, and checks game ownership. The launcher never sees your password.

## Configure a client ID

Microsoft requires every launcher to use its own Azure application:

1. In the [Azure portal](https://portal.azure.com) → *App registrations* → *New registration*.
2. Supported account types: **Personal Microsoft accounts only** (or "any organizational directory and personal accounts").
3. *Authentication* → *Advanced settings* → **Allow public client flows: Yes** (enables device code).
4. Request Minecraft API access for the app ID: <https://aka.ms/mce-reviewappid>. Until Mojang approves it, the Minecraft Services step fails with "app not approved".
5. Start the launcher with the client ID:

```bash
ZENITH_MS_CLIENT_ID=<your-app-client-id> npm run dev
```

Without `ZENITH_MS_CLIENT_ID`, the Accounts page says sign-in is not configured instead of pretending to work.

## Token storage

Refresh and access tokens are encrypted with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows, libsecret/kwallet on Linux) and stored in `accounts.json`. If no OS keystore is available, sign-in is refused rather than storing tokens in plain text. Access tokens are redacted from game logs.

## Offline development accounts

For development only, `ZENITH_DEV_OFFLINE=1` enables offline accounts (no Microsoft login, singleplayer/offline-mode servers only). They are hidden in normal builds.
