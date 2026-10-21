# src/background/adapters/

Production implementations of the kernel ports; the only kernel-side code that calls `chrome.*`. Tests replace them with `../__tests__/fake-chrome.ts`.

## Members
chrome-tabs.ts: `TabAdapter` over `chrome.tabs` — window snapshot, move, create; a vanished tab is `not-found`, any other rejection is a Chrome failure.
session-store.ts: `SessionStore` over `chrome.storage.session` — one record per window (`lastActive`, chains by tab ID, never indexes); malformed records read as none.

