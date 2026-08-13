# 9Router Quota Tracker

A Raycast extension for monitoring quota availability across your [9Router](https://github.com/decolua/9router) provider accounts.

It gives a compact, provider-grouped view of account availability, remaining quota, and the next quota reset—without opening the 9Router dashboard.

## Features

- Groups accounts by provider.
- Shows each account's primary quota summary, lowest remaining percentage, and relative reset time such as `in 6d 22h 7m`.
- Reads the native 9Router `isActive` account state.
  - Active accounts use green status badges.
  - Inactive accounts use muted badges and icons.
- Supports provider filtering from the command's dropdown.
- Loads cached results immediately, then refreshes from 9Router in the background.
- Provides a manual refresh action with `Cmd + R`.
- Offers an optional deep-dive detail panel with every quota, remaining value, and reset time.
- Lets you configure the 9Router Base URL, password, and provider filter from Raycast.

## Requirements

- macOS with [Raycast](https://www.raycast.com/).
- A reachable 9Router instance.
- Bun 1.0 or later.

## Install for Development

```bash
bun install
bunx @raycast/api develop
```

Raycast opens the extension in development mode. Run **Track Quotas** from Raycast to use it.

## Configuration

Open **Track Quotas**. If configuration is missing, Raycast shows the setup form. You can also open **Configure Settings** from the action panel.

| Setting | Description |
| --- | --- |
| **9Router Base URL** | The root URL of your 9Router instance, for example `https://ai9.example.com`. |
| **Password** | The password used for `POST /api/auth/login`. Stored by Raycast as a password preference or locally after setting it in the command form. |
| **Provider Filter** | `all` by default. Use a provider identifier to limit API results, for example `codex` or `claude`. |

The extension requests:

- `POST /api/auth/login`
- `GET /api/providers/client`
- `GET /api/usage/:connectionId` for each returned account

## Usage

| Action | Shortcut | Purpose |
| --- | --- | --- |
| Refresh Quotas (Manual) | `Cmd + R` | Fetch current data from 9Router and replace the cached result. |
| Show / Hide Deep Dive Details | — | Toggle full quota details for the selected account. |
| Open 9Router Dashboard | `Cmd + O` | Open the configured Base URL in the browser. |
| Configure Settings | `Cmd + Shift + ,` | Change Base URL, password, or provider filter. |

## Caching

The latest successful response is stored in Raycast LocalStorage. On the next command launch, cached data appears immediately and a background request updates it. The provider heading indicates how recently the displayed data was updated.

Use **Refresh Quotas (Manual)** when you need an immediate fetch.

## Build and Test

```bash
bun test src/api.test.ts
bunx @raycast/api build -e dist
```

## License

MIT.
