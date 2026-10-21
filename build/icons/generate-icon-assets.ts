/**
 * [POS]: Build-time icon rasteriser — writes 16/32/48/128 PNGs per RunState into public/icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { ICON_SIZES, iconPath } from '../../src/shared/icon-paths';
import { renderIconSvg } from './render-icon-svg';
import type { RunState } from '../../src/shared/run-state';

const STATES: readonly RunState[] = ['running', 'paused', 'off'];

export type IconWriter = (relativePath: string, data: Buffer) => Promise<void>;
export type IconRasterizer = (svg: string, size: number) => Buffer;

export const defaultRasterize: IconRasterizer = (svg, size) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
};

// Orchestrates one (state, size) pair per file: render the vector source, rasterize it,
// hand the bytes to `write`. `write` and `rasterize` are seams so the file plan — which
// paths get produced, in what order — is testable without touching disk or resvg.
export const generateIconFiles = async (
  write: IconWriter,
  rasterize: IconRasterizer = defaultRasterize,
): Promise<string[]> => {
  const written: string[] = [];
  for (const state of STATES) {
    for (const size of ICON_SIZES) {
      const svg = renderIconSvg(state, size);
      const png = rasterize(svg, size);
      const relativePath = iconPath(state, size);
      await write(relativePath, png);
      written.push(relativePath);
    }
  }
  return written;
};

// Writes the generated PNGs under `publicDir/icons/`. Called from the WXT `build:before`
// hook so both `pnpm dev` and `pnpm build` regenerate icons before WXT copies `public/`
// into the output directory; the generated files are gitignored, never committed.
export const generateIconAssets = async (publicDir: string): Promise<string[]> => {
  await mkdir(join(publicDir, 'icons'), { recursive: true });
  return generateIconFiles(async (relativePath, data) => {
    await writeFile(join(publicDir, relativePath), data);
  });
};
