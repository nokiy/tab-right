# src/entrypoints/popup/

The toolbar popup (`action.default_popup`). Settings come from `useSettings()`: nothing but a loading or read-failure notice is shown until a read succeeds, and a failed write shows an inline error while the switch keeps the stored value.

## Members
index.html: WXT popup entrypoint page.
index.tsx: mounts `<Popup />`.
Popup.tsx: header (icon + StatusPill), enable switch, pause control, link to the options page.
Popup.css: 300px layout on the shared tokens and components.

