import { useEffect, useMemo, useRef, useState } from 'react';
import { DIVERGING_LUT, formatNum, VIRIDIS_LUT } from './palette';

interface HeatmapCanvasProps {
  title: string;
  rows: number;
  cols: number;
  data: Float64Array;
  xLabel?: string;
  yLabel?: string;
  diverging?: boolean;
  rowLabels?: string[];
  colLabels?: string[];
  height?: number;
}

export function HeatmapCanvas({
  title,
  rows,
  cols,
  data,
  xLabel = '',
  yLabel = '',
  diverging = false,
  rowLabels,
  colLabels,
  height = 230,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string>('');

  const { min, max } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const v = data[i]!;
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1 };
    if (diverging) {
      const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-9);
      return { min: -m, max: m };
    }
    if (hi <= lo) return { min: lo, max: lo + 1 };
    return { min: lo, max: hi };
  }, [data, diverging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rows === 0 || cols === 0) return;
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

    const padL = 40, padR = 54, padT = 10, padB = 24;
    const pw = Math.max(20, w - padL - padR);
    const ph = Math.max(20, h - padT - padB);
    const lut = diverging ? DIVERGING_LUT : VIRIDIS_LUT;

    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const octx = off.getContext('2d');
    if (octx) {
      const img = octx.createImageData(cols, rows);
      const span = max - min || 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = data[r * cols + c]!;
          const idx = Math.max(0, Math.min(255, Math.round(((Number.isFinite(v) ? v - min : 0) / span) * 255)));
          const p = (r * cols + c) * 4;
          img.data[p] = lut[idx * 3]!;
          img.data[p + 1] = lut[idx * 3 + 1]!;
          img.data[p + 2] = lut[idx * 3 + 2]!;
          img.data[p + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, padL, padT, pw, ph);
    }

    // Colorbar
    const cbX = padL + pw + 10;
    const cbW = 10;
    for (let y = 0; y < ph; y++) {
      const idx = Math.max(0, Math.min(255, Math.round((1 - y / ph) * 255)));
      ctx.fillStyle = `rgb(${lut[idx * 3]},${lut[idx * 3 + 1]},${lut[idx * 3 + 2]})`;
      ctx.fillRect(cbX, padT + y, cbW, 1.5);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatNum(max), cbX + cbW + 4, padT + 9);
    ctx.fillText(formatNum(min), cbX + cbW + 4, padT + ph);

    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (xLabel) ctx.fillText(xLabel, padL + pw / 2, h - 6);
    if (yLabel) {
      ctx.save();
      ctx.translate(12, padT + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }
  }, [rows, cols, data, min, max, diverging, height, xLabel, yLabel]);

  return (
    <div className="cx-card" style={{ padding: 12 }}>
      <div className="cx-card-title" style={{ marginBottom: 6 }}>
        <span>{title}</span>
        <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
          {hoverInfo || `${rows}×${cols} [${formatNum(min)}, ${formatNum(max)}]`}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block', borderRadius: 6 }}
        aria-label={`${title} heatmap`}
        onMouseMove={(e) => {
          if (rows === 0 || cols === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const padL = 40, padR = 54, padT = 10, padB = 24;
          const pw = Math.max(20, rect.width - padL - padR);
          const ph = Math.max(20, height - padT - padB);
          const c = Math.min(cols - 1, Math.max(0, Math.floor(((e.clientX - rect.left - padL) / pw) * cols)));
          const r = Math.min(rows - 1, Math.max(0, Math.floor(((e.clientY - rect.top - padT) / ph) * rows)));
          const v = data[r * cols + c]!;
          const rl = rowLabels?.[r] ?? `r${r}`;
          const cl = colLabels?.[c] ?? `c${c}`;
          setHoverInfo(`(${rl}, ${cl}) = ${formatNum(v)}`);
        }}
        onMouseLeave={() => setHoverInfo('')}
      />
    </div>
  );
}
