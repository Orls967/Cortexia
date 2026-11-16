import { useEffect, useMemo, useRef } from 'react';
import type { Curve } from '../../kernels/core/types';
import { formatNum, OKABE_ITO } from './palette';

interface PhasePlanePlotProps {
  title: string;
  xData: Float64Array;
  yData: Float64Array;
  xLabel: string;
  yLabel: string;
  nullclines: { key: string; label: string; curve: Curve }[];
  height?: number;
}

export function PhasePlanePlot({ title, xData, yData, xLabel, yLabel, nullclines, height = 240 }: PhasePlanePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    const scan = (xs: ArrayLike<number>, ys: ArrayLike<number>) => {
      const len = Math.min(xs.length, ys.length);
      for (let i = 0; i < len; i++) {
        const xv = xs[i]!, yv = ys[i]!;
        if (Number.isFinite(xv)) { if (xv < xMin) xMin = xv; if (xv > xMax) xMax = xv; }
        if (Number.isFinite(yv)) { if (yv < yMin) yMin = yv; if (yv > yMax) yMax = yv; }
      }
    };
    scan(xData, yData);
    for (const nc of nullclines) scan(nc.curve.x, nc.curve.y);
    if (!Number.isFinite(xMin) || xMax <= xMin) { xMin = -1; xMax = 1; }
    if (!Number.isFinite(yMin) || yMax <= yMin) { yMin = -1; yMax = 1; }
    const px = 0.08 * (xMax - xMin), py = 0.08 * (yMax - yMin);
    return { xMin: xMin - px, xMax: xMax + px, yMin: yMin - py, yMax: yMax + py };
  }, [xData, yData, nullclines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 440;
    const h = height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const padL = 52, padR = 14, padT = 12, padB = 28;
    const pw = Math.max(20, w - padL - padR);
    const ph = Math.max(20, h - padT - padB);
    const toX = (v: number) => padL + ((v - bounds.xMin) / (bounds.xMax - bounds.xMin)) * pw;
    const toY = (v: number) => padT + ph - ((v - bounds.yMin) / (bounds.yMax - bounds.yMin)) * ph;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
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
      ctx.textAlign = 'center';
      ctx.fillText(formatNum(bounds.xMin + f * (bounds.xMax - bounds.xMin)), gx, h - 8);
    }

    // Nullclines
    nullclines.forEach((nc, idx) => {
      const len = Math.min(nc.curve.x.length, nc.curve.y.length);
      if (len < 2) return;
      ctx.save();
      ctx.strokeStyle = OKABE_ITO[(idx + 1) % OKABE_ITO.length]!;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < len; i++) {
        const xv = nc.curve.x[i]!, yv = nc.curve.y[i]!;
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) { started = false; continue; }
        const px = toX(xv), py = toY(yv);
        if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
      ctx.restore();
    });

    // Trajectory
    const len = Math.min(xData.length, yData.length);
    if (len >= 2) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const stride = Math.max(1, Math.floor(len / 4000));
      for (let i = 0; i < len; i += stride) {
        const px = toX(xData[i]!), py = toY(yData[i]!);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Start (emerald) & End (amber) markers
      ctx.fillStyle = '#10B981';
      ctx.beginPath(); ctx.arc(toX(xData[0]!), toY(yData[0]!), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath(); ctx.arc(toX(xData[len - 1]!), toY(yData[len - 1]!), 4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(xLabel, w - 10, h - 8);
    ctx.save();
    ctx.translate(12, padT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }, [xData, yData, nullclines, bounds, height, xLabel, yLabel]);

  return (
    <div className="cx-card" style={{ padding: 12 }}>
      <div className="cx-card-title" style={{ marginBottom: 6 }}>
        <span>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
          Start (green) → End (amber)
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block', borderRadius: 6 }} aria-label={title} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <span className="cx-badge" style={{ borderColor: '#38BDF8' }}>Trajectory</span>
        {nullclines.map((nc, idx) => (
          <span key={nc.key} className="cx-badge" style={{ borderColor: OKABE_ITO[(idx + 1) % OKABE_ITO.length]! }}>
            {nc.label}
          </span>
        ))}
      </div>
    </div>
  );
}
