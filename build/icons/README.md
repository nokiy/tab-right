# build/icons/

Build-time toolbar icon generation, run by the WXT `build:before` hook in `wxt.config.ts` for both `pnpm dev` and `pnpm build`. Output goes to `public/icons/` and is gitignored; only the vector source is committed. File names come from `src/shared/icon-paths.ts`, the same scheme the manifest, the icon controller and the UI headers use.

## Members
render-icon-svg.ts: the vector glyph on a 32-unit grid, one variant per RunState; pure.
generate-icon-assets.ts: rasterises every (state, size) pair with resvg and writes the PNGs; write and rasterise are injectable for tests.

