import { useEffect, useMemo, useRef, useState } from 'react';
import { ChartDataTableToggle, computeSeriesSummary } from '../ui/DataTableModal';
import { formatNum, OKABE_ITO, TRACE_DASH } from './palette';
import { useCanvasWidth } from './useCanvasWidth';

export interface TraceSeriesInput {
  key: string;
  label: string;
  unit?: string;
  data: Float64Array;
  dashed?: boolean;
  color?: string;
}

interface TraceCanvasPlotProps {
  title: string;
  x: Float64Array;
  xLabel?: string;
  yLabel?: string;
  series: TraceSeriesInput[];
  height?: number;
  thresholdY?: number;
  onInspectSeries?: (key: string) => void;
}

export function TraceCanvasPlot({
  title,
  x,
  xLabel = 'time (ms)',
  yLabel = '',
  series,
  height = 230,
  thresholdY,
  onInspectSeries,
}: TraceCanvasPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = useCanvasWidth(canvasRef, 520);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < x.length; i++) {
      const xv = x[i]!;
      if (Number.isFinite(xv)) {
        if (xv < xMin) xMin = xv;
        if (xv > xMax) xMax = xv;
      }
    }
    for (const s of series) {
      for (let i = 0; i < s.data.length; i++) {
        const yv = s.data[i]!;
        if (Number.isFinite(yv)) {
          if (yv < yMin) yMin = yv;
          if (yv > yMax) yMax = yv;
        }
      }
    }
    if (!Number.isFinite(xMin) || xMax <= xMin) { xMin = 0; xMax = 1; }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = -1; yMax = 1; }
    if (yMax - yMin < 1e-9) { yMin -= 0.5; yMax += 0.5; }
    const pad = 0.08 * (yMax - yMin);
    return { xMin, xMax, yMin: yMin - pad, yMax: yMax + pad };
  }, [x, series]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvasWidth;
    const h = height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const padL = 56, padR = 16, padT = 12, padB = 34;
    const pw = Math.max(20, w - padL - padR);
    const ph = Math.max(20, h - padT - padB);
    const toX = (v: number) => padL + ((v - bounds.xMin) / (bounds.xMax - bounds.xMin)) * pw;
    const toY = (v: number) => padT + ph - ((v - bounds.yMin) / (bounds.yMax - bounds.yMin)) * ph;

    // Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      const gy = padT + ph * (1 - f);
      const yVal = bounds.yMin + f * (bounds.yMax - bounds.yMin);
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + pw, gy);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(formatNum(yVal), padL - 6, gy + 3);
    }
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      const gx = padL + pw * f;
      const xVal = bounds.xMin + f * (bounds.xMax - bounds.xMin);
      ctx.beginPath();
      ctx.moveTo(gx, padT);
      ctx.lineTo(gx, padT + ph);
      ctx.stroke();
      ctx.textAlign = i === 4 ? 'right' : i === 0 ? 'left' : 'center';
      ctx.fillText(formatNum(xVal), gx, padT + ph + 13);
    }

    // Threshold line
    if (thresholdY !== undefined && thresholdY >= bounds.yMin && thresholdY <= bounds.yMax) {
      const ty = toY(thresholdY);
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, ty);
      ctx.lineTo(padL + pw, ty);
      ctx.stroke();
      ctx.restore();
    }

    // Traces (true min-max decimation per pixel column so narrow spikes are never clipped)
    const n = x.length;
    const cols = Math.max(1, Math.floor(pw));
    series.forEach((s, si) => {
      const len = Math.min(n, s.data.length);
      if (len < 2) return;
      ctx.save();
      ctx.strokeStyle = s.color ?? OKABE_ITO[si % OKABE_ITO.length]!;
      ctx.lineWidth = 1.6;
      if (s.dashed) ctx.setLineDash(TRACE_DASH[(si + 1) % TRACE_DASH.length]!);
      ctx.beginPath();
      let started = false;
      if (len <= cols * 2) {
        for (let i = 0; i < len; i++) {
          const yv = s.data[i]!;
          if (!Number.isFinite(yv)) { started = false; continue; }
          const px = toX(x[i]!);
          const py = toY(yv);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        }
      } else {
        const xSpan = bounds.xMax - bounds.xMin || 1;
        let idx = 0;
        for (let c = 0; c < cols && idx < len; c++) {
          const colEndX = c === cols - 1 ? Infinity : bounds.xMin + ((c + 1) / cols) * xSpan;
          let minV = Infinity, maxV = -Infinity;
          let minIdx = -1, maxIdx = -1;
          while (idx < len && x[idx]! <= colEndX) {
            const yv = s.data[idx]!;
            if (Number.isFinite(yv)) {
              if (yv < minV) { minV = yv; minIdx = idx; }
              if (yv > maxV) { maxV = yv; maxIdx = idx; }
            }
            idx++;
          }
          if (minIdx === -1) {
            if (idx < len && !Number.isFinite(s.data[idx]!)) started = false;
            continue;
          }
          const px = padL + c + 0.5;
          if (minIdx === maxIdx) {
            const py = toY(minV);
            if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
          } else {
            const firstY = toY(minIdx < maxIdx ? minV : maxV);
            const secondY = toY(minIdx < maxIdx ? maxV : minV);
            if (!started) { ctx.moveTo(px, firstY); started = true; } else { ctx.lineTo(px, firstY); }
            ctx.lineTo(px, secondY);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    // Hover crosshair
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < x.length) {
      const hx = toX(x[hoverIdx]!);
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + ph);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, padL + pw / 2, h - 5);
    if (yLabel) {
      ctx.save();
      ctx.translate(12, padT + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }
  }, [x, series, bounds, height, canvasWidth, hoverIdx, thresholdY, xLabel, yLabel]);

  const summaryRows = useMemo(
    () => series.map((s) => computeSeriesSummary(s.label, s.data, s.unit)),
    [series],
  );

  return (
    <div className="cx-card" style={{ padding: 12 }}>
      <div className="cx-card-title" style={{ marginBottom: 6 }}>
        <span>{title}</span>
        <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
          {hoverIdx !== null && hoverIdx < x.length
            ? `${xLabel.split(' ')[0]} = ${formatNum(x[hoverIdx]!)} | ` +
              series.map((s) => `${s.label}: ${formatNum(s.data[hoverIdx] ?? NaN)}`).join(' · ')
            : `${x.length.toLocaleString()} pts`}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block', borderRadius: 6 }}
        aria-label={`${title} time-series chart`}
        onMouseMove={(e) => {
          if (x.length < 2) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const padL = 56, padR = 14;
          const pw = Math.max(20, rect.width - padL - padR);
          const frac = Math.min(1, Math.max(0, (e.clientX - rect.left - padL) / pw));
          setHoverIdx(Math.min(x.length - 1, Math.round(frac * (x.length - 1))));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
        {series.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className="cx-badge"
            style={{ borderColor: s.color ?? OKABE_ITO[i % OKABE_ITO.length]!, color: 'var(--text-primary)' }}
            onClick={() => onInspectSeries?.(s.key)}
          >
            <span
              style={{
                width: 10,
                height: 3,
                background: s.color ?? OKABE_ITO[i % OKABE_ITO.length]!,
                display: 'inline-block',
              }}
            />
            {s.label}{s.unit ? ` (${s.unit})` : ''}
          </button>
        ))}
      </div>
      <ChartDataTableToggle rows={summaryRows} title={title} />
    </div>
  );
}
