/**
 * [POS]: Tests of the vector icon source — one glyph per RunState at each size
 */
import { describe, expect, it } from 'vitest';
import { renderIconSvg } from '../render-icon-svg';

describe('renderIconSvg', () => {
  it('sizes the svg document to the requested pixel size on a 32-unit viewBox', () => {
    const svg = renderIconSvg('running', 48);
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it('tints the running state with the accent color, second tab at full opacity', () => {
    const svg = renderIconSvg('running', 32);
    expect(svg).toContain('fill="#3D63DD"');
    // The back tab is always drawn at half the current opacity by design; only the
    // front tab and baseline track the state's own full/half opacity.
    expect(svg).toContain('fill-opacity="1"');
  });

  it('tints the paused state grey and adds the amber dot', () => {
    const svg = renderIconSvg('paused', 32);
    expect(svg).toContain('fill="#8B929E"');
    expect(svg).toContain('<circle');
    expect(svg).toContain('fill="#E3A21A"');
  });

  it('fades the off state to half opacity and adds no dot', () => {
    const svg = renderIconSvg('off', 32);
    expect(svg).toContain('fill="#8B929E"');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(svg).not.toContain('<circle');
  });
});
