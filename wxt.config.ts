import { defineConfig } from 'wxt';
import { DEV_BUILD_NUMBER_FILE, takeDevBuildNumber } from './build/dev-build-number';
import { generateIconAssets } from './build/icons/generate-icon-assets';
import { NEW_TAB_RIGHT_COMMAND } from './src/shared/commands';
import { iconPathsFor } from './src/shared/icon-paths';

// Hot reload contract:
// - `webExt.disabled` keeps WXT from spawning a browser or touching any Chrome profile.
//   Development happens in the user's everyday Chrome, with the output directory loaded
//   manually once. Never point WXT at a real profile directory: web-ext either copies the
//   whole user-data-dir or runs against it with flags that break Chrome Safe Storage.
// - The dev server origin is baked into the dev build, so the port must not drift.
//   `strictPort` belongs under `dev.server`: WXT picks the port itself and ignores the
//   Vite-level option, silently falling back to a free port when this is missing.
//
// The previous hand-written manifest always emitted `version_name`. WXT drops it when it
// equals `version`, which is the same thing Chrome shows — the field was pure duplication.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  manifest: {
    name: 'Tab_Right',
    description: '标签页管理',
    permissions: ['tabs', 'storage', 'alarms'],
    // The command creates the tab already in place. `MacCtrl` is the real Control key
    // on macOS (`Ctrl` would map to Command); other platforms get no default.
    commands: {
      [NEW_TAB_RIGHT_COMMAND]: {
        suggested_key: { mac: 'MacCtrl+T' },
        description: '在右侧新建标签',
      },
    },
    // Static default icon/action point at the "running" state; src/background/action-icon.ts
    // repaints them at runtime via chrome.action.setIcon once settings are known.
    icons: iconPathsFor('running'),
    action: {
      default_popup: 'popup.html',
      default_title: 'Tab_Right',
      default_icon: iconPathsFor('running'),
    },
  },

  webExt: {
    disabled: true,
  },

  dev: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },

  // The counter file is rewritten on every dev rebuild; watching it would loop forever.
  watchOptions: {
    ignored: [DEV_BUILD_NUMBER_FILE],
  },

  hooks: {
    // Rasterizes the toolbar icon (16/32/48/128 per run state) into public/icons/ before
    // WXT copies public/ into the output. Runs for both `wxt build` and `wxt dev` — the
    // generated PNGs are gitignored, never committed; only the vector source is.
    'build:before': async wxt => {
      await generateIconAssets(wxt.config.publicDir);
    },
    // Dev builds carry a fourth version segment that counts reloads, so the extension card
    // in chrome://extensions shows at a glance whether the reload actually landed.
    // Production keeps the three-segment release version untouched.
    'build:manifestGenerated': (wxt, manifest) => {
      if (wxt.config.command !== 'serve') return;
      manifest.version = `${manifest.version}.${takeDevBuildNumber()}`;
    },
  },
});
