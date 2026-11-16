import { useEffect, useState } from 'react';
import { loadIndex, type EntityIndex } from '../../data/registry';
import { useSelectionStore } from '../../stores/selectionStore';

export function UCESTooltipPortal() {
  const hovered = useSelectionStore((s) => s.hoveredTarget);
  const setHover = useSelectionStore((s) => s.setHover);
  const [index, setIndex] = useState<EntityIndex | null>(null);

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setHover]);

  if (!hovered) return null;

  const entry = index?.byId.get(hovered.entityId);
  const name = hovered.labelOverride ?? entry?.name ?? hovered.entityId;
  const def = hovered.definitionOverride ?? entry?.shortDefinition ?? 'Registry entity metadata loading or unavailable.';
  const scale = entry?.scale ?? '—';

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(vw - 336, Math.max(12, hovered.x));
  const top = hovered.y + 180 > vh ? Math.max(12, hovered.y - 170) : Math.max(12, hovered.y);

  return (
    <div
      role="tooltip"
      data-testid="uces-tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        width: 320,
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 80,
        background: '#131d31',
        border: '1px solid rgba(56, 189, 248, 0.45)',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: 'var(--shadow-popover)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <strong style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>{name}</strong>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <span className="cx-badge tabular" style={{ fontSize: 10 }}>{scale}</span>
        </div>
      </div>
      <div className="tabular" style={{ fontSize: 10, color: 'var(--accent-ice-blue)', marginBottom: 5 }}>
        {hovered.entityId}
        {hovered.fallbackModelId && hovered.fallbackModelId !== hovered.entityId ? ` · via ${hovered.fallbackModelId}` : ''}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{def}</p>
      {(hovered.valueText || hovered.unit) && (
        <div className="tabular" style={{ fontSize: 11, color: '#6ee7b7', marginBottom: 5 }}>
          Value: {hovered.valueText ?? hovered.unit}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 5 }}>
        Click to inspect · Press K for full knowledge page
      </div>
    </div>
  );
}
