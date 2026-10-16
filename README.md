# Zenith Client

**Reach Your Peak.** A Minecraft Java Edition launcher and Fabric-based in-game client.

> Status: early development. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for exactly what works and what has been verified.

| Path | What it is |
|---|---|
| `launcher/` | Desktop launcher — Electron + React + TypeScript + Vite |
| `minecraft-client/` | In-game client — Fabric mod for Minecraft 1.21.1 (Mojang mappings, Mixin) |
| `backend/news/` | News feed JSON consumed by the launcher |
| `docs/` | Status, authentication setup |
| `index.html`, `styles.css`, `script.js` | Marketing website (GitHub Pages) — see `README.txt` |

## Requirements

- Node.js 20+
- JDK 21 to run Minecraft 1.21.1 (the launcher can download Temurin automatically)
- JDK 25 to run the Gradle build of `minecraft-client` (Fabric Loom 1.18 requirement; output still targets Java 21)

## Build the in-game client

```bash
cd minecraft-client
./gradlew build          # jar in build/libs/, runs JUnit tests
./gradlew runClient      # dev client with the Zenith mod
```

## Run the launcher

```bash
cd launcher
npm install
npm run dev              # Vite + Electron
npm test                 # Vitest unit tests
npm run build            # typecheck + production bundles
```

The launcher copies `minecraft-client/build/libs/zenith-client-*.jar` into "Zenith" Fabric profiles together with Fabric API, Sodium, Lithium and FerriteCore (downloaded from Modrinth, SHA-512 verified).

Microsoft sign-in requires your own Azure client ID — see [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

### Headless install/launch (no Electron)

```bash
cd launcher
ZENITH_HOME=$PWD/.zenith-test npm run headless -- 1.21.1 --install-only
ZENITH_DEV_OFFLINE=1 ZENITH_HOME=$PWD/.zenith-test npm run headless -- 1.21.1
```

## In-game controls

- **Right Shift** — Zenith menu (search, categories, module toggles and settings)
- **C** (hold) — Zoom
- `/zenith help` — local client commands (never sent to the server)

Config is stored in `<game dir>/config/zenith/config.json` (atomic writes with a `.bak` copy).

Zenith Client is not affiliated with Mojang Studios or Microsoft.
