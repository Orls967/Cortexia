import type { ParamSpec } from '../../kernels/core/types';
import { clearHoverTarget, scheduleHoverTarget, useSelectionStore } from '../../stores/selectionStore';
import { MathFormula } from './MathFormula';

interface ScientificParameterControlProps {
  spec: ParamSpec;
  modelId: string;
  value: number;
  onChange: (value: number) => void;
}

export function ScientificParameterControl({ spec, modelId, value, onChange }: ScientificParameterControlProps) {
  const selectEntity = useSelectionStore((s) => s.selectEntity);
  const entityTargetId = spec.registryId ?? modelId;
  const step = spec.step ?? (spec.integer ? 1 : Number(((spec.max - spec.min) / 100).toPrecision(2)) || 0.01);
  const modified = Math.abs(value - spec.default) > 1e-12;

  const hoverShow = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    scheduleHoverTarget({
      entityId: entityTargetId,
      x: r.left,
      y: r.bottom + 6,
      ...(spec.unit ? { unit: spec.unit } : {}),
      valueText: `${value}${spec.unit ? ` ${spec.unit}` : ''}`,
      fallbackModelId: modelId,
      labelOverride: spec.label,
      definitionOverride: spec.description,
    });
  };

  if (spec.options && spec.options.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid rgba(30,41,59,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => hoverShow(e.currentTarget)}
            onMouseLeave={clearHoverTarget}
            onClick={() => selectEntity(entityTargetId, { openInspector: true })}
          >
            {spec.label}
          </button>
          {modified && (
            <button type="button" className="cx-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => onChange(spec.default)}>
              Reset
            </button>
          )}
        </div>
        <select
          className="cx-select"
          aria-label={spec.label}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {spec.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '7px 0', borderBottom: '1px solid rgba(30,41,59,0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={(e) => hoverShow(e.currentTarget)}
          onMouseLeave={clearHoverTarget}
          onClick={() => selectEntity(entityTargetId, { openInspector: true })}
          title={spec.description}
        >
          {spec.symbol && <span style={{ color: 'var(--accent-ice-blue)' }}><MathFormula latex={spec.symbol} /></span>}
          <span>{spec.label}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {spec.unit && (
            <span className="cx-badge tabular" style={{ fontSize: 10, padding: '1px 5px' }}>
              {spec.unit}
            </span>
          )}
          {modified && (
            <button
              type="button"
              className="cx-btn"
              style={{ padding: '1px 6px', fontSize: 10 }}
              onClick={() => onChange(spec.default)}
              title={`Reset to default (${spec.default})`}
            >
              ↺
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={step}
          value={Math.min(spec.max, Math.max(spec.min, value))}
          aria-label={spec.label}
          aria-valuemin={spec.min}
          aria-valuemax={spec.max}
          aria-valuenow={value}
          aria-valuetext={`${value} ${spec.unit}`}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent-ice-blue)' }}
        />
        <input
          type="number"
          className="cx-input tabular"
          min={spec.min}
          max={spec.max}
          step={step}
          value={Number.isFinite(value) ? value : spec.default}
          aria-label={`${spec.label} value`}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
          style={{ width: 82, padding: '3px 6px', fontSize: 12, textAlign: 'right' }}
        />
      </div>
    </div>
  );
}
