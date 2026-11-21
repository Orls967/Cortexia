import { useEffect, useMemo, useRef, useState } from 'react';
import type { Curve } from '../../kernels/core/types';
import { ChartDataTableToggle, computeSeriesSummary } from '../ui/DataTableModal';
import { formatNum, OKABE_ITO } from './palette';
import { useCanvasWidth } from './useCanvasWidth';

export interface CurveSeries {
  key: string;
  label: string;
  curve: Curve;
  points?: boolean;
  dashed?: boolean;
  color?: string;
}

interface CurvePlotProps {
  title: string;
  xLabel: string;
  yLabel: string;
  curves: CurveSeries[];
  height?: number;
}

export function CurvePlot({ title, xLabel, yLabel, curves, height = 220 }: CurvePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = useCanvasWidth(canvasRef, 460);
  const [readout, setReadout] = useState<string>('');

  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const c of curves) {
      for (let i = 0; i < c.curve.x.length; i++) {
        const xv = c.curve.x[i]!, yv = c.curve.y[i]!;
        if (Number.isFinite(xv)) { if (xv < xMin) xMin = xv; if (xv > xMax) xMax = xv; }
        if (Number.isFinite(yv)) { if (yv < yMin) yMin = yv; if (yv > yMax) yMax = yv; }
      }
    }
    if (!Number.isFinite(xMin) || xMax <= xMin) { xMin = 0; xMax = 1; }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = 0; yMax = 1; }
    if (yMax - yMin < 1e-9) { yMin -= 0.5; yMax += 0.5; }
    const py = 0.08 * (yMax - yMin);
    return { xMin, xMax, yMin: yMin - py, yMax: yMax + py };
  }, [curves]);

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

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i <= 4; i++) {
      const f = i / 4;
      const gy = padT + ph * (1 - f);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + pw, gy); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(formatNum(bounds.yMin + f * (bounds.yMax - bounds.yMin)), padL - 6, gy + 3);
      const gx = padL + pw * f;
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, padT + ph); ctx.stroke();
      ctx.textAlign = i === 4 ? 'right' : i === 0 ? 'left' : 'center';
      ctx.fillText(formatNum(bounds.xMin + f * (bounds.xMax - bounds.xMin)), gx, padT + ph + 13);
    }

    curves.forEach((c, idx) => {
      const color = c.color ?? OKABE_ITO[idx % OKABE_ITO.length]!;
      const len = Math.min(c.curve.x.length, c.curve.y.length);
      if (len === 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.7;
      if (c.dashed) ctx.setLineDash([5, 4]);
      if (!c.points || len < 80) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < len; i++) {
          const xv = c.curve.x[i]!, yv = c.curve.y[i]!;
          if (!Number.isFinite(xv) || !Number.isFinite(yv)) { started = false; continue; }
          const px = toX(xv), py = toY(yv);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        }
        if (!c.points || len < 40) ctx.stroke();
      }
      if (c.points) {
        const r = len > 250 ? 2 : 3;
        for (let i = 0; i < len; i++) {
          const xv = c.curve.x[i]!, yv = c.curve.y[i]!;
          if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
          ctx.beginPath();
          ctx.arc(toX(xv), toY(yv), r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

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
  }, [curves, bounds, height, canvasWidth, xLabel, yLabel]);

  const rows = useMemo(() => curves.map((c) => computeSeriesSummary(c.label, c.curve.y)), [curves]);

  return (
    <div className="cx-card" style={{ padding: 12 }}>
      <div className="cx-card-title" style={{ marginBottom: 6 }}>
        <span>{title}</span>
        {readout && <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{readout}</span>}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block', borderRadius: 6 }}
        aria-label={`${title} curve plot`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const padL = 56, padR = 14, padT = 12, padB = 28;
          const pw = Math.max(20, rect.width - padL - padR);
          const ph = Math.max(20, height - padT - padB);
          const fx = Math.min(1, Math.max(0, (e.clientX - rect.left - padL) / pw));
          const fy = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top - padT) / ph));
          const xv = bounds.xMin + fx * (bounds.xMax - bounds.xMin);
          const yv = bounds.yMin + fy * (bounds.yMax - bounds.yMin);
          setReadout(`x=${formatNum(xv)}, y=${formatNum(yv)}`);
        }}
        onMouseLeave={() => setReadout('')}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {curves.map((c, idx) => (
          <span key={c.key} className="cx-badge" style={{ borderColor: c.color ?? OKABE_ITO[idx % OKABE_ITO.length]! }}>
            <span style={{ width: 9, height: 3, background: c.color ?? OKABE_ITO[idx % OKABE_ITO.length]!, display: 'inline-block' }} />
            {c.label}
          </span>
        ))}
      </div>
      <ChartDataTableToggle rows={rows} title={title} />
    </div>
  );
}
