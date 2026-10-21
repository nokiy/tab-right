# Tab_Right

A Chrome Manifest V3 extension that places new tabs beside their source and keeps repeated openings in order.

## Features

- Keep related tabs together without moving them into the pinned-tab area.
- Create a tab directly to the right with the extension command.
- Enable, disable, or temporarily pause placement from the toolbar popup.
- Inspect and manually copy recent placement diagnostics in the options page.

The interface is currently in Chinese. This is an early-stage project distributed as source; no Chrome Web Store release is linked here.

## Build and install

Requires Node.js 22.15.1 or newer and pnpm 10.11.0.

```sh
git clone https://github.com/nokiy/tab-right.git
cd tab-right
pnpm install --frozen-lockfile
pnpm build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the generated `.output/chrome-mv3` directory. Use this production build for normal use and browser testing.

On macOS, the extension command defaults to **Control+T** (the Control key, not Command). Review or change its binding at `chrome://extensions/shortcuts`. Other platforms have no suggested default.

## Limitations

- Native new-tab actions, including Command+T, can create a tab before the extension moves it, so Chrome may briefly animate the move. The extension command creates the tab at its target position instead.
- When the source is unreliable or placement cannot finish safely, a tab may stay where Chrome opened it.
- Tabs opened while disabled or paused are not rearranged later.
- A successful source build and automated tests do not prove every Chrome lifecycle or animation scenario. Test cold-start behavior with the production service worker stopped after at least 30 seconds idle.

## Privacy and permissions

The production extension has no account, telemetry endpoint, or automatic upload. Its code does not read or record page URLs, page titles, cookies, or passwords. It uses Chrome tab/window IDs, positions, pinned state, activation events, and opener relationships to decide placement.

- `tabs`: query, create, and move tabs. Chrome grants this permission broader access, including sensitive tab fields, although the current code uses only placement metadata.
- `storage`: keep enable/pause settings and the latest 50 diagnostic entries in `chrome.storage.local`; temporary per-window placement state uses `chrome.storage.session`.
- `alarms`: resume placement when a timed pause expires.

Diagnostics include timestamps, tab/window IDs, placement decisions, and error messages. They stay on the device and also appear in the extension's developer console. **Copying diagnostics is a manual action**; review the text before sharing it. The production manifest requests no website host access and includes no content scripts.

## Development

```sh
pnpm dev
```

Start the dev server before loading `.output/chrome-mv3-dev` manually. Development uses a localhost server on port 3000 for hot reload; this connection is absent from production builds. The tooling does not launch a browser or select a browser profile. Reload the extension after restarting the dev server. Development keeps its service worker awake, so it is unsuitable for cold-start acceptance testing.

```sh
pnpm type-check
pnpm test
pnpm build
pnpm verify  # all three checks
pnpm zip     # package a production build
```

Toolbar icons are generated deterministically from `build/icons/render-icon-svg.ts`; generated assets and build output are ignored by Git. `pnpm lint` is currently a placeholder, not an additional validation gate.

## License

MIT, copyright 2026 nokiy. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the retained upstream boilerplate notice. Package dependencies retain their own licenses.
