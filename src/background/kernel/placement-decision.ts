/**
 * [POS]: Pure placement decisions — anchor resolution, effective chain, target index and pinned-zone clamp; never touches Chrome
 */
import type { TabSnapshot } from './types';

// Evidence for resolving the anchor, in priority order: a same-window opener first,
// then the pre-creation active tab from the session record. Nothing else is guessed.
export type AnchorEvidence = {
  openerTabId?: number;
  lastActive: number | null;
};

// Direct children of each anchor, in creation order (tab IDs, never indexes).
export type ChainLookup = (anchorId: number) => readonly number[];

export type PlacementDecision =
  | { kind: 'skip'; reason: 'anchor-unavailable' | 'tab-closed' | 'pinned-tab' }
  | { kind: 'native-correct'; anchorId: number }
  | { kind: 'move'; anchorId: number; index: number };

export type CreateDecision =
  | { kind: 'skip'; reason: 'anchor-unavailable' }
  | { kind: 'create'; anchorId: number; index: number };

const byIndex = (tabs: readonly TabSnapshot[]): TabSnapshot[] => [...tabs].sort((a, b) => a.index - b.index);

const resolveAnchor = (strip: readonly TabSnapshot[], evidence: AnchorEvidence): TabSnapshot | null => {
  const inWindow = (id: number | null | undefined) =>
    id === null || id === undefined ? undefined : strip.find(tab => tab.id === id);
  return inWindow(evidence.openerTabId) ?? inWindow(evidence.lastActive) ?? null;
};

// The slot right after the anchor's effective chain, in a strip that does not contain
// the tab being placed. The effective chain is the longest prefix of the anchor's
// children that sits contiguously right of the anchor; the slot never lands in the
// pinned zone, and the chain is measured from that clamped start.
const slotAfterChain = (strip: readonly TabSnapshot[], anchor: TabSnapshot, chain: readonly number[]): number => {
  const firstUnpinned = strip.filter(tab => tab.pinned).length;
  let slot = Math.max(strip.indexOf(anchor) + 1, firstUnpinned);
  for (const childId of chain) {
    if (strip[slot]?.id !== childId) {
      break;
    }
    slot += 1;
  }
  return slot;
};

// Decides where an already-created tab belongs. The returned index is the tab's final
// index, which is exactly what chrome.tabs.move expects.
export const decidePlacement = (
  snapshot: readonly TabSnapshot[],
  newTabId: number,
  evidence: AnchorEvidence,
  chainOf: ChainLookup,
): PlacementDecision => {
  const sorted = byIndex(snapshot);
  const placed = sorted.find(tab => tab.id === newTabId);
  if (!placed) {
    return { kind: 'skip', reason: 'tab-closed' };
  }
  if (placed.pinned) {
    return { kind: 'skip', reason: 'pinned-tab' };
  }
  const current = sorted.indexOf(placed);
  const strip = sorted.filter(tab => tab !== placed);
  const anchor = resolveAnchor(strip, evidence);
  if (!anchor) {
    return { kind: 'skip', reason: 'anchor-unavailable' };
  }
  const slot = slotAfterChain(strip, anchor, chainOf(anchor.id));
  return slot === current ? { kind: 'native-correct', anchorId: anchor.id } : { kind: 'move', anchorId: anchor.id, index: slot };
};

// Decides the birth index for a tab the extension is about to create itself.
export const decideCreate = (
  snapshot: readonly TabSnapshot[],
  evidence: AnchorEvidence,
  chainOf: ChainLookup,
): CreateDecision => {
  const strip = byIndex(snapshot);
  const anchor = resolveAnchor(strip, evidence);
  if (!anchor) {
    return { kind: 'skip', reason: 'anchor-unavailable' };
  }
  return { kind: 'create', anchorId: anchor.id, index: slotAfterChain(strip, anchor, chainOf(anchor.id)) };
};
