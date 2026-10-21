/**
 * [POS]: Vector icon source for the toolbar glyph — 32-unit grid, three RunState glyphs
 */
import type { RunState } from '../../src/shared/run-state';

// Shared toolbar colors and geometry for the three run states.
const ACCENT = '#3D63DD';
const GREY = '#8B929E';
const AMBER = '#E3A21A';

const glyphMarkup = (state: RunState): string => {
  const tile = state === 'running' ? ACCENT : GREY;
  const opacity = state === 'off' ? 0.5 : 1;
  const parts = [
    `<rect width="32" height="32" rx="7" fill="${tile}"/>`,
    `<path d="M5 24V14q0-2 2-2h5q2 0 2 2v10z" fill="#FFFFFF" fill-opacity="${0.5 * opacity}"/>`,
    `<path d="M17 24V8q0-2 2-2h6q2 0 2 2v16z" fill="#FFFFFF" fill-opacity="${opacity}"/>`,
    `<rect x="3" y="24" width="26" height="3" rx="1.5" fill="#FFFFFF" fill-opacity="${opacity}"/>`,
  ];
  if (state === 'paused') {
    parts.push(`<circle cx="25.5" cy="25.5" r="6" fill="${AMBER}" stroke="#FFFFFF" stroke-width="2"/>`);
  }
  return parts.join('');
};

// Renders one run state at one pixel size as a standalone SVG document. Pure and
// side-effect free so the icon build step and its tests can both call it directly.
export const renderIconSvg = (state: RunState, size: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${glyphMarkup(state)}</svg>`;
