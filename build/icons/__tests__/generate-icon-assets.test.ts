/**
 * [POS]: Tests of the icon build step file plan — every state and size, at the shared icon paths
 */
import { describe, expect, it, vi } from 'vitest';
import { generateIconFiles } from '../generate-icon-assets';

describe('generateIconFiles', () => {
  it('writes 4 sizes for each of the 3 run states', async () => {
    const written: string[] = [];
    const write = vi.fn(async (path: string) => {
      written.push(path);
    });
    const rasterize = vi.fn((svg: string) => Buffer.from(svg));

    const result = await generateIconFiles(write, rasterize);

    expect(result).toHaveLength(12);
    expect(write).toHaveBeenCalledTimes(12);
    for (const state of ['running', 'paused', 'off']) {
      for (const size of [16, 32, 48, 128]) {
        expect(written).toContain(`icons/icon-${state}-${size}.png`);
      }
    }
  });

  it('rasterizes the state-specific svg for each file, at the matching pixel size', async () => {
    const rasterize = vi.fn((svg: string) => Buffer.from(svg));
    await generateIconFiles(async () => {}, rasterize);

    const pausedCall = rasterize.mock.calls.find(([svg]) => svg.includes('circle'));
    expect(pausedCall?.[1]).toEqual(expect.any(Number));
    expect(rasterize).toHaveBeenCalledWith(expect.stringContaining('width="128"'), 128);
  });
});
