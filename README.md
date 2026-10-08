# Harvest Ticket Exchange

Offline exchange of harvest tickets ("талон комбайнера") between smartphones in the field —
no mobile network or shared Wi-Fi required.

During harvest every truckload of grain gets a paper ticket: the combine operator fills it in,
the truck driver carries it to the weighing station, the weigher records the weight. This project
replaces the paper with a mobile app in which the ticket travels **phone-to-phone over a local
Wi-Fi hotspot**, and a desktop app at the weighing station receives it.

> Status: working prototype / portfolio project. The Android app covers the full combine
> operator → driver flow; the desktop (weighing station) app is in development.

## How it works

```
 Combine operator (Android)              Driver (Android)                 Weighing station (PC)
 ───────────────────────────             ────────────────                 ─────────────────────
 1. creates a ticket
 2. starts a local-only hotspot
    + TCP server, shows a QR code  ──▶  3. scans the QR, joins the
       {ssid, password, ip, port}           hotspot, connects over TCP
 4. ticket is sent as JSON         ◀──▶  5. driver confirms / signs it
                                         6. at the station scans the   ──▶  7. desktop app receives
                                            desktop QR {ip, port,             the ticket, the weigher
                                            auth_code} and sends it           records the weight
```

- **No infrastructure.** The combine operator's phone starts an Android
  `LocalOnlyHotspot`; the driver's phone joins it via `WifiNetworkSpecifier`
  (native Kotlin bridge in [`app/android/.../talonkombainera`](app/android/app/src/main/java/com/talonkombainera)).
- **Transport.** Plain TCP sockets ([`react-native-tcp-socket`](https://github.com/Rapsssito/react-native-tcp-socket))
  with a small JSON request/response protocol and message framing
  ([`app/wifi`](app/wifi), [`app/services/MessageHandler.ts`](app/services/MessageHandler.ts)).
- **Pairing by QR code.** Connection data is exchanged through a QR code
  (`react-native-qrcode-svg` to show it, `react-native-vision-camera` to scan it).
- **Local storage.** Each device keeps its own SQLite database with versioned migrations
  ([`app/db`](app/db)); the desktop app mirrors the same schema in Rust
  ([`desktop/core/talon-db`](desktop/core/talon-db), see [`desktop/MIGRATIONS.md`](desktop/MIGRATIONS.md)).
- **Ticket lifecycle.** `created → assigned → in_progress → voditel_signed → completed`, plus
  cancellation states — see [`app/docs/STATUS_MAPPING.md`](app/docs/STATUS_MAPPING.md).

## User roles

| Role | What they do |
|------|--------------|
| Combine operator (`kombainer`) | creates tickets, hands them over to a driver via QR, exports ticket history |
| Driver (`voditel`) | scans tickets, confirms them, keeps a registry of trips, delivers tickets to the weighing station |
| Weigher (`vesovschik`) | works in the desktop app at the weighing station: receives tickets and records the weight |
| Administrator | maintenance on the device: database statistics, backup, data export and cleanup |

## Repository layout

| Path | Contents |
|------|----------|
| [`app/`](app) | React Native 0.80 app (TypeScript, Android first), Kotlin native modules for hotspot/Wi-Fi |
| [`desktop/`](desktop) | Weighing-station app: Tauri 2 + Rust backend, Svelte 5 frontend, SQLite (`talon-db` crate) |
| [`global.d.ts`](global.d.ts) | shared TypeScript types for the protocol and navigation |

## Tech stack

React Native · TypeScript · Kotlin · SQLite · TCP sockets · Rust · Tauri 2 · Svelte 5 · Tailwind CSS

## Getting started

### Android app

Requirements: Node.js ≥ 18, JDK 17+, Android SDK (see the
[React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)).

```sh
cd app
npm install
npm start          # Metro bundler
npm run android    # build and install on a connected device
```

The hotspot exchange needs two real Android devices running Android 10+ (`minSdkVersion 29`) with location services enabled.

### Desktop app

Requirements: [Rust](https://www.rust-lang.org/tools/install), Node.js, and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
cd "desktop/Flying Carpet"
npm install
cargo tauri dev
```

## Credits and license

The desktop app is built on top of [Flying Carpet](https://github.com/spieglt/FlyingCarpet)
by Theron Spiegl — a cross-platform file transfer tool over ad hoc Wi-Fi — and keeps its
networking core. Flying Carpet is licensed under GPL-3.0, so this project is distributed under
the **GNU General Public License v3.0** as well — see [`LICENSE`](LICENSE) and the original
notice in [`desktop/LICENSE.txt`](desktop/LICENSE.txt).
