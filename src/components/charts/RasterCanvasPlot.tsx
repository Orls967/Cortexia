import { useEffect, useRef } from 'react';
import type { SpikeData } from '../../kernels/core/types';
import { useCanvasWidth } from './useCanvasWidth';

interface RasterCanvasPlotProps {
  title: string;
  spikes: SpikeData;
  height?: number;
}

export function RasterCanvasPlot({ title, spikes, height = 220 }: RasterCanvasPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWidth = useCanvasWidth(canvasRef, 520);

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

    const padL = 48, padR = 12, padT = 10, padB = 26;
    const pw = Math.max(20, w - padL - padR);
    const ph = Math.max(20, h - padT - padB);
    let tMax = 1;
    for (let i = 0; i < spikes.times.length; i++) if (spikes.times[i]! > tMax) tMax = spikes.times[i]!;
    const n = Math.max(1, spikes.n);

    // Group boundary line
    const eGroup = spikes.groups?.find((g) => g.kind === 'E');
    const iGroup = spikes.groups?.find((g) => g.kind === 'I');
    if (eGroup && iGroup) {
      const by = padT + (1 - eGroup.to / n) * ph;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(padL + pw, by); ctx.stroke();
    }

    const step = Math.max(1, Math.floor(spikes.times.length / 40000));
    for (let k = 0; k < spikes.times.length; k += step) {
      const id = spikes.ids[k]!;
      const t = spikes.times[k]!;
      const isInh = iGroup ? id >= iGroup.from && id < iGroup.to : false;
      ctx.fillStyle = isInh ? '#A855F7' : '#38BDF8';
      const x = padL + (t / tMax) * pw;
      const y = padT + (1 - id / n) * ph;
      ctx.fillRect(x, y, 1.8, 2);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`N=${n}`, padL - 6, padT + 10);
    ctx.fillText('0', padL - 6, padT + ph);
    ctx.textAlign = 'center';
    ctx.fillText('0 ms', padL, h - 8);
    ctx.fillText(`${Math.round(tMax)} ms`, padL + pw - 14, h - 8);
  }, [spikes, height, canvasWidth]);

  return (
    <div className="cx-card" style={{ padding: 12 }}>
      <div className="cx-card-title" style={{ marginBottom: 6 }}>
        <span>{title}</span>
        <span className="tabular" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
          {spikes.times.length.toLocaleString()} spikes · {spikes.n} neurons
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block', borderRadius: 6 }} aria-label={`${title} spike raster`} />
      {spikes.groups && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {spikes.groups.map((g) => (
            <span
              key={g.name}
              className="cx-badge"
              style={{ borderColor: g.kind === 'I' ? '#A855F7' : '#38BDF8', color: 'var(--text-primary)' }}
            >
              {g.kind === 'I' ? '● Inhibitory' : '▲ Excitatory'}: {g.name} ({g.to - g.from})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
