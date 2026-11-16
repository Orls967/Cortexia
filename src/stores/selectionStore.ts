import { create } from 'zustand';
import type { ScaleId } from '../data/types';

export interface HoverTarget {
  entityId: string;
  x: number;
  y: number;
  unit?: string;
  valueText?: string;
  /** Optional modelId fallback when hovering kernel-local parameters without a registry PARAM-* ID. */
  fallbackModelId?: string;
  labelOverride?: string;
  definitionOverride?: string;
}

export interface ScientificNotification {
  id: string;
  kind: 'info' | 'warning' | 'error' | 'success';
  title: string;
  detail?: string;
}

interface SelectionState {
  selectedEntityId: string | null;
  inspectorOpen: boolean;
  hoveredTarget: HoverTarget | null;
  activeScale: ScaleId;
  recentEntityIds: string[];
  searchOpen: boolean;
  notifications: ScientificNotification[];

  selectEntity: (id: string, opts?: { openInspector?: boolean; scale?: ScaleId }) => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setHover: (target: HoverTarget | null) => void;
  setActiveScale: (scale: ScaleId) => void;
  setSearchOpen: (open: boolean) => void;
  pushNotification: (n: Omit<ScientificNotification, 'id'>) => void;
  dismissNotification: (id: string) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedEntityId: null,
  inspectorOpen: false,
  hoveredTarget: null,
  activeScale: 'L7',
  recentEntityIds: ['ANAT-HIPPOCAMPUS', 'MODEL-001', 'MOL-NT-GLUTAMATE', 'CIRC-007'],
  searchOpen: false,
  notifications: [],

  selectEntity: (id, opts) =>
    set((s) => ({
      selectedEntityId: id,
      inspectorOpen: opts?.openInspector ?? true,
      activeScale: opts?.scale ?? s.activeScale,
      hoveredTarget: null,
      recentEntityIds: [id, ...s.recentEntityIds.filter((x) => x !== id)].slice(0, 12),
    })),

  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setHover: (target) => set({ hoveredTarget: target }),
  setActiveScale: (scale) => set({ activeScale: scale }),
  setSearchOpen: (open) => set({ searchOpen: open }),

  pushNotification: (n) =>
    set((s) => ({
      notifications: [...s.notifications.slice(-4), { ...n, id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
    })),

  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));

let hoverShowTimer: ReturnType<typeof setTimeout> | null = null;
let hoverHideTimer: ReturnType<typeof setTimeout> | null = null;

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
    : false;
}

export function scheduleHoverTarget(target: HoverTarget): void {
  if (isCoarsePointer()) return;
  if (hoverHideTimer) { clearTimeout(hoverHideTimer); hoverHideTimer = null; }
  if (hoverShowTimer) clearTimeout(hoverShowTimer);
  hoverShowTimer = setTimeout(() => {
    useSelectionStore.getState().setHover(target);
  }, 180);
}

export function clearHoverTarget(): void {
  if (hoverShowTimer) { clearTimeout(hoverShowTimer); hoverShowTimer = null; }
  if (hoverHideTimer) clearTimeout(hoverHideTimer);
  hoverHideTimer = setTimeout(() => {
    useSelectionStore.getState().setHover(null);
  }, 100);
}

export function cancelHoverTimers(): void {
  if (hoverShowTimer) { clearTimeout(hoverShowTimer); hoverShowTimer = null; }
  if (hoverHideTimer) { clearTimeout(hoverHideTimer); hoverHideTimer = null; }
}
