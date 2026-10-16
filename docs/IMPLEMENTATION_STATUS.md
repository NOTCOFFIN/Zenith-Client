# Implementation status

Legend: **Tested** = implemented and verified (automated tests and/or running the real game). **Implemented** = code complete, compiles, not verified end to end. **Partial** = some of the spec done. **Not started** = nothing yet. **Blocked** = waiting on something external.

Verified environment: Ubuntu 22.04, Node 20, JDK 21 (game) / JDK 25 (Gradle), Mesa llvmpipe software OpenGL, Minecraft 1.21.1 + Fabric Loader 0.19.5.

## Phase 1 – Launcher

| Feature | Status | Notes |
|---|---|---|
| Electron + React + TS app shell, custom title bar | Implemented | `npm run build` passes; UI not yet click-tested in Electron |
| Mojang version manifest, vanilla install (libraries, natives, assets, client jar) | Tested | Hash-verified downloads; 1.21.1 installed via `npm run headless` |
| Fabric profile install | Tested | Fabric Loader 0.19.5 for 1.21.1 |
| Java detection + Temurin auto-download | Tested | Picked JDK 21 for 1.21.1 |
| Real launch process (classpath, arguments, JVM/RAM, resolution) | Tested | Minecraft launched and loaded a world |
| Zenith performance stack (Fabric API, Sodium, Lithium, FerriteCore) from Modrinth | Tested | SHA-512 verified, CDN-only |
| Performance presets (writes `options.txt`) | Implemented | Unit-tested merge; FPS impact not benchmarked |
| Launch log streaming (log4j XML → readable lines), token redaction | Tested | Unit tests |
| Profiles (create/edit/delete, isolated game dirs) | Implemented | Service unit-tested |
| Modrinth search/install/enable/disable/remove + required deps | Implemented | Install path exercised by the stack; UI not click-tested |
| Settings persistence with atomic writes + `.bak` recovery | Tested | Unit tests |
| Microsoft device-code → Xbox → XSTS → Minecraft auth, ownership check | Blocked | Code complete; needs an approved Azure client ID (see AUTHENTICATION.md) |
| Encrypted token storage (`safeStorage`) | Implemented | |
| 3D skin preview (skinview3d) | Implemented | |
| News feed | Implemented | Bundled JSON with optional remote URL |
| Auto-updater, installers/release packaging | Not started | electron-builder config present, no signed builds |

## Phase 2 – In-game client (Fabric, 1.21.1)

| Feature | Status | Notes |
|---|---|---|
| Fabric client mod loads alongside Sodium/Lithium/FerriteCore | Tested | |
| Custom main menu (replaces title screen; toggle in Client Settings) | Tested | |
| Right Shift menu: categories, search, toggles, expandable settings | Tested | Opened from main menu and in-world |
| Module registry + settings (boolean/number/mode) | Tested | JUnit + in game |
| Persistent config `config/zenith/config.json`, atomic + `.bak` | Tested | JUnit + in game |
| Keybinds (Right Shift menu, C zoom, HUD editor unbound by default) | Implemented | Rebindable in vanilla Controls |
| Notifications (slide-in toasts) | Tested | |
| `/zenith` client commands | Tested | help, menu, hud, list, toggle/enable/disable, info, set, config, notify, version |
| HUD: FPS, Coordinates, Keystrokes, CPS, Armor, Ping, Clock, Memory, Server address | Partial | FPS/Coordinates/Keystrokes seen in game; others compile, not individually verified |
| HUD editor (drag, snap to centre, scroll to scale, right-click hide) | Tested (partial) | Drag + scroll-scale verified in-game and persisted to config; right-click hide not yet exercised |
| Zoom | Tested | Holding C magnifies the view and releases back to normal FOV (fixed a conflict with vanilla's C "Save Hotbar Activator" binding) |
| Dynamic FPS | Tested | With pause-on-lost-focus off: 15 FPS unfocused vs ~55 FPS focused on llvmpipe |
| Toggle Sprint | Implemented | Enables/disables via command; sprint movement not yet verified in gameplay |

## Later phases

Cosmetics, AI mod assistant, benchmarking, themes engine, server list extras, multi-version adapters, crash reporter UI, auto-update: **Not started**.
