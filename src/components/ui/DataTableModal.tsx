import { useState } from 'react';

export interface SummaryRow {
  label: string;
  unit?: string;
  min: number;
  max: number;
  mean: number;
  count: number;
}

export function computeSeriesSummary(label: string, arr: ArrayLike<number>, unit?: string): SummaryRow {
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!;
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count++;
  }
  return { label, ...(unit ? { unit } : {}), min: count ? min : NaN, max: count ? max : NaN, mean: count ? sum / count : NaN, count };
}

export function ChartDataTableToggle({ rows, title }: { rows: SummaryRow[]; title: string }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className="cx-btn"
        style={{ fontSize: 11, padding: '3px 8px' }}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide Summary Table' : 'View Data Summary Table'}
      </button>
      {open && (
        <div style={{ marginTop: 8, overflowX: 'auto' }}>
          <table aria-label={`${title} numerical summary`} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Series</th>
                <th style={{ padding: '4px 8px' }}>Min</th>
                <th style={{ padding: '4px 8px' }}>Mean</th>
                <th style={{ padding: '4px 8px' }}>Max</th>
                <th style={{ padding: '4px 8px' }}>Samples</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.label} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '4px 8px' }}>{r.label}{r.unit ? ` (${r.unit})` : ''}</td>
                  <td style={{ padding: '4px 8px' }}>{Number.isFinite(r.min) ? r.min.toPrecision(4) : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{Number.isFinite(r.mean) ? r.mean.toPrecision(4) : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{Number.isFinite(r.max) ? r.max.toPrecision(4) : '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
