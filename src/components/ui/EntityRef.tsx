import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveEntityRoute } from '../../data/routeResolver';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../../stores/selectionStore';

interface EntityRefProps {
  id: string;
  label?: string;
  unit?: string;
  valueText?: string;
  fallbackModelId?: string;
  definitionOverride?: string;
  showId?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Universal UCES inline trigger:
 * - Hover (>=180ms) displays Tier A tooltip
 * - Click / Enter opens Tier B right-side Inspector Dock
 * - Pressing 'K' while focused jumps straight to Tier C /knowledge/:entityId
 */
export function EntityRef({
  id,
  label,
  unit,
  valueText,
  fallbackModelId,
  definitionOverride,
  showId = false,
  children,
  className = 'cx-entity-chip',
}: EntityRefProps) {
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const selectedId = useSelectionStore((s) => s.selectedEntityId);
  const navigate = useNavigate();

  const onHover = (x: number, y: number) => {
    scheduleHoverTarget({
      entityId: id,
      x,
      y,
      ...(unit ? { unit } : {}),
      ...(valueText ? { valueText } : {}),
      ...(fallbackModelId ? { fallbackModelId } : {}),
      ...(label ? { labelOverride: label } : {}),
      ...(definitionOverride ? { definitionOverride } : {}),
    });
  };

  return (
    <button
      type="button"
      className={className}
      data-entity-id={id}
      aria-pressed={selectedId === id}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(rect.left, rect.bottom + 8);
      }}
      onMouseLeave={clearHoverTarget}
      onFocus={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onHover(rect.left, rect.bottom + 8);
      }}
      onBlur={clearHoverTarget}
      onClick={(e) => {
        e.stopPropagation();
        clearHoverTarget();
        selectEntity(id, { openInspector: true });
      }}
      onKeyDown={(e) => {
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          clearHoverTarget();
          navigate(resolveEntityRoute(id).knowledgePath);
        }
      }}
    >
      {children ?? (
        <>
          <span>{label ?? id}</span>
          {showId && <span className="tabular" style={{ color: '#bae6fd', fontSize: 10 }}>{id}</span>}
        </>
      )}
    </button>
  );
}
